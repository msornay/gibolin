from typing import List, Optional
from datetime import datetime

from django.contrib.postgres.search import SearchVector
from django.http import Http404, HttpResponse
from django.shortcuts import get_object_or_404

import ninja
from ninja.pagination import paginate as ninja_paginate
import sqids

from .models import Reference, Purchase, Category


sqids = sqids.Sqids(min_length=8)


def sqid_encode(id: int):
    return sqids.encode([id])


def sqid_decode(sqid: str):
    try:
        return sqids.decode(sqid)[0]
    except IndexError as exc:
        raise Http404 from exc


api = ninja.NinjaAPI()


@api.get("/healthcheck")
def status(request):
    return {}


class ReferenceIn(ninja.Schema):
    name: str
    category: Optional[str]  # Will be category name, converted to Category object

    domain: Optional[str]
    vintage: Optional[int]

    class Config:
        extra = "forbid"  # XXX(msy) to test


class PurchaseIn(ninja.Schema):
    date: str
    quantity: int
    price: float


class PurchaseOut(ninja.Schema):
    id: int
    date: str
    quantity: int
    price: float


class ReferenceOut(ninja.Schema):
    sqid: str
    name: str
    category: Optional[str]
    domain: Optional[str]
    vintage: Optional[int]
    purchases: List[PurchaseOut]

    @staticmethod
    def resolve_sqid(obj):
        return sqid_encode(obj.id)

    @staticmethod
    def resolve_category(obj):
        return obj.category.name if obj.category else None

    @staticmethod
    def resolve_purchases(obj):
        return [
            {
                "id": p.id,
                "date": p.date.isoformat(),
                "quantity": p.quantity,
                "price": float(p.price),
            }
            for p in obj.purchases.all()
        ]


@api.post("/ref")
def create_reference(request, reference_in: ReferenceIn):
    data = reference_in.dict()
    category = None
    
    if data.get('category'):
        category, _ = Category.objects.get_or_create(name=data['category'])
        data['category'] = category
    
    reference = Reference.objects.create(**data)
    return {"sqid": sqids.encode([reference.id])}


@api.put("/ref/{sqid}", response=ReferenceOut)
def update_reference(request, sqid: str, payload: ReferenceIn):
    reference = get_object_or_404(Reference, id=sqid_decode(sqid))
    data = payload.dict()

    if 'category' in data:
        if data['category']:
            category, _ = Category.objects.get_or_create(name=data['category'])
            reference.category = category
        else:
            reference.category = None
        del data['category']

    for attr, value in data.items():
        setattr(reference, attr, value)

    reference.save()
    return reference


@api.delete("/ref/{sqid}")
def delete_reference(request, sqid: str):
    reference = get_object_or_404(Reference, id=sqid_decode(sqid))
    reference.delete()
    return {}


@api.get("/ref/{sqid}", response=ReferenceOut)
def get_reference(request, sqid: str):
    return get_object_or_404(Reference, id=sqid_decode(sqid))


@api.get("/refs", response=List[ReferenceOut])
@ninja_paginate
def list_reference(request, search: str = None):
    if not search:
        return Reference.objects.all()

    # keyword matching, but no phrase matching. doing both is not trivial.
    return Reference.objects.annotate(search=SearchVector("name", "domain")).filter(
        search__icontains=search
    )


@api.get("/categories", response=List[str])
def list_categories(request):
    """Get all categories"""
    return list(Category.objects.values_list("name", flat=True))


class CategoryIn(ninja.Schema):
    name: str


@api.post("/categories")
def create_category(request, category_in: CategoryIn):
    """Create a new category"""
    category, created = Category.objects.get_or_create(name=category_in.name)
    return {"name": category.name, "created": created}


class CategoryOrderIn(ninja.Schema):
    categories: List[str]  # List of category names in desired order


@api.put("/categories/order")
def update_category_order(request, order_in: CategoryOrderIn):
    """Update the order of categories"""
    for index, category_name in enumerate(order_in.categories):
        Category.objects.filter(name=category_name).update(order=index)
    return {"success": True}


@api.get("/ref/{sqid}/purchases", response=List[PurchaseOut])
def list_purchases(request, sqid: str):
    reference = get_object_or_404(Reference, id=sqid_decode(sqid))
    return [
        {
            "id": p.id,
            "date": p.date.isoformat(),
            "quantity": p.quantity,
            "price": float(p.price),
        }
        for p in reference.purchases.all()
    ]


@api.post("/ref/{sqid}/purchases", response=PurchaseOut)
def create_purchase(request, sqid: str, purchase_in: PurchaseIn):
    reference = get_object_or_404(Reference, id=sqid_decode(sqid))
    purchase_data = purchase_in.dict()
    purchase_data["date"] = datetime.fromisoformat(purchase_data["date"]).date()
    purchase = Purchase.objects.create(reference=reference, **purchase_data)
    return {
        "id": purchase.id,
        "date": purchase.date.isoformat(),
        "quantity": purchase.quantity,
        "price": float(purchase.price),
    }


