# Products UI review

Route: `GET /cpanel/products`, authenticated and guarded by `products.view`. The sidebar roadmap remains disabled. No Product mutation endpoints or schema changes.

- Grid/List, immediate local search by effective Product name/source/vendor, visibility/vendor/brand/category/stock filters.
- Searchable paginated source picker has 60 mock sources and shows vendor, price/currency, stock, active state and existing-Product state.
- Create requires Name and Source, assigns `mock-*` identity, remains open, unlocks seven tabs and locks Source. Hidden by default.
- Basic, SEO, Description, Visibility, Price Rules, Discounts and Gallery save independently in page memory. Inline name/SEO/short-description/HTML-description translations save independently and use the active language registry. HTML review uses the existing authenticated CSRF-protected sanitizer preview endpoint; no Product storage.
- Visibility diagnostics show representative mock conditions and result, not a finalized backend formula. Brand/category A/B are review placeholders.
- Price preview demonstrates normalization and a single optional rule. A displayed discounted price is illustrative, not a Discount engine.
- Discount attach/detach is mock-only, no duplicates, automatic priority DESC, no manual ordering.
- Gallery uses real reusable Media Picker; references are page-local, zero/one Primary, reorder preserves Primary, removal unlinks only. Explicit Picker upload retains the existing real Media upload behavior and notice.
- Permissions prepare Products access/create/update/visibility and reuse Media view/upload. No new Delete permission. Backend enforcement of future mutations awaits its separate stage.

Implementation: products controller and view/content, `products.js` and `products.css`; existing route/layout/language-return integration; centralized permission registry; translation migration 067. No Product repository/service.

Verification is deliberately limited to Products UI, registry metadata, fresh localization integrity, live tm/ru/en and build. Historical catalog, Vendor Sync, Stock, Orders and other domain suites are excluded because their implementations are untouched.

## Executed verification

- `TEST_PRODUCTION=1 CHROME_PATH=/usr/bin/google-chrome npx playwright test tests/products.spec.ts --project=core`: **2/2 PASS**. Consolidated create/independent save/source lock/HTML/visibility/price/discount/Gallery/theme/mobile workflow and authenticated permission/read-only scenario. Gallery fixtures pass through the real Picker component with intercepted read responses; no physical Media test files were created. Product row count unchanged. Failed preview keeps edits dirty; retry succeeds.
- Targeted `database.test.ts` / `permission-registry.test.ts` name-filter run: **6/6 PASS**, including fresh migration seeds, complete UI key coverage and authorization registry inventory.
- `npm run localization:check`: **671 used keys PASS**. Migration 067 applied to current development database, cache refreshed. `npm run localization:verify -- --scope=products`: **tm/ru/en PASS** against the actual running server, including language return route.
- `npm run build`: **PASS**. Compiled production server used by browser tests. `git diff --check` and Product JavaScript syntax: **PASS**.
- Inspected light/dark/mobile screenshots under `artifacts/products-*.png`.

Read-only test exposed a card dropdown overlapping the sidebar; moving the trigger to the card's upper-right resolved it and both final scenarios pass. No outstanding implementation failure. Review limitations remain intentional: mock data and page-memory saves, placeholder Brand/Category relationship UI, representative pricing/visibility, disabled roadmap entry pending activation.
