# Gibolin

Wine cellar management app. Track inventory, purchases, pricing, and export printable menus.

## Stack

- **API**: Django 5 + Django Ninja, PostgreSQL
- **UI**: React 18 + TypeScript, Vite, Ant Design, TanStack Query
- **Infra**: Docker Compose (dev), Clever Cloud (prod)

## Quick start

```bash
make up              # start all services (API :8000, UI :3000)
make seed-db         # load sample data
```

Open http://localhost:3000.

## Development

```bash
make test            # run all tests (API + UI)
make test-api        # Django tests only
make test-ui         # Vitest only
make lint            # ruff check on Python code
make reset-with-data # destroy volumes, reseed
```

## Deployment

See [DEPLOY.md](DEPLOY.md) for Clever Cloud setup.

```bash
make deploy          # clever deploy
```
