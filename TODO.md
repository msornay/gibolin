# TODO

## Clever Cloud deployment

- Make `settings.py` production-ready: read `SECRET_KEY`, `DEBUG`, `ALLOWED_HOSTS` from env vars (keep dev defaults for local). Map Clever Cloud's `POSTGRESQL_ADDON_*` env vars with fallback to current `POSTGRES_*` vars.
- Add `clevercloud/python.json` with deploy config (`CC_PYTHON_MODULE` for gunicorn, `CC_PYTHON_MANAGE_TASKS` for migrate + collectstatic)
- Add `CC_PRE_BUILD_HOOK` documentation for building the frontend (`cd ui && npm install && npm run build`)
