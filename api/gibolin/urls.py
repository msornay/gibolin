"""
URL configuration for gibolin project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.0/topics/http/urls/
"""

import os

from django.contrib import admin
from django.http import HttpResponse
from django.urls import path, re_path
from django.conf import settings
from django.conf.urls.static import static

from cave.api import api as cave_api


def spa_catchall(request):
    index_path = os.path.join(settings.BASE_DIR, "..", "ui", "dist", "index.html")
    try:
        with open(index_path) as f:
            return HttpResponse(f.read(), content_type="text/html")
    except FileNotFoundError:
        return HttpResponse(
            "Frontend not built. Run: cd ui && npm run build", status=501
        )


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", cave_api.urls),
] + static(settings.STATIC_URL, document_root=settings.STATIC_ROOT) + [
    re_path(r"^.*$", spa_catchall),
]
