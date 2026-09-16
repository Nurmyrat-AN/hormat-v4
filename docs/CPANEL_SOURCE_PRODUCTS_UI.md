# Source Products UI review

## Scope and access

`GET /cpanel/source-products` is a UI-only browser protected by authentication and `source_products.view`. Super User uses the existing permission bypass. The navigation roadmap item remains disabled; open the direct route for review. No Add, Delete, source editing or storefront Product creation.

Thirty-six isolated review fixtures reflect the existing synchronized schema. Product counts (0/1/2), prices, properties, barcodes and per-warehouse stock are explicitly mock data. No source database reads/writes, new API, stock calculation, source schema change or synchronization changes were introduced. Products UI is left unchanged and further work is postponed.

## Interaction

- Shared Grid/List dataset; 12 results per page, browser-local view preference.
- 300 ms debounced identity search: Name (default), Source ID, Barcode, Properties 1–5, All fields. All fields includes only those identity values, not internal IDs/price/stock.
- Inline collapsible filter panel: searchable Vendor suggestions, All/Active/Inactive, Vendor-scoped Currency/Measure choices, positive/nonpositive Stock, Has Product/No Product and compact property filters.
- Filters combine with search using AND. Active count and chips remain visible when the panel is closed. Clear Filters preserves search text and selected search field.
- Cards show source identity/vendor, price/currency/measure, stock/status, barcode summary and connected Product count. List presents the same data in dense columns; narrow screens use stacked rows without page overflow.
- Clicking the Name or Details opens a read-only dialog with Basic Information, Stock, Barcodes, Properties and Products. Missing values are localized. Products is informational only; footer contains Close only.

## Reuse and files

- `src/public/cpanel/js/source-products/query.js`: DOM-independent initial state, filter reset/count and identity/filter matcher for future reuse by a source picker. This is a UI contract, not a frozen backend query implementation.
- `src/public/cpanel/js/source-products/fixtures.js`: isolated demonstration records.
- `src/public/cpanel/js/source-products.js` and `css/source-products.css`: browser interactions/presentation.
- `src/controllers/cpanel/source-products.ts`, `views/cpanel/pages/source-products*.ejs`: shell page.
- Existing route/layout/language return allowlist and centralized permission registry extended; no shared core behavior rewritten.
- `068_source_products_ui_translations.sql`: 33 new semantic keys with real tm/ru/en values. Applied to development DB and running cache refreshed.

## Actual verification

- `tests/source-products.spec.ts` on compiled production application: **2/2 PASS**. All search fields, filter types, combination, count/reset, pagination/Grid/List, five Details sections, no mutable controls, theme/mobile, authentication and view permission. Browser module sends no mutation requests; POST to the page is not implemented.
- `tests/unit/source-products-query.test.ts`: **2/2 PASS**, including exclusion of internal/numeric search fields and negative-stock filtering.
- Targeted fresh migration/localization and permission-registry checks: **4/4 PASS**. Combined selected unit run: **6/6 PASS**.
- `npm run localization:check`: **704 current UI keys PASS**. `npm run localization:verify -- --scope=source-products`: **tm/ru/en PASS** against the actual development server, including topbar language return routing.
- `npm run build`: **PASS**. Light/dark/mobile screenshots inspected: `artifacts/source-products-{light,dark,mobile}.png`.
- Historical Products/Catalog/Media/Vendor Sync/Stock and other domain suites intentionally not run: none of those implementations changed.

No known blocking UI issue. Live synchronized browsing and real Product relationships remain for a separately approved backend activation stage. Ready for UI review; stop here.
