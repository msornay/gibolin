from django.contrib import admin

from .models import Category, Region, Appellation, Format, Grape, Reference, Purchase

admin.site.register(Category)
admin.site.register(Region)
admin.site.register(Appellation)
admin.site.register(Format)
admin.site.register(Grape)
admin.site.register(Reference)
admin.site.register(Purchase)
