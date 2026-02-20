import math
from typing import List, Optional
from datetime import datetime

from django.db.models import Q, Sum, F
from django.http import Http404, HttpResponse
from django.shortcuts import get_object_or_404
from django.template.loader import render_to_string

import ninja
from ninja.pagination import paginate as ninja_paginate
import sqids

from .models import Reference, Purchase, Category, Region, Appellation, MenuTemplate


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


@api.get("/stats")
def get_stats(request):
    """Get cellar statistics using average purchase price per reference"""
    total_references = Reference.objects.count()
    total_bottles = Reference.objects.aggregate(total=Sum('current_quantity'))['total'] or 0

    # Calculate total value: avg_price_per_ref * current_quantity
    total_value = 0
    references = Reference.objects.annotate(
        purchase_value=Sum(F('purchases__price') * F('purchases__quantity')),
        purchase_quantity=Sum('purchases__quantity')
    )

    for ref in references:
        if ref.purchase_quantity and ref.purchase_quantity > 0:
            avg_price = ref.purchase_value / ref.purchase_quantity
            total_value += float(avg_price) * ref.current_quantity

    return {
        "total_references": total_references,
        "total_bottles": total_bottles,
        "total_value": round(total_value, 2),
    }


class ReferenceIn(ninja.Schema):
    name: str
    category: Optional[str] = None
    region: Optional[str] = None
    appellation: Optional[str] = None
    domain: Optional[str] = None
    vintage: Optional[int] = None
    current_quantity: Optional[int] = 0
    price_multiplier: Optional[float] = 3.00
    retail_price_override: Optional[float] = None
    hidden_from_menu: Optional[bool] = False

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


def _compute_retail_price(obj):
    """Compute retail price: override or avg_purchase_price × multiplier (ceiling)"""
    if obj.retail_price_override:
        return float(obj.retail_price_override)

    purchases = obj.purchases.all()
    if not purchases:
        return None

    total_value = sum(float(p.price) * p.quantity for p in purchases)
    total_qty = sum(p.quantity for p in purchases)
    if total_qty == 0:
        return None

    avg_price = total_value / total_qty
    return math.ceil(avg_price * float(obj.price_multiplier))


class ReferenceOut(ninja.Schema):
    sqid: str
    name: str
    category: Optional[str]
    region: Optional[str]
    appellation: Optional[str]
    domain: Optional[str]
    vintage: Optional[int]
    current_quantity: int
    price_multiplier: float
    retail_price_override: Optional[float]
    retail_price: Optional[int]
    hidden_from_menu: bool
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
    def resolve_retail_price(obj):
        return _compute_retail_price(obj)

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

    if data.get("category"):
        category, _ = Category.objects.get_or_create(name=data["category"])
        data["category"] = category

    if data.get("region"):
        region, _ = Region.objects.get_or_create(name=data["region"])
        data["region"] = region

    if data.get("appellation"):
        appellation, _ = Appellation.objects.get_or_create(name=data["appellation"])
        data["appellation"] = appellation

    reference = Reference.objects.create(**data)
    return {"sqid": sqids.encode([reference.id])}


@api.put("/ref/{sqid}", response=ReferenceOut)
def update_reference(request, sqid: str, payload: ReferenceIn):
    reference = get_object_or_404(Reference, id=sqid_decode(sqid))
    data = payload.dict()

    if "category" in data:
        if data["category"]:
            category, _ = Category.objects.get_or_create(name=data["category"])
            reference.category = category
        else:
            reference.category = None
        del data["category"]

    if "region" in data:
        if data["region"]:
            region, _ = Region.objects.get_or_create(name=data["region"])
            reference.region = region
        else:
            reference.region = None
        del data["region"]

    if "appellation" in data:
        if data["appellation"]:
            appellation, _ = Appellation.objects.get_or_create(name=data["appellation"])
            reference.appellation = appellation
        else:
            reference.appellation = None
        del data["appellation"]

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


def _search_word(word):
    """Match a single word against any searchable field."""
    return (
        Q(name__unaccent__icontains=word) |
        Q(domain__unaccent__icontains=word) |
        Q(category__name__unaccent__icontains=word) |
        Q(region__name__unaccent__icontains=word) |
        Q(appellation__name__unaccent__icontains=word)
    )


