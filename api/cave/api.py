from typing import List, Optional
from datetime import datetime

from django.contrib.postgres.search import SearchVector
from django.http import Http404, HttpResponse
from django.shortcuts import get_object_or_404

import ninja
from ninja.pagination import paginate as ninja_paginate
import sqids

from .models import Reference, Purchase, Category, Region, Appellation


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
    region: Optional[str]  # Will be region name, converted to Region object
    appellation: Optional[str]  # Will be appellation name, converted to Appellation object

    domain: Optional[str]
    vintage: Optional[int]
    current_quantity: Optional[int] = 0

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
    region: Optional[str]
    appellation: Optional[str]
    domain: Optional[str]
    vintage: Optional[int]
    current_quantity: int
    purchases: List[PurchaseOut]

    @staticmethod
    def resolve_sqid(obj):
        return sqid_encode(obj.id)

    @staticmethod
    def resolve_category(obj):
        return obj.category.name if obj.category else None

    @staticmethod
    def resolve_region(obj):
        return obj.region.name if obj.region else None

    @staticmethod
    def resolve_appellation(obj):
        return obj.appellation.name if obj.appellation else None

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
    
    if data.get('category'):
        category, _ = Category.objects.get_or_create(name=data['category'])
        data['category'] = category
    
    if data.get('region'):
        region, _ = Region.objects.get_or_create(name=data['region'])
        data['region'] = region
    
    if data.get('appellation'):
        appellation, _ = Appellation.objects.get_or_create(name=data['appellation'])
        data['appellation'] = appellation
    
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

    if 'region' in data:
        if data['region']:
            region, _ = Region.objects.get_or_create(name=data['region'])
            reference.region = region
        else:
            reference.region = None
        del data['region']

    if 'appellation' in data:
        if data['appellation']:
            appellation, _ = Appellation.objects.get_or_create(name=data['appellation'])
            reference.appellation = appellation
        else:
            reference.appellation = None
        del data['appellation']

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
    return Reference.objects.annotate(
        search=SearchVector("name", "domain", "category__name", "region__name", "appellation__name")
    ).filter(search__icontains=search)


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


@api.get("/regions", response=List[str])
def list_regions(request):
    """Get all regions"""
    return list(Region.objects.values_list("name", flat=True))


class RegionIn(ninja.Schema):
    name: str


@api.post("/regions")
def create_region(request, region_in: RegionIn):
    """Create a new region"""
    region, created = Region.objects.get_or_create(name=region_in.name)
    return {"name": region.name, "created": created}


class RegionOrderIn(ninja.Schema):
    regions: List[str]  # List of region names in desired order


@api.put("/regions/order")
def update_region_order(request, order_in: RegionOrderIn):
    """Update the order of regions"""
    for index, region_name in enumerate(order_in.regions):
        Region.objects.filter(name=region_name).update(order=index)
    return {"success": True}


@api.get("/appellations", response=List[str])
def list_appellations(request):
    """Get all appellations"""
    return list(Appellation.objects.values_list("name", flat=True))


class AppellationIn(ninja.Schema):
    name: str


@api.post("/appellations")
def create_appellation(request, appellation_in: AppellationIn):
    """Create a new appellation"""
    appellation, created = Appellation.objects.get_or_create(name=appellation_in.name)
    return {"name": appellation.name, "created": created}


class AppellationOrderIn(ninja.Schema):
    appellations: List[str]  # List of appellation names in desired order


@api.put("/appellations/order")
def update_appellation_order(request, order_in: AppellationOrderIn):
    """Update the order of appellations"""
    for index, appellation_name in enumerate(order_in.appellations):
        Appellation.objects.filter(name=appellation_name).update(order=index)
    return {"success": True}


class NestedOrderItem(ninja.Schema):
    type: str  # "category", "region", or "appellation"
    name: str
    parent: Optional[str] = None  # category name if this is a region, region name if this is an appellation


class NestedOrderIn(ninja.Schema):
    items: List[NestedOrderItem]


