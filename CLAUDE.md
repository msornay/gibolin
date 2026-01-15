# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Gibolin is a wine cellar management application with a Django REST API backend and React TypeScript frontend, running in Docker containers.

## Development Commands

All commands are run via Docker Compose:

```bash
# Start all services (API on :8000, UI on :3000)
docker-compose up

# Run all tests
make test

# Run API tests only
make test-api
# Or directly: docker-compose run --rm api python manage.py test cave.tests

# Run UI tests only
make test-ui
# Or directly: docker-compose run --rm ui npm run test:run

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
- Models in `cave/models.py`: Category, Region, Appellation, Reference, Purchase
- All API logic in `cave/api.py` using Django Ninja schemas
- Uses sqids for encoding reference IDs in URLs

### Frontend (`ui/`)
- React 18 + TypeScript + Vite
- UI library: Ant Design
- State: TanStack Query for server state
- Forms: react-hook-form + zod validation
- Main app in `src/index.tsx` with ReferenceTable component
- Components in `src/components/`: ReferenceDetails form, PrintTemplate

### Data Flow
- Frontend calls Django Ninja API endpoints (`/api/refs`, `/api/categories`, etc.)
- References use sqid-encoded IDs for public URLs
- Categories, Regions, Appellations are lookup tables with ordering support

### Search
- Accent-insensitive search using PostgreSQL `unaccent` extension
- Searches across: name, domain, category, region, appellation
- Requires `django.contrib.postgres` in `INSTALLED_APPS`
- Text search config `simple_unaccent` created in `postgres/init.sql`

## Planned: Offline Support (PWA)

To support quantity updates in cellars with no signal, implement PWA with Service Worker:

### Architecture
- **vite-plugin-pwa** - Service worker generation and app shell caching
- **IndexedDB sync queue** - Stores pending quantity updates when offline
- **Optimistic UI** - Quantities update immediately, sync when online
- **Last-write-wins** - Conflicts resolved by timestamp

### Key Files to Create
| File | Purpose |
|------|---------|
| `ui/vite.config.ts` | Add VitePWA plugin config |
| `ui/public/manifest.webmanifest` | PWA manifest (name, icons, theme) |
| `ui/src/lib/offline-queue.ts` | IndexedDB queue for pending updates |
| `ui/src/lib/api.ts` | Centralized API with relative URLs |
| `ui/src/hooks/useOnlineStatus.ts` | Online/offline detection + sync trigger |

### Dependencies to Add
```bash
npm install vite-plugin-pwa workbox-window idb
```

### Scope
- **Supported offline:** Quantity updates only
- **Not supported offline:** Creating/editing references, purchases