@api.get("/refs", response=List[ReferenceOut])
@ninja_paginate
def list_reference(request, search: str = None):
    if not search:
        return Reference.objects.all()

    words = search.split()
    query = _search_word(words[0])
    for word in words[1:]:
        query &= _search_word(word)

    return Reference.objects.filter(query).distinct()


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


class MenuTemplateIn(ninja.Schema):
    content: str


@api.get("/menu/template")
def get_menu_template(request):
    """Get the menu template"""
    return {"content": MenuTemplate.get_template()}


@api.put("/menu/template")
def save_menu_template(request, payload: MenuTemplateIn):
    """Save the menu template"""
    MenuTemplate.set_template(payload.content)
    return {"success": True}


@api.get("/menu/template/generate")
def generate_menu_template(request):
    """Generate a template from current data"""
    categories = Category.objects.all()
    regions = Region.objects.all()
    appellations = Appellation.objects.all()
    references = Reference.objects.filter(hidden_from_menu=False).select_related(
        "category", "region", "appellation"
    )

    lines = []
    for category in categories:
        # Check if category has visible wines
        cat_wines = [r for r in references if r.category == category]
        if not cat_wines:
            continue

        lines.append(f"# {category.name}")

        # Find regions in this category
        cat_regions = set(r.region.name for r in cat_wines if r.region)
        for region in regions:
            if region.name not in cat_regions:
                continue

            lines.append(f"  {region.name}")

            # Find appellations in this region for this category
            region_wines = [r for r in cat_wines if r.region and r.region.name == region.name]
            region_appellations = set(r.appellation.name for r in region_wines if r.appellation)
            for appellation in appellations:
                if appellation.name in region_appellations:
                    lines.append(f"    {appellation.name}")

    return {"content": "\n".join(lines)}


