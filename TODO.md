# TODO

## Authentication (Google OIDC via mozilla-django-oidc)

Goal: Google login for friends-only access. Admin pre-creates User records with allowed emails. Django sessions protect both the API and Django admin. No registration, no password reset, no password storage.

### Dependencies
- Add `mozilla-django-oidc` and `django-ratelimit` to `requirements.txt`

### Google Cloud Console (manual, not code)
- Create OAuth 2.0 credentials (client ID + client secret) at console.cloud.google.com
- Set authorized redirect URI to `https://gibolin.cleverapps.io/oidc/callback/` (and `http://localhost:8000/oidc/callback/` for dev)

### Django settings (`gibolin/settings.py`)
- Add `mozilla_django_oidc` to `INSTALLED_APPS`
- Add `mozilla_django_oidc.middleware.SessionRefresh` to `MIDDLEWARE`
- Add `mozilla_django_oidc.auth.OIDCAuthenticationBackend` to `AUTHENTICATION_BACKENDS`
- Set OIDC settings: `OIDC_RP_CLIENT_ID`, `OIDC_RP_CLIENT_SECRET` (from env vars), `OIDC_OP_AUTHORIZATION_ENDPOINT` = `https://accounts.google.com/o/oauth2/v2/auth`, `OIDC_OP_TOKEN_ENDPOINT` = `https://oauth2.googleapis.com/token`, `OIDC_OP_USER_ENDPOINT` = `https://openidconnect.googleapis.com/v1/userinfo`, `OIDC_OP_JWKS_ENDPOINT` = `https://www.googleapis.com/oauth2/v3/certs`, `OIDC_RP_SIGN_ALGO` = `RS256`
- Harden session cookies: `SESSION_COOKIE_HTTPONLY = True`, `SESSION_COOKIE_SECURE = True` (not in dev), `SESSION_COOKIE_SAMESITE = "Lax"`, `SESSION_COOKIE_AGE = 86400 * 7` (1 week)
- Set `LOGIN_REDIRECT_URL = "/"` and `LOGOUT_REDIRECT_URL = "/"`

### Custom OIDC backend (`cave/auth.py`)
- Subclass `OIDCAuthenticationBackend` to enforce the email whitelist: override `filter_users_by_claims()` to match against existing User records by email. Override `create_user()` to **reject** (return None) — no auto-creation, admin must pre-create users. This is the friends-only gate.

### URLs (`gibolin/urls.py`)
- Add `path("oidc/", include("mozilla_django_oidc.urls"))` — provides `/oidc/authenticate/` (login) and `/oidc/callback/` (callback)
- Add a logout view that calls `django.contrib.auth.logout()` and redirects to `/`
- Move Django admin URL from `/admin/` to a non-guessable path (e.g., `/backoffice/`). Reduces Metasploit scan surface.

### API auth enforcement (`cave/api.py`)
- Add a Django Ninja auth class that checks `request.user.is_authenticated`. Apply it globally: `api = NinjaAPI(auth=SessionAuth())` where `SessionAuth` checks the Django session.
- Exempt the healthcheck endpoint from auth.

### Rate limiting
- Add `@ratelimit(key="ip", rate="10/m", method="GET", block=True)` on the OIDC login redirect view (may need a thin wrapper around `mozilla_django_oidc.views.OIDCAuthenticationRequestView`)

### Frontend (`ui/src/index.tsx`)
- On app load, check if user is authenticated: `GET /api/me` (new endpoint returning current user email or 401)
- If 401, show a "Login with Google" button that navigates to `/oidc/authenticate/`
- Add a logout button in the UI header that calls the logout endpoint
- No token storage, no Authorization headers — Django session cookie handles everything automatically via `credentials: "include"` on fetch calls (or same-origin default)

### Frontend API calls
- Ensure all `fetch()` calls use `credentials: "same-origin"` (the default) so the session cookie is sent. No changes needed if already using relative URLs.
- Handle 401/403 responses globally: redirect to login

### Clever Cloud env vars (`DEPLOY.md`)
- Document: `OIDC_RP_CLIENT_ID` and `OIDC_RP_CLIENT_SECRET` must be set via `clever env set`

### Local dev setup
- Add `OIDC_RP_CLIENT_ID` and `OIDC_RP_CLIENT_SECRET` env vars to `api` service in `docker-compose.yml` (can default to empty or use a `.env` file)
- In `settings.py`, when `DEBUG=True` and OIDC client ID is not set, disable OIDC auth: skip `SessionRefresh` middleware, use a `DevAutoLoginMiddleware` that auto-authenticates as a default dev user (created by `load_test_data.py`)
- Add a dev user to `load_test_data.py` so `make seed-db` creates a usable account for local dev
- Document in README: for local dev, auth is bypassed automatically; to test OIDC locally, set `OIDC_RP_CLIENT_ID`/`OIDC_RP_CLIENT_SECRET` in docker-compose env or `.env`

### Test migration
- All existing API tests use `self.client` with no auth. After adding `NinjaAPI(auth=SessionAuth())`, every test that hits the API will get 401.
- Add a `setUp` pattern: create a test user and call `self.client.force_login(user)` in every API test class `setUp`. Or use a base test class `AuthenticatedTestCase` that does this, and have all API test classes inherit from it.
- Healthcheck test should verify it works WITHOUT `force_login`.

### Tests
- Test custom OIDC backend: known email returns existing user, unknown email returns None (rejected)
- Test API endpoints return 401 when unauthenticated
- Test API endpoints return 200 when session is active (use `self.client.force_login(user)`)
- Test healthcheck is exempt from auth
- Test `DevAutoLoginMiddleware` auto-authenticates when `DEBUG=True` and OIDC is not configured
