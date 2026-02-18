# TODO

- Remove Playwright tests
- Replace hardcoded `http://localhost:8000` API base URL in `ui/src/index.tsx` and `ui/src/components/reference-form.tsx` with a configurable base URL (e.g. env var `VITE_API_BASE_URL` or relative URLs)
- Fix quantity button width in the quick action column (`ui/src/index.tsx`) — it's not fixed-width, looks inconsistent across rows
- Simplify menu ordering: drop the `order` integer fields from Category/Region/Appellation and the related endpoints (`/categories/order`, `/regions/order`, `/appellations/order`, `/menu/order`), making the `MenuTemplate` text the single source of truth for menu order

## Clever Cloud deployment

- Make `settings.py` production-ready: read `SECRET_KEY`, `DEBUG`, `ALLOWED_HOSTS` from env vars (keep dev defaults for local). Map Clever Cloud's `POSTGRESQL_ADDON_*` env vars with fallback to current `POSTGRES_*` vars.
- Add `whitenoise` to serve static files in production (add to `requirements.txt`, add middleware after `SecurityMiddleware`, configure `STATICFILES_DIRS` to include `../ui/dist`)
- Add `gunicorn` to `requirements.txt`
- Add catch-all view in `urls.py` to serve `index.html` for SPA routing (so frontend is served by Django)
- Fix CORS: replace `CORS_ALLOW_ALL_ORIGINS = True` with env-based `CORS_ALLOWED_ORIGINS` (see `XXX` comment in `settings.py`)
- Add `clevercloud/python.json` with deploy config (`CC_PYTHON_MODULE` for gunicorn, `CC_PYTHON_MANAGE_TASKS` for migrate + collectstatic)
- Add `CC_PRE_BUILD_HOOK` documentation for building the frontend (`cd ui && npm install && npm run build`)
