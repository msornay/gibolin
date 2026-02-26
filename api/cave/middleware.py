from django.conf import settings


class DevAutoLoginMiddleware:
    """Auto-authenticate as first staff user in dev when OIDC is not configured.

    Only active when settings.DEBUG is True at request time (Django's test
    runner sets DEBUG=False, so this does nothing during tests).
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if settings.DEBUG and not request.user.is_authenticated:
            from users.models import User

            dev_user = User.objects.filter(is_staff=True).first()
            if dev_user:
                from django.contrib.auth import login

                login(request, dev_user, backend="django.contrib.auth.backends.ModelBackend")
        return self.get_response(request)
