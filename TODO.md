# TODO

- Remove Playwright tests
- Replace hardcoded `http://localhost:8000` API base URL in `ui/src/index.tsx` and `ui/src/components/reference-form.tsx` with a configurable base URL (e.g. env var `VITE_API_BASE_URL` or relative URLs)
- Fix quantity button width in the quick action column (`ui/src/index.tsx`) — it's not fixed-width, looks inconsistent across rows
- Simplify menu ordering: drop the `order` integer fields from Category/Region/Appellation and the related endpoints (`/categories/order`, `/regions/order`, `/appellations/order`, `/menu/order`), making the `MenuTemplate` text the single source of truth for menu order
