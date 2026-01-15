from typing import List, Optional
from datetime import datetime

from django.db.models import Q
from django.http import Http404, HttpResponse
from django.shortcuts import get_object_or_404
from django.template.loader import render_to_string

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
    category: Optional[str] = None
    region: Optional[str] = None
    appellation: Optional[str] = None
    domain: Optional[str] = None
    vintage: Optional[int] = None
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
    parent: Optional[str] = (
        None  # category name if this is a region, region name if this is an appellation
    )


class NestedOrderIn(ninja.Schema):
    items: List[NestedOrderItem]


@api.put("/menu/order")
def update_nested_menu_order(request, order_in: NestedOrderIn):
    """Update the nested order of categories, regions, and appellations"""
    category_order = 0
    region_order = 0
    appellation_order = 0

    for item in order_in.items:
        if item.type == "category":
            # Update category order
            Category.objects.filter(name=item.name).update(order=category_order)
            category_order += 1
            region_order = 0  # Reset region order for new category
            appellation_order = 0  # Reset appellation order for new category
        elif item.type == "region":
            # Update region order within the current category
            Region.objects.filter(name=item.name).update(order=region_order)
            region_order += 1
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
    references = Reference.objects.select_related(
        "category", "region", "appellation"
    ).all()

    # Build structure showing which regions and appellations have wines in each category
    structure = []

    for category in categories:
        category_item = {
            "type": "category",
            "name": category.name,
            "order": category.order,
            "color": category.color,
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
                structure.append(
                    {
                        "type": "region",
                        "name": region.name,
                        "parent": category.name,
                        "order": region.order,
                    }
                )

                # Find appellations that have wines in this category and region
                region_appellations = set()
                for ref in references:
                    if (
                        ref.category
                        and ref.category.name == category.name
                        and ref.region
                        and ref.region.name == region.name
                        and ref.appellation
                    ):
                        region_appellations.add(ref.appellation.name)

                # Add appellations in order
                for appellation in appellations:
                    if appellation.name in region_appellations:
                        structure.append(
                            {
                                "type": "appellation",
                                "name": appellation.name,
                                "parent": region.name,
                                "order": appellation.order,
                            }
                        )

    # Add "Other Selections" category
    other_refs = [ref for ref in references if not ref.category]
    if other_refs:
        structure.append(
            {
                "type": "category",
                "name": "Other Selections",
                "order": 999,
                "color": "#666666",
            }
        )

        # Add regions in Other Selections
        other_regions = set()
        for ref in other_refs:
            if ref.region:
                other_regions.add(ref.region.name)

        for region in regions:
            if region.name in other_regions:
                structure.append(
                    {
                        "type": "region",
                        "name": region.name,
                        "parent": "Other Selections",
                        "order": region.order,
                    }
                )

                # Find appellations in this region for Other Selections
                other_region_appellations = set()
                for ref in other_refs:
                    if (
                        ref.region
                        and ref.region.name == region.name
                        and ref.appellation
                    ):
                        other_region_appellations.add(ref.appellation.name)

                # Add appellations in order
                for appellation in appellations:
                    if appellation.name in other_region_appellations:
                        structure.append(
                            {
                                "type": "appellation",
                                "name": appellation.name,
                                "parent": region.name,
                                "order": appellation.order,
                            }
                        )

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
    """Generate HTML wine menu for printing using Jinja template"""

    # Get all references with their categories, regions, and appellations
    references = Reference.objects.select_related(
        "category", "region", "appellation"
    ).all()

    # Get categories, regions, and appellations in order
    categories = Category.objects.all().order_by("order")
    regions = Region.objects.all().order_by("order")
    appellations = Appellation.objects.all().order_by("order")

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
                                wine_data = {"name": wine.name, "details": None}

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
                            wine_data = {"name": wine.name, "details": None}

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
                            wine_data = {"name": wine.name, "details": None}

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
                        wine_data = {"name": wine.name, "details": None}

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
                            wine_data = {"name": wine.name, "details": None}

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
                        wine_data = {"name": wine.name, "details": None}

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
                        wine_data = {"name": wine.name, "details": None}

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
                    wine_data = {"name": wine.name, "details": None}

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