@api.put("/menu/order")
def update_nested_menu_order(request, order_in: NestedOrderIn):
    """Update the nested order of categories, regions, and appellations"""
    category_order = 0
    current_category = None
    region_order = 0
    current_region = None
    appellation_order = 0
    
    for item in order_in.items:
        if item.type == "category":
            # Update category order
            Category.objects.filter(name=item.name).update(order=category_order)
            category_order += 1
            current_category = item.name
            region_order = 0  # Reset region order for new category
            appellation_order = 0  # Reset appellation order for new category
        elif item.type == "region":
            # Update region order within the current category
            Region.objects.filter(name=item.name).update(order=region_order)
            region_order += 1
            current_region = item.name
            appellation_order = 0  # Reset appellation order for new region
        elif item.type == "appellation":
            # Update appellation order within the current region
            Appellation.objects.filter(name=item.name).update(order=appellation_order)
            appellation_order += 1
    
    return {"success": True}


class CategoryColorIn(ninja.Schema):
    name: str
    color: str


@api.put("/categories/color")
def update_category_color(request, color_in: CategoryColorIn):
    """Update the color of a category"""
    Category.objects.filter(name=color_in.name).update(color=color_in.color)
    return {"success": True}


class QuantityUpdateIn(ninja.Schema):
    quantity: int


@api.put("/ref/{sqid}/quantity")
def update_reference_quantity(request, sqid: str, quantity_in: QuantityUpdateIn):
    """Update the current quantity of a reference"""
    reference = get_object_or_404(Reference, id=sqid_decode(sqid))
    reference.current_quantity = quantity_in.quantity
    reference.save()
    return {"success": True, "quantity": reference.current_quantity}


