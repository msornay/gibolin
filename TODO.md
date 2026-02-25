# TODO

## Multi-user schema (preparation, no auth yet)

- Add `from django.conf import settings` to `cave/models.py`
- Add nullable `user` ForeignKey (`settings.AUTH_USER_MODEL`, `on_delete=models.SET_NULL`, `null=True`, `blank=True`) to: Category, Region, Appellation, Reference, MenuTemplate. Use distinct `related_name` for each (e.g. `categories`, `regions`, `appellations`, `references_owned`, `menu_templates`). Purchase does NOT need one (scoped through Reference FK).
- Generate migration with `makemigrations cave`
- Add `MultiUserSchemaTest` to `cave/tests.py`: verify each model can be created with `user=None`
- Do NOT add auth, login, user filtering, or frontend auth. Schema only.

## Location field on Reference

### Backend model
- Add `location = models.CharField(max_length=255, null=True, blank=True)` to Reference, after `domain`
- Generate migration with `makemigrations cave`

### Backend API (`cave/api.py`)
- Add `location: Optional[str] = None` to `ReferenceIn` schema (after `domain`)
- Add `location: Optional[str]` to `ReferenceOut` schema (after `domain`). No custom resolver needed.
- Add `Q(location__unaccent__icontains=word)` to `_search_word()` so search covers location
- Add `location: str = None` query parameter to `list_reference` endpoint. When set, filter `qs = qs.filter(location=location)` before search
- Add new `GET /api/locations` endpoint returning `List[str]`: distinct non-empty location values from Reference, sorted alphabetically
- Add `location: str = None` query parameter to `export_wine_menu_html`. When set, filter the references queryset

### Frontend (`ui/src/index.tsx`)
- Add `location?: string` to the `Reference` TypeScript type
- Add `location?: string` parameter to `fetchReferences`; append `&location=...` to URL when set
- Add `selectedLocation` state + `useQuery` for `GET /api/locations`
- Include `selectedLocation` in the references query key and pass to `fetchReferences`
- Add antd `Select` dropdown next to search bar: placeholder "All locations", `allowClear`, options from locations query. On change, reset page to 1.
- Add Location column to the table after Domain, render `location || "-"`
- CRITICAL: add `location: record.location` to `updateHiddenMutation` body (the PUT that toggles visibility). Without this, toggling hidden_from_menu nulls out the location.
- Add `exportLocation` state + `Select` dropdown inside Export Settings modal
- Update `handleHtmlExport` to append `?location=encodeURIComponent(exportLocation)` to the export URL when set

### Frontend form (`ui/src/components/reference-form.tsx`)
- Add `<Form.Item label="Location" name="location"><Input placeholder="e.g., Maison principale" /></Form.Item>` after the Domain field
- Add `location` to form initial values in both the edit (from `referenceData.location`) and create (empty string) branches

### Tests
- `ReferenceLocationModelTest`: create with location, create without (null)
- Extend `ReferenceAPITest`: create with location, update location, GET returns location
- `LocationAPITest`: empty DB returns `[]`, distinct values, sorted alphabetically
- Extend `ExportWineMenuHTMLTest`: filter by location shows only matching wines, no filter shows all
- Test `list_reference` with location param: returns only matching, omitting returns all
- Frontend tests (`ui/src/test/index.test.tsx`): add `location` to Reference type test objects

### Seed data (`cave/management/commands/load_test_data.py`)
- Add helper `_location_for_region(region_name)` mapping to two values: "Maison principale" (Mâcon, Bourgogne, Beaujolais, Jura, Bugey, Savoie, Alsace) and "Résidence secondaire" (others)
- Pass computed `location` to `Reference.objects.get_or_create` defaults in `create_references`

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
