from typing import List, Optional
from datetime import datetime

from django.contrib.postgres.search import SearchVector
from django.http import Http404
from django.shortcuts import get_object_or_404

import ninja
from ninja.pagination import paginate as ninja_paginate
import sqids

from .models import Reference, Purchase


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

    domain: Optional[str]
    vintage: Optional[int]

    class Config:
        extra = "forbid" # XXX(msy) to test


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
    domain: str
    vintage: int
    purchases: List[PurchaseOut]

    @staticmethod
    def resolve_sqid(obj):
        return sqid_encode(obj.id)
    
    @staticmethod
    def resolve_purchases(obj):
        return [{
            'id': p.id,
            'date': p.date.isoformat(),
            'quantity': p.quantity,
            'price': float(p.price)
        } for p in obj.purchases.all()]


@api.post("/ref")
def create_reference(request, reference_in: ReferenceIn):
    reference = Reference.objects.create(**reference_in.dict())
    return {"sqid": sqids.encode([reference.id])}


# XXX(msy) Currently all fields are required. We can make them optional by
# using a ReferencePatch schema? Is there an easier way w/o using a
# ninja.ModelSchema?
@api.put("/ref/{sqid}", response=ReferenceOut)
def update_reference(request, sqid: str, payload: ReferenceIn):
    reference = get_object_or_404(Reference, id=sqid_decode(sqid))

    for attr, value in payload.dict().items():
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
        search=SearchVector("name", "domain")
    ).filter(search__icontains=search)


@api.get("/ref/{sqid}/purchases", response=List[PurchaseOut])
def list_purchases(request, sqid: str):
    reference = get_object_or_404(Reference, id=sqid_decode(sqid))
    return [
        {
            'id': p.id,
            'date': p.date.isoformat(),
            'quantity': p.quantity,
            'price': float(p.price)
        } for p in reference.purchases.all()
    ]


@api.post("/ref/{sqid}/purchases", response=PurchaseOut)
def create_purchase(request, sqid: str, purchase_in: PurchaseIn):
    reference = get_object_or_404(Reference, id=sqid_decode(sqid))
    purchase_data = purchase_in.dict()
    purchase_data['date'] = datetime.fromisoformat(purchase_data['date']).date()
    purchase = Purchase.objects.create(
        reference=reference,
        **purchase_data
    )
    return {
        'id': purchase.id,
        'date': purchase.date.isoformat(),
        'quantity': purchase.quantity,
        'price': float(purchase.price)
    }


@api.put("/purchase/{purchase_id}", response=PurchaseOut)
def update_purchase(request, purchase_id: int, purchase_in: PurchaseIn):
    purchase = get_object_or_404(Purchase, id=purchase_id)
    purchase_data = purchase_in.dict()
    purchase_data['date'] = datetime.fromisoformat(purchase_data['date']).date()
    
    for attr, value in purchase_data.items():
        setattr(purchase, attr, value)
    
    purchase.save()
    return {
        'id': purchase.id,
        'date': purchase.date.isoformat(),
        'quantity': purchase.quantity,
        'price': float(purchase.price)
    }


@api.delete("/purchase/{purchase_id}")
def delete_purchase(request, purchase_id: int):
    purchase = get_object_or_404(Purchase, id=purchase_id)
    purchase.delete()
    return {}
