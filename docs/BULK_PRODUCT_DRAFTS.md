# Bulk Product drafts

## Contract

Source Products → Create Product Drafts opens a large review of the current **complete** query. It includes all current server filters, search field/text and sort; the original visible page number is not a selection limit. Review pages hold 20 rows. All matching rows start selected, with `all=true` and only deselected IDs in `exceptions`. Clear Selection switches to `all=false`, where exceptions are explicitly selected IDs. Select All clears exceptions. Prefix previews update locally and no Product is written before final confirmation.

Names use trimmed prefix + ` - ` + trimmed Source Name, or trimmed Source Name alone. Normal Product validation (including 200-character Name maximum) is reused. Invalid generated names produce individual failures. No truncation or Source mutation. One Source may have many Products; existing counts are informational. Hidden and every other normal base default come from the ordinary Product repository/schema. No dependent rows are created.

## API

- `GET /cpanel/api/products/bulk-drafts/review?<existing Source query>`: creates a read-only review token with matched count; no database mutation.
- `GET /.../:token?page=N`: current matching Source identities, names and existing Product counts; 20 rows/page.
- `POST /.../:token`: `{all:boolean,exceptions:string[],prefix:string}` under CSRF, returns 202 plus current state. No arbitrary query or identity override is accepted here.
- `GET /.../:token/status`: review/running/done, created/failed/total, at most 20 safe source-ID/error-code details, uncertainty flag. UI maps errors through database translations.

Every path requires source_products.view AND products.create, with session ownership. Every Product transaction rechecks both. Source selection exceptions must exist inside the authoritative final query. Final membership is fixed in one PostgreSQL repeatable-read snapshot and held cursor, then processed in 100-ID chunks; each Product commits independently through the same createBase service used by normal Create. This avoids a giant write transaction and avoids connection filters changing membership as drafts are created. Source Name is re-read/locked when its Product is created. No browser-per-Product requests, all-table browser array, new job table or relation state.

## Idempotency and operational limits

Tokens are process-local and bound to actor + exact session. Same-token/same-body submissions never rerun creation; different bodies conflict. UI disables duplicate confirmation and uses retry only to recover the same operation's status/submission. Failed rows are not automatically retried. Selecting them deliberately in a fresh review is a new operation.

This follows the current single-app-process deployment contract. Restart invalidates tokens, fails closed and never restarts an unknown operation. Already committed drafts survive. After restart, expiry or an explicitly uncertain database acknowledgement, inspect Products before creating again; do not claim durable resumability. Review TTL 15 minutes; completed summary TTL one hour. Running operations are not TTL-evicted. Two concurrent operations maximum; 500 retained tokens maximum / 20 per actor, lazy expiration cleanup. Mutation JSON retains the existing 512 KB bound; exception list cap 20,000 IDs does not limit an all-selected query's size.

Ordinary per-source validation failure increments Failed and continues. Permission loss stops remaining work. Unexpected database/transport failures stop and flag uncertainty rather than blindly retry possibly committed inserts. Summary contains only acknowledged Created; remaining unprocessed/failed records are Failed, with uncertainty explicitly shown where applicable.

No comparable Product audit-event subsystem exists. The usual Product created_by/updated_by attribution is retained. No audit table invented.

## Files and verification

Backend: `src/products/bulk-drafts.ts`, controller and Product API routes; extracted shared Source filter compiler and reusable Product createBase. UI: `source-products/bulk-drafts.js` and `bulk-product-drafts.ejs`. Localization migration 079 adds 14 keys / 42 real values.

Focused tests: `tests/bulk-product-drafts.spec.ts` (review selection/prefix/persistence; filter/permissions/CSRF; chunked creation/partial failure/idempotency). Related tests exercise changed Source query compilation and ordinary Product Create plus fresh migration/localization integrity. Live tm/ru/en uses `scripts/verify-bulk-drafts-localization.ts` and disposable fixtures only. Unrelated historical modules are intentionally not rerun.

### Verification result

- New production browser/API scenarios: **3/3 PASS**, including UI partial-error details, exact combined filters, more than one review page, a 124-source final snapshot processed across chunks (123 created, one validation failure), and concurrent/repeated same-token submissions without duplicates.
- Related targeted checks: **7/7 PASS** (three Source SQL filter/query checks; existing Product Create/defaults and source diagnostics checks; two fresh-migration/localization integrity checks).
- Current database integrity: **741 used UI keys** with real tm/ru/en values; migration 079 applied, live cache refreshed, all three languages verified in browser with disposable single-item creations.
- `npm run build` and `git diff --check`: **PASS**.
- Historical Catalog CRUD, Vendor synchronization, Stock, Media, Profile and Users suites were intentionally not executed; their implementation is untouched. No full-regression claim.
