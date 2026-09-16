# Source Products activation

The approved UI now reads existing source_products/vendors/currencies/measures/product_barcodes/product_stocks/warehouses/products. The former UI review report is historical; production no longer imports mock fixtures.

## Contracts

- GET `/cpanel/source-products`: shell page, `source_products.view`.
- GET `/cpanel/api/source-products`: list/query, same permission.
- GET `/cpanel/api/source-products/:id`: real read-only details, same permission.
- GET `/cpanel/api/source-products/options`: bounded reference options, same permission.
- No mutations, CSRF-only fake APIs, source editing, Product creation or Attach/Detach.

List parameters: `field` (name default, all, source_id, barcode, property_1..5), `query` (200 characters), `vendor`, `currency`, `measure` (positive bigint IDs), `active` (empty/active/inactive), `stock` (empty/in/out), `connection` (empty/has/none), property_1..5 substring filters, `page` (positive integer up to seven digits), `sort` (name/name_desc). Unknown fields/arrays/invalid enums/IDs are rejected. Search uses escaped parameterized ILIKE; only explicit allowlisted column names enter SQL. String source IDs are never numeric-cast.

Pagination: 12 rows, requested page clamped to the last valid page. Name plus ID ordering is deterministic; Grid/List share state. Response: rows,total,page,pageSize. Count and rows use a read-only repeatable-read snapshot. List returns safe identity/reference objects, exact price/stock decimal strings, real Product count, barcode count/preview. Details adds all barcodes and warehouse quantities. No Vendor credentials/path/internal payload is exposed.

Options: `kind=vendor|currency|measure`, optional query, vendor and selected ID; 50 records with hasMore indication. Vendor uses searchable native suggestions with explicit IDs (duplicate names remain distinct); Currency/Measure provide search above the existing selector and Vendor-qualified labels. All selected values are IDs. Search/filters/page/sort live in URL and support refresh/history. Browser requests use cancellation/generation guards.

## Aggregation and scope

Stock sums existing product_stocks for the source/vendor; no stock recalculation or negative clamp. Product count independently counts products.source_product_id. Barcode search uses EXISTS. References use Vendor-scoped joins. These do not multiply source rows, aggregates or page totals. No denormalized counters or new domain tables.

Migration 069 adds `(name,id)` and `(vendor_id,name,id)` indexes after inspection of existing indexes; existing barcode/stock/Product foreign-key indexes are reused. Arbitrary substring and deep OFFSET searches can still require scans at large scale; no performance claims beyond tested data or speculative external search engine.

Implementation: source-products/query.ts (validation), repository.ts (SQL/read-only snapshot), service.ts (reusable entry point), source-products-api controller; existing shell/UI switches to GET data. Old fixtures isolated under tests. Source navigation enabled under its own permission. No Vendor Sync/Stock/Storefront Products behavior changed.

## Verification

- Source SQL integration: 3/3 PASS (real fixtures in isolated schema; all fields/filters, combinations, barcode leading zeros, duplicate source IDs across Vendors, exact NUMERIC values, negative stock, multi-barcode/multi-warehouse/multi-Product aggregation, pagination, validation/denial and before/after source rows).
- Fresh migrations/localization: 2/2 PASS.
- Source navigation/roadmap integration: 2/2 PASS.
- Actual running-server localization: tm/ru/en PASS. Migration applied; running development process refreshed its cache through restart/reload workflow.
- Build: PASS. Compiled production application used by browser tests.
- Browser results recorded after the final run below. Historical Vendor Sync/Stock recalculation/Catalog regressions intentionally not executed: their implementations were not changed.

Deferred: source mutations, Create Storefront Product from Source, Storefront Products backend/redesign. Stop after activation.

Final browser run: **2/2 PASS** on compiled production server: real PostgreSQL page/details, same Grid/List state, URL refresh/back, leading-zero barcode query, connection filter, exact stock/counts, normal actor API denial/view-only access, and absent source mutation route. Temporary inactive Vendors and dependent fixtures were cleaned up. Final total: **9/9 selected checks PASS** (3 source SQL + 2 fresh migration/localization + 2 navigation + 2 browser); live tm/ru/en verification also passed. No known blocking issue.