def _parse_menu_template(content):
    """Parse template into ordering dicts"""
    category_order = {}
    region_order = {}
    appellation_order = {}

    cat_idx = 0
    reg_idx = 0
    app_idx = 0

    for line in content.split("\n"):
        line = line.rstrip()
        if not line:
            continue

        if line.startswith("# "):
            name = line[2:].strip()
            category_order[name] = cat_idx
            cat_idx += 1
            reg_idx = 0
            app_idx = 0
        elif line.startswith("    "):
            name = line.strip()
            appellation_order[name] = app_idx
            app_idx += 1
        elif line.startswith("  "):
            name = line.strip()
            region_order[name] = reg_idx
            reg_idx += 1
            app_idx = 0

    return category_order, region_order, appellation_order


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
    """Generate HTML wine menu for printing using Jinja template"""

    # Get visible references with their categories, regions, and appellations
    references = Reference.objects.filter(hidden_from_menu=False).select_related(
        "category", "region", "appellation"
    )

    # Parse template for ordering
    template_content = MenuTemplate.get_template()
    cat_order, reg_order, app_order = _parse_menu_template(template_content)

    def sort_key(item, order_dict):
        """Return (order, name) for sorting - template items first, then alphabetical"""
        name = item.name if hasattr(item, 'name') else item
        if name in order_dict:
            return (0, order_dict[name], name)
        return (1, 0, name)

    # Get categories, regions, and appellations sorted by template then alphabetically
    categories = sorted(Category.objects.all(), key=lambda x: sort_key(x, cat_order))
    regions = sorted(Region.objects.all(), key=lambda x: sort_key(x, reg_order))
    appellations = sorted(Appellation.objects.all(), key=lambda x: sort_key(x, app_order))

    # Create nested structure for the template
    template_categories = []

    # Build regular categories first
    for category in categories:
        category_data = {
            "name": category.name,
            "color": category.color,
            "has_wines": False,
            "regions": [],
        }

        # Get wines for this category
        category_wines = [ref for ref in references if ref.category == category]

        if category_wines:
            category_data["has_wines"] = True

            # Group wines by region
            region_groups = {}
            for wine in category_wines:
                region_name = wine.region.name if wine.region else "No Region"
                if region_name not in region_groups:
                    region_groups[region_name] = []
                region_groups[region_name].append(wine)

            # Build region data
            for region in regions:
                if region.name in region_groups:
                    region_data = {
                        "name": region.name,
                        "has_wines": True,
                        "appellations": [],
                    }

                    # Group region wines by appellation
                    appellation_groups = {}
                    for wine in region_groups[region.name]:
                        appellation_name = (
                            wine.appellation.name
                            if wine.appellation
                            else "No Appellation"
                        )
                        if appellation_name not in appellation_groups:
                            appellation_groups[appellation_name] = []
                        appellation_groups[appellation_name].append(wine)

                    # Build appellation data
                    for appellation in appellations:
                        if appellation.name in appellation_groups:
                            appellation_data = {"name": appellation.name, "wines": []}

                            # Sort wines and build wine data
                            sorted_wines = sorted(
                                appellation_groups[appellation.name],
                                key=lambda x: x.name or "",
                            )
                            for wine in sorted_wines:
                                wine_data = {"name": wine.name, "details": None, "price": _compute_retail_price(wine)}

                                # Build details string
                                details = []
                                if wine.domain:
                                    details.append(wine.domain)
                                if wine.vintage:
                                    details.append(str(wine.vintage))

                                if details:
                                    wine_data["details"] = " • ".join(details)

                                appellation_data["wines"].append(wine_data)

                            region_data["appellations"].append(appellation_data)

                    # Handle wines without appellation
                    if "No Appellation" in appellation_groups:
                        appellation_data = {"name": "No Appellation", "wines": []}

                        sorted_wines = sorted(
                            appellation_groups["No Appellation"],
                            key=lambda x: x.name or "",
                        )
                        for wine in sorted_wines:
                            wine_data = {"name": wine.name, "details": None, "price": _compute_retail_price(wine)}

                            details = []
                            if wine.domain:
                                details.append(wine.domain)
                            if wine.vintage:
                                details.append(str(wine.vintage))

                            if details:
                                wine_data["details"] = " • ".join(details)

                            appellation_data["wines"].append(wine_data)

                        region_data["appellations"].append(appellation_data)

                    category_data["regions"].append(region_data)

            # Handle wines without region
            if "No Region" in region_groups:
                region_data = {
                    "name": "No Region",
                    "has_wines": True,
                    "appellations": [],
                }

                # Group no-region wines by appellation
                appellation_groups = {}
                for wine in region_groups["No Region"]:
                    appellation_name = (
                        wine.appellation.name if wine.appellation else "No Appellation"
                    )
                    if appellation_name not in appellation_groups:
                        appellation_groups[appellation_name] = []
                    appellation_groups[appellation_name].append(wine)

                # Build appellation data for no-region wines
                for appellation in appellations:
                    if appellation.name in appellation_groups:
                        appellation_data = {"name": appellation.name, "wines": []}

                        sorted_wines = sorted(
                            appellation_groups[appellation.name],
                            key=lambda x: x.name or "",
                        )
                        for wine in sorted_wines:
                            wine_data = {"name": wine.name, "details": None, "price": _compute_retail_price(wine)}

                            details = []
                            if wine.domain:
                                details.append(wine.domain)
                            if wine.vintage:
                                details.append(str(wine.vintage))

                            if details:
                                wine_data["details"] = " • ".join(details)

                            appellation_data["wines"].append(wine_data)

                        region_data["appellations"].append(appellation_data)

                # Handle no-region, no-appellation wines
                if "No Appellation" in appellation_groups:
                    appellation_data = {"name": "No Appellation", "wines": []}

                    sorted_wines = sorted(
                        appellation_groups["No Appellation"], key=lambda x: x.name or ""
                    )
                    for wine in sorted_wines:
                        wine_data = {"name": wine.name, "details": None, "price": _compute_retail_price(wine)}

                        details = []
                        if wine.domain:
                            details.append(wine.domain)
                        if wine.vintage:
                            details.append(str(wine.vintage))

                        if details:
                            wine_data["details"] = " • ".join(details)

                        appellation_data["wines"].append(wine_data)

                    region_data["appellations"].append(appellation_data)

                category_data["regions"].append(region_data)

        template_categories.append(category_data)

    # Handle wines without category (Other Selections)
    uncategorized_wines = [ref for ref in references if not ref.category]
    if uncategorized_wines:
        category_data = {
            "name": "Other Selections",
            "color": "#666666",
            "has_wines": True,
            "regions": [],
        }

        # Group uncategorized wines by region
        region_groups = {}
        for wine in uncategorized_wines:
            region_name = wine.region.name if wine.region else "No Region"
            if region_name not in region_groups:
                region_groups[region_name] = []
            region_groups[region_name].append(wine)

        # Build region data for uncategorized wines
        for region in regions:
            if region.name in region_groups:
                region_data = {
                    "name": region.name,
                    "has_wines": True,
                    "appellations": [],
                }

                # Group region wines by appellation
                appellation_groups = {}
                for wine in region_groups[region.name]:
                    appellation_name = (
                        wine.appellation.name if wine.appellation else "No Appellation"
                    )
                    if appellation_name not in appellation_groups:
                        appellation_groups[appellation_name] = []
                    appellation_groups[appellation_name].append(wine)

                # Build appellation data
                for appellation in appellations:
                    if appellation.name in appellation_groups:
                        appellation_data = {"name": appellation.name, "wines": []}

                        sorted_wines = sorted(
                            appellation_groups[appellation.name],
                            key=lambda x: x.name or "",
                        )
                        for wine in sorted_wines:
                            wine_data = {"name": wine.name, "details": None, "price": _compute_retail_price(wine)}

                            details = []
                            if wine.domain:
                                details.append(wine.domain)
                            if wine.vintage:
                                details.append(str(wine.vintage))

                            if details:
                                wine_data["details"] = " • ".join(details)

                            appellation_data["wines"].append(wine_data)

                        region_data["appellations"].append(appellation_data)

                # Handle wines without appellation
                if "No Appellation" in appellation_groups:
                    appellation_data = {"name": "No Appellation", "wines": []}

                    sorted_wines = sorted(
                        appellation_groups["No Appellation"], key=lambda x: x.name or ""
                    )
                    for wine in sorted_wines:
                        wine_data = {"name": wine.name, "details": None, "price": _compute_retail_price(wine)}

                        details = []
                        if wine.domain:
                            details.append(wine.domain)
                        if wine.vintage:
                            details.append(str(wine.vintage))

                        if details:
                            wine_data["details"] = " • ".join(details)

                        appellation_data["wines"].append(wine_data)

                    region_data["appellations"].append(appellation_data)

                category_data["regions"].append(region_data)

        # Handle uncategorized wines without region
        if "No Region" in region_groups:
            region_data = {"name": "No Region", "has_wines": True, "appellations": []}

            # Group no-region wines by appellation
            appellation_groups = {}
            for wine in region_groups["No Region"]:
                appellation_name = (
                    wine.appellation.name if wine.appellation else "No Appellation"
                )
                if appellation_name not in appellation_groups:
                    appellation_groups[appellation_name] = []
                appellation_groups[appellation_name].append(wine)

            # Build appellation data for no-region wines
            for appellation in appellations:
                if appellation.name in appellation_groups:
                    appellation_data = {"name": appellation.name, "wines": []}

                    sorted_wines = sorted(
                        appellation_groups[appellation.name], key=lambda x: x.name or ""
                    )
                    for wine in sorted_wines:
                        wine_data = {"name": wine.name, "details": None, "price": _compute_retail_price(wine)}

                        details = []
                        if wine.domain:
                            details.append(wine.domain)
                        if wine.vintage:
                            details.append(str(wine.vintage))

                        if details:
                            wine_data["details"] = " • ".join(details)

                        appellation_data["wines"].append(wine_data)

                    region_data["appellations"].append(appellation_data)

            # Handle no-region, no-appellation wines
            if "No Appellation" in appellation_groups:
                appellation_data = {"name": "No Appellation", "wines": []}

                sorted_wines = sorted(
                    appellation_groups["No Appellation"], key=lambda x: x.name or ""
                )
                for wine in sorted_wines:
                    wine_data = {"name": wine.name, "details": None, "price": _compute_retail_price(wine)}

                    details = []
                    if wine.domain:
                        details.append(wine.domain)
                    if wine.vintage:
                        details.append(str(wine.vintage))

                    if details:
                        wine_data["details"] = " • ".join(details)

                    appellation_data["wines"].append(wine_data)

                region_data["appellations"].append(appellation_data)

            category_data["regions"].append(region_data)

        template_categories.append(category_data)

    # Render the template
    context = {"categories": template_categories}

    html_content = render_to_string("wine_menu.html", context)

    return HttpResponse(html_content, content_type="text/html")