@api.put("/purchase/{purchase_id}", response=PurchaseOut)
def update_purchase(request, purchase_id: int, purchase_in: PurchaseIn):
    purchase = get_object_or_404(Purchase, id=purchase_id)
    purchase_data = purchase_in.dict()
    purchase_data["date"] = datetime.fromisoformat(purchase_data["date"]).date()

    for attr, value in purchase_data.items():
        setattr(purchase, attr, value)

    purchase.save()
    return {
        "id": purchase.id,
        "date": purchase.date.isoformat(),
        "quantity": purchase.quantity,
        "price": float(purchase.price),
    }


@api.delete("/purchase/{purchase_id}")
def delete_purchase(request, purchase_id: int):
    purchase = get_object_or_404(Purchase, id=purchase_id)
    purchase.delete()
    return {}


@api.get("/export/html")
def export_wine_menu_html(request):
    """Generate HTML wine menu for printing"""
    
    # Get all references with their categories
    references = Reference.objects.select_related('category').all()
    
    # Get categories in order
    categories = Category.objects.all()
    
    # Group references by category
    category_groups = {}
    for category in categories:
        category_groups[category.name] = []
    
    # Add uncategorized group
    category_groups['Other Selections'] = []
    
    # Group references
    for ref in references:
        if ref.category:
            category_groups[ref.category.name].append(ref)
        else:
            category_groups['Other Selections'].append(ref)
    
    # Sort references within each category
    for category_refs in category_groups.values():
        category_refs.sort(key=lambda x: x.name or '')
    
    # Generate HTML
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Wine Menu</title>
        <meta charset="UTF-8">
        <style>
            @media print {{
                @page {{
                    size: A4;
                    margin: 20mm 15mm;
                }}
                
                body {{
                    font-family: 'Times New Roman', serif;
                    font-size: 12pt;
                    line-height: 1.4;
                    color: black;
                    margin: 0;
                    padding: 0;
                }}
                
                .page-break {{
                    page-break-before: always;
                }}
                
                .page-break-avoid {{
                    page-break-inside: avoid;
                }}
            }}
            
            @media screen {{
                body {{
                    font-family: 'Times New Roman', serif;
                    font-size: 12pt;
                    line-height: 1.4;
                    color: black;
                    max-width: 800px;
                    margin: 20px auto;
                    padding: 20px;
                }}
            }}
            
            .header {{
                text-align: center;
                margin-bottom: 30px;
                border-bottom: 2px solid #000;
                padding-bottom: 15px;
            }}
            
            .logo {{
                font-size: 24pt;
                margin-bottom: 10px;
            }}
            
            .restaurant-name {{
                font-size: 28pt;
                font-weight: bold;
                margin: 10px 0;
            }}
            
            .restaurant-subtitle {{
                font-size: 16pt;
                color: #666;
                margin: 5px 0;
            }}
            
            .menu-title {{
                font-size: 22pt;
                font-weight: bold;
                margin: 15px 0;
            }}
            
            .category {{
                margin-bottom: 30px;
                page-break-inside: avoid;
            }}
            
            .category-title {{
                font-size: 18pt;
                font-weight: bold;
                margin: 20px 0 15px 0;
                padding: 8px 0;
                border-bottom: 1px solid #ccc;
            }}
            
            .wine-item {{
                display: flex;
                justify-content: space-between;
                align-items: baseline;
                margin-bottom: 10px;
                page-break-inside: avoid;
            }}
            
            .wine-details {{
                flex: 1;
                padding-right: 20px;
                font-weight: bold;
            }}
            
            .wine-price {{
                font-weight: bold;
                white-space: nowrap;
            }}
        </style>
    </head>
    <body>
        <div class="header">
            <div class="logo">🍷</div>
            <div class="restaurant-name">Château de la Maison</div>
            <div class="restaurant-subtitle">Fine Dining • Wine Selection</div>
            <div class="menu-title">Wine Menu</div>
        </div>
    """
    
    # Add categories and wines
    for category_name, category_refs in category_groups.items():
        if not category_refs:
            continue
            
        html_content += f'<div class="category">'
        html_content += f'<div class="category-title">{category_name}</div>'
        
        for ref in category_refs:
            # Build wine details text
            wine_text = ref.name or 'Unknown Wine'
            details = []
            if ref.domain:
                details.append(ref.domain)
            if ref.vintage:
                details.append(str(ref.vintage))
            
            if details:
                wine_text += f" - {' • '.join(details)}"
            
            html_content += f'''
            <div class="wine-item">
                <div class="wine-details">{wine_text}</div>
                <div class="wine-price">€0</div>
            </div>
            '''
        
        html_content += '</div>'
    
    html_content += """
    </body>
    </html>
    """
    
    return HttpResponse(html_content, content_type='text/html')
