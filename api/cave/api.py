from typing import List, Optional

from django.shortcuts import get_object_or_404

import ninja
from ninja.pagination import paginate as ninja_paginate
import sqids

from .models import Reference


sqids = sqids.Sqids(min_length=8)

def sqid_encode(id: int):
    return sqids.encode([id])

def sqid_decode(sqid: str):
    return sqids.decode(sqid)[0]


api = ninja.NinjaAPI()


@api.get("/healthcheck")
def status(request):
    return {"health": "ok"}


class ReferenceIn(ninja.Schema):
    name: str

    domain: Optional[str]
    vintage: Optional[int]

    class Config:
        extra = "forbid" # XXX(msy) to test


class ReferenceOut(ninja.Schema):
    sqid: str
    name: str
    domain: str
    vintage: int

    @staticmethod
    def resolve_sqid(obj):
        return sqid_encode(obj.id)


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
def list_reference(request):
    return Reference.objects.all()
