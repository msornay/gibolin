# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Gibolin is a wine cellar management application with a Django REST API backend and React TypeScript frontend, running in Docker containers.

## Development Commands

All commands are run via Docker Compose:

```bash
# Start all services (API on :8000, UI on :3000)
docker compose up

# Run all tests
make test

# Run API tests only
make test-api
# Or directly: docker compose run --rm api python manage.py test cave.tests

# Run UI tests only
make test-ui
# Or directly: docker compose run --rm ui npm run test:run

# Lint Python code
make lint

# Seed database with test data
make seed-db

# Full reset (destroy volumes and reseed)
make reset-with-data
```

## Architecture

### Backend (`api/`)
- Django 5 with Django Ninja for REST API
- Main app: `cave/` - wine reference management
- API endpoints mounted at `/api/` (see `gibolin/urls.py`)
- Models in `cave/models.py`: Category, Region, Appellation, Format, Grape, Reference, Purchase
- Grape is M2M on Reference; all others are FK lookup tables
- Orphaned lookups (not used by any reference) are auto-deleted on ref update/delete and at container startup (`cleanup_orphaned_lookups` command)
- All API logic in `cave/api.py` using Django Ninja schemas
- Uses sqids for encoding reference IDs in URLs

### Frontend (`ui/`)
- React 18 + TypeScript + Vite
- UI library: Ant Design
- State: TanStack Query for server state
- Forms: Ant Design Form
- Main app in `src/index.tsx` with ReferenceTable component
- Components in `src/components/`: reference-form, CreatableSelect, PrintTemplate
- CreatableSelect: type-to-search combobox with inline creation, supports single and `mode="multiple"`

### Data Flow
- Frontend calls Django Ninja API endpoints (`/api/refs`, `/api/categories`, etc.)
- References use sqid-encoded IDs for public URLs
- Categories, Regions, Appellations, Formats are FK lookup tables; Grapes is M2M

### Search
- Accent-insensitive using PostgreSQL `unaccent` extension
- Multi-word: "Macon Lave" matches records where ALL words appear (in any field)
- Searches across: name, domain, category, region, appellation, format, grapes, notes
- Config: `django.contrib.postgres` in `INSTALLED_APPS`, `simple_unaccent` in `postgres/init.sql`

### Retail Price
- Each reference has `price_multiplier` (default 3) and optional `retail_price_override`
- Computed: `ceil(avg_purchase_price × multiplier)` rounded up to nearest euro
- Override takes precedence if set
- Used in exported menu

### Menu Export (`/api/export/html`)
- Generates printable HTML wine menu
- References with `hidden_from_menu=true` are excluded
- Eye icon toggle in table (dimmed rows = hidden)
- Prices shown from computed retail_price

