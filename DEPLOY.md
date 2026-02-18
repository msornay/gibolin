# Deploying to Clever Cloud

These are the human-only steps. Code changes (settings, whitenoise, gunicorn, etc.) must be done first — see TODO.md.

## 1. Create the app

```bash
clever create gibolin --type python
```

Or use the console: create a **Python** application.

## 2. Create and link PostgreSQL

```bash
clever addon create postgresql-addon --plan dev gibolin-pg
clever addon link gibolin-pg
```

This injects `POSTGRESQL_ADDON_HOST`, `POSTGRESQL_ADDON_PORT`, `POSTGRESQL_ADDON_DB`, `POSTGRESQL_ADDON_USER`, `POSTGRESQL_ADDON_PASSWORD` automatically.

## 3. Set environment variables

```bash
clever env set SECRET_KEY "$(python3 -c 'import secrets; print(secrets.token_urlsafe(50))')"
clever env set DEBUG "false"
clever env set ALLOWED_HOSTS "gibolin.cleverapps.io"
clever env set CC_PYTHON_MODULE "gibolin.wsgi:application"
clever env set CC_PRE_BUILD_HOOK "cd ui && npm install && npm run build"
```

Adjust `ALLOWED_HOSTS` if using a custom domain.

## 4. Deploy

```bash
clever deploy
```

Or push to the Clever Cloud git remote.

## 5. Verify unaccent extension

Connect to the database and check:

```sql
SELECT extname FROM pg_extension WHERE extname = 'unaccent';
```

If missing, the search will break on accented characters. On Clever Cloud managed PostgreSQL, `CREATE EXTENSION unaccent` should work — run it via:

```bash
clever pg psql
CREATE EXTENSION IF NOT EXISTS unaccent;
```

Also ensure the `simple_unaccent` text search config exists (see `postgres/init.sql` for the definition).

## 6. Seed data (optional)

```bash
clever ssh
python manage.py seed_db
```

Or use the admin at `https://gibolin.cleverapps.io/admin/`.