@api.get("/menu/structure")
def get_menu_structure(request):
    """Get the current menu structure with categories, regions, and appellations"""
    # Get all categories, regions, appellations with their wines
    categories = Category.objects.all()
    regions = Region.objects.all()
    appellations = Appellation.objects.all()
    references = Reference.objects.select_related('category', 'region', 'appellation').all()
    
    # Build structure showing which regions and appellations have wines in each category
    structure = []
    
    for category in categories:
        category_item = {
            "type": "category",
            "name": category.name,
            "order": category.order,
            "color": category.color
        }
        structure.append(category_item)
        
        # Find regions that have wines in this category
        category_regions = set()
        for ref in references:
            if ref.category and ref.category.name == category.name and ref.region:
                category_regions.add(ref.region.name)
        
        # Add regions in order
        for region in regions:
            if region.name in category_regions:
                structure.append({
                    "type": "region",
                    "name": region.name,
                    "parent": category.name,
                    "order": region.order
                })
                
                # Find appellations that have wines in this category and region
                region_appellations = set()
                for ref in references:
                    if (ref.category and ref.category.name == category.name and 
                        ref.region and ref.region.name == region.name and ref.appellation):
                        region_appellations.add(ref.appellation.name)
                
                # Add appellations in order
                for appellation in appellations:
                    if appellation.name in region_appellations:
                        structure.append({
                            "type": "appellation",
                            "name": appellation.name,
                            "parent": region.name,
                            "order": appellation.order
                        })
    
    # Add "Other Selections" category
    other_refs = [ref for ref in references if not ref.category]
    if other_refs:
        structure.append({
            "type": "category", 
            "name": "Other Selections",
            "order": 999,
            "color": "#666666"
        })
        
        # Add regions in Other Selections
        other_regions = set()
        for ref in other_refs:
            if ref.region:
                other_regions.add(ref.region.name)
        
        for region in regions:
            if region.name in other_regions:
                structure.append({
                    "type": "region",
                    "name": region.name,
                    "parent": "Other Selections",
                    "order": region.order
                })
                
                # Find appellations in this region for Other Selections
                other_region_appellations = set()
                for ref in other_refs:
                    if (ref.region and ref.region.name == region.name and ref.appellation):
                        other_region_appellations.add(ref.appellation.name)
                
                # Add appellations in order
                for appellation in appellations:
                    if appellation.name in other_region_appellations:
                        structure.append({
                            "type": "appellation",
                            "name": appellation.name,
                            "parent": region.name,
                            "order": appellation.order
                        })
    
    return {"structure": structure}


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
    
    # Get all references with their categories, regions, and appellations
    references = Reference.objects.select_related('category', 'region', 'appellation').all()
    
    # Get categories, regions, and appellations in order
    categories = Category.objects.all()
    regions = Region.objects.all()
    appellations = Appellation.objects.all()
    
    # Create nested structure: category -> region -> appellation -> wines
    nested_groups = {}
    
    # Initialize category groups
    for category in categories:
        nested_groups[category.name] = {}
        # Initialize region groups within each category
        for region in regions:
            nested_groups[category.name][region.name] = {}
            # Initialize appellation groups within each region
            for appellation in appellations:
                nested_groups[category.name][region.name][appellation.name] = []
            # Add "No Appellation" group for wines without appellation
            nested_groups[category.name][region.name]['No Appellation'] = []
        # Add "No Region" group for wines without region
        nested_groups[category.name]['No Region'] = {}
        for appellation in appellations:
            nested_groups[category.name]['No Region'][appellation.name] = []
        nested_groups[category.name]['No Region']['No Appellation'] = []
    
    # Add "Other Selections" category
    nested_groups['Other Selections'] = {}
    for region in regions:
        nested_groups['Other Selections'][region.name] = {}
        for appellation in appellations:
            nested_groups['Other Selections'][region.name][appellation.name] = []
        nested_groups['Other Selections'][region.name]['No Appellation'] = []
    nested_groups['Other Selections']['No Region'] = {}
    for appellation in appellations:
        nested_groups['Other Selections']['No Region'][appellation.name] = []
    nested_groups['Other Selections']['No Region']['No Appellation'] = []
    
    # Group references by category then region then appellation
    for ref in references:
        category_name = ref.category.name if ref.category else 'Other Selections'
        region_name = ref.region.name if ref.region else 'No Region'
        appellation_name = ref.appellation.name if ref.appellation else 'No Appellation'
        
        if category_name not in nested_groups:
            nested_groups[category_name] = {}
        if region_name not in nested_groups[category_name]:
            nested_groups[category_name][region_name] = {}
        if appellation_name not in nested_groups[category_name][region_name]:
            nested_groups[category_name][region_name][appellation_name] = []
            
        nested_groups[category_name][region_name][appellation_name].append(ref)
    
    # Sort wines within each appellation
    for category_regions in nested_groups.values():
        for region_appellations in category_regions.values():
            for appellation_wines in region_appellations.values():
                appellation_wines.sort(key=lambda x: x.name or '')
    
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
            
            .region-title {{
                font-size: 14pt;
                font-weight: bold;
                margin: 15px 0 10px 0;
                padding: 4px 0 4px 20px;
                color: #666;
                font-style: italic;
            }}
            
            .appellation-title {{
                font-size: 12pt;
                font-weight: bold;
                margin: 10px 0 8px 0;
                padding: 3px 0 3px 40px;
                color: #999;
                font-style: italic;
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
    
    # Add categories, regions, and appellations with wines  
    all_categories = list(categories) + [type('obj', (object,), {'name': 'Other Selections', 'color': '#666666'})()]
    
    for category in all_categories:
        category_name = category.name
        category_color = category.color
        category_regions = nested_groups.get(category_name, {})
        
        # Check if category has any wines
        has_wines = any(
            len(wines) > 0 
            for region_appellations in category_regions.values()
            for wines in region_appellations.values()
        )
        if not has_wines:
            continue
            
        html_content += f'<div class="category">'
        html_content += f'<div class="category-title" style="color: {category_color};">{category_name}</div>'
        
        # Add regions within this category
        for region_name in [reg.name for reg in regions] + ['No Region']:
            region_appellations = category_regions.get(region_name, {})
            if not region_appellations:
                continue
                
            # Check if region has any wines
            region_has_wines = any(len(wines) > 0 for wines in region_appellations.values())
            if not region_has_wines:
                continue
                
            # Always show region title except for "No Region"
            if region_name != 'No Region':
                html_content += f'<div class="region-title" style="color: {category_color};">{region_name}</div>'
            
            # Add appellations within this region
            for appellation_name in [app.name for app in appellations] + ['No Appellation']:
                appellation_wines = region_appellations.get(appellation_name, [])
                if not appellation_wines:
                    continue
                    
                # Always show appellation title except for "No Appellation"
                if appellation_name != 'No Appellation':
                    html_content += f'<div class="appellation-title" style="color: {category_color};">{appellation_name}</div>'
                
                for ref in appellation_wines:
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
