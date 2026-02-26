from mozilla_django_oidc.auth import OIDCAuthenticationBackend


class GibolinOIDCBackend(OIDCAuthenticationBackend):
    """Custom OIDC backend enforcing email whitelist.

    Only pre-existing User records (created by admin) can log in.
    No auto-creation of users on first OIDC login.
    """

    def filter_users_by_claims(self, claims):
        email = claims.get("email", "")
        if not email:
            return self.UserModel.objects.none()
        return self.UserModel.objects.filter(email__iexact=email)

    def create_user(self, claims):
        return None
