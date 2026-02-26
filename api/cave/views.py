from django.contrib.auth import logout
from django.shortcuts import redirect
from django_ratelimit.decorators import ratelimit
from mozilla_django_oidc.views import OIDCAuthenticationRequestView


class RateLimitedOIDCLoginView(OIDCAuthenticationRequestView):
    """OIDC login with rate limiting to prevent abuse."""

    @ratelimit(key="ip", rate="10/m", method="GET", block=True)
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)


def logout_view(request):
    logout(request)
    return redirect("/")
