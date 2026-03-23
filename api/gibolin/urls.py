"""
URL configuration for gibolin project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.0/topics/http/urls/
"""

import os

from django.contrib import admin
from django.http import HttpResponse
from django.urls import include, path, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.views.decorators.csrf import ensure_csrf_cookie

from cave.api import api as cave_api
from cave.views import logout_view


@ensure_csrf_cookie
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
    path("backoffice/", admin.site.urls),
    path("api/", cave_api.urls),
    path("logout/", logout_view, name="logout"),
]

if settings.OIDC_ENABLED:
    from cave.views import RateLimitedOIDCLoginView

    urlpatterns += [
        path(
            "oidc/authenticate/",
            RateLimitedOIDCLoginView.as_view(),
            name="oidc_authentication_init",
        ),
        path("oidc/", include("mozilla_django_oidc.urls")),
    ]
else:
    from django.http import Http404

    def oidc_disabled(request, *args, **kwargs):
        raise Http404("OIDC is not configured")

    urlpatterns += [re_path(r"^oidc/", oidc_disabled)]

urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT) + [
    re_path(r"^.*$", spa_catchall),
]
