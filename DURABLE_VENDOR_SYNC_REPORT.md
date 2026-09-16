# Durable CouchDB Source Sync & Stock Foundation — verification report

## Scope and implementation

Implemented the approved durable mapping for warehouses, measures, currencies, Source Products/barcodes and transaction-derived stock. The existing SyncManager/Nano/decoder infrastructure is reused. No HORMAT Products domain, Source Products UI, navigation activation, accounting balances, destructive reset, new business routes or socket events were added.

The owner's supplied requirements end at section 184; the owner confirmed that this is the complete task and instructed the agent to stop after completion.

### Storage

Migration 028 adds the exact 26-row transaction type registry, document-level source stock snapshots and a minimal persistent Vendor/source-URL binding. The binding is necessary for safe URL-change detection after restart; no frozen Vendor column was added. Existing seven source/foundation tables retain their schema.

All approved source IDs are exact Vendor-scoped strings. PostgreSQL FKs use internal identity IDs. The snapshot uniqueness is `(vendor_id, source_document_id, product_id, warehouse_id)`.

### Confirmed real source fields

- Main currency: `ayar_umum.paraAdi` (`TMT` in Vendor 97), materialized as `z_walyuta-1`.
- Measure: all 11,960 observed products' `OlcuBirimi` values matched actual `olc_umum._id`. Exact ID lookup is implemented.
- Price: `temelSatisFiyati` only, no rounding to two decimals.
- Activity: numeric `StatusIsAktif === 1` only.
- Properties: exact `OzelKod1..5` strings; barcode arrays use replacement/deduplication.
- Quantity: `esasOlc_SayisiToplam`, exclusively.
- Wrong transaction: numeric `lst_fatura[].sluj_isYanlis === 1` suppresses only that transaction.
- Nested transaction/line IDs can be empty or position-derived; correctness therefore uses the parent document aggregate, not array indices.
- Observed operation dates have no timezone. `date_last_operation` deliberately remains unchanged; no time zone or lag is invented.

### Correctness and lifecycle

One PostgreSQL transaction commits each batch's references/products/barcodes, stock deltas, snapshot replacement, checkpoint and sync timestamp. SQL NUMERIC computes NEW−OLD and atomically updates stock in deterministic product/warehouse order. A Vendor row lock protects cross-process snapshot/checkpoint correctness; stale writers are rejected.

Bootstrap first prepares references without advancing checkpoint, then consumes the full changes stream from zero. Bounded bulk dependency reads resolve products/references that appear later in source order. No placeholders, `since=now`, or permanent raw-document queue are used. Changes between passes remain covered by the normal pass/tail.

Restart/reconnect reload the PostgreSQL checkpoint, including after an uncertain COMMIT acknowledgement. Deactivation preserves data. Different URL bindings fail closed with `SOURCE_CHANGED`; no incompatible reuse, reset or stock erasure occurs.

Deleted transaction snapshots reverse exactly once. Deleted products/references are retained unchanged, preserving FKs, barcodes, current activity and any existing HORMAT Product relationship. Negative and zero stock rows are preserved.

## Files changed for this stage

- `src/database/migrations/028_durable_sync.sql`
- `src/vendors/sync/mapping.ts`
- `src/vendors/sync/durable-repository.ts`
- `src/vendors/sync/durable.ts`
- `src/vendors/sync/{transport,worker,manager,index,repository}.ts`
- `tests/unit/durable-sync.test.ts`
- `tests/unit/{vendor-sync,vendors,database}.test.ts`
- `tests/vendors.spec.ts`
- `docs/DURABLE_VENDOR_SYNC.md`
- `docs/{ARCHITECTURE,VENDOR_SYNC,SYNC_STORAGE}.md`
- `README.md`
- local `.env`: enabled the approved development sync (secret configuration remains ignored)
- this report

Existing unrelated working-tree changes were preserved. No credentials or raw decoded documents were added to reports.

## Verification

The new 34-test durable suite covers mapping/identity, all eight fatura effect types, sparse/default values, barcode replacement, wrong/restore/quantity/product/warehouse/type/transfer edits, line add/remove/reorder, repeated replay, document deletion/replay, decimal/negative/zero stock, Vendor isolation, missing dependencies, malformed input and decode failures, transaction rollback at snapshot/checkpoint writes, bootstrap ordering/concurrent changes, source binding, real manager lifecycle, lost acknowledgement and concurrent SQL updates.

Related checks include legacy decoding/inventory, Nano query/auth/abort/bulk lookup, scheduler/SyncManager, seven-table integrity, Vendor CRUD/events/credentials and fresh migrations/localization/startup. The combined run passed **75 tests**. After the final tombstone/sequence hardening, **38 durable + decoder tests** passed (including one additional durable test); the strengthened production-start Vendor suite separately passed **12 tests**. The migration was also applied to the current development database.

Browser verification passed **9 Vendor/navigation tests**; the added explicit date/lag checks then passed in **3 tm/ru/en browser scenarios**. These include light/dark, desktop/mobile, Grid/List, authorization, CSRF, language switching and safe credential presentation. `npm run localization:check` passed for all **324 UI keys** in tm/ru/en. The final production build passed. Live catch-up results follow below. No full historical regression is claimed. Deep Media/Profile/Users suites were intentionally not run: no code in those domains or their auth/permission/media core changed. Existing tests remain intact. The selected scope covers the changed synchronization, schema, Vendor integration and presentation paths.

## Operational limits

See [durable synchronization contract](docs/DURABLE_VENDOR_SYNC.md) for exact bootstrap/dependency bounds and error behavior. A continuously busy source that never reaches an empty reference-prepass response may require a future bounded-boundary bootstrap enhancement. Unknown transaction types, missing required dependencies or malformed source data block checkpoint progression until corrected. Remote replacement at an unchanged URL is not detected by URL binding. There is no reset/rebuild UI.

This stage adds no visible interface strings; existing tm/ru/en database localization is reused. Transaction registry names are internal owner-supplied configuration, not hardcoded UI labels.

## Real development database activation

With explicit owner approval, Vendor **97** was changed from the server root URL to `http://192.168.1.164:5984/elitedb` before the first source binding/checkpoint. The narrowly scoped maintenance UPDATE required a null checkpoint and absent binding and did not modify credentials or runtime fields. The first synchronization then used the ordinary durable manager/processor against that configured database.

The two passes read **450,052** changes in total; the main pass durably handled **225,026** source changes. Catch-up completed without error in **392.420 seconds**. Final Vendor 97 state:

| Table | Rows |
| --- | ---: |
| warehouses | 33 |
| measures | 5 |
| currencies | 3 |
| source_products | 11,960 |
| product_barcodes | 11,960 |
| product_stocks | 15,171 |
| source_stock_movements | 97,569 |

All aggregate stock rows equal the exact PostgreSQL sum of their document snapshots: **0 mismatches**. There are **380 negative** and **7,464 zero** stock rows, preserved without clamping/cleanup. The minimal HORMAT `products` table still contains **0 rows**.

A separate controlled bulk read compared **25 actual source products** with PostgreSQL name, price, activity, measure/currency references, all five properties and barcode sets: **0 mismatches**. Secrets/raw decoded documents were not exported.

An independent manager restart resumed from the persisted checkpoint, consumed **0 additional changes**, completed its catch-up check in **2.119 seconds**, and left all counts/stock unchanged. No historical replay/bootstrap was performed on that restart.

Local `.env` now has `VENDOR_SYNC_ENABLED=true`, as authorized for this Vendor activation. The existing development watcher was notified to reload configuration; `.env.example` retains the safe opt-in default for other environments. The existing UI continues to show persisted Last Sync, with Last Operation/Lag unpopulated when no approved operation timestamp exists.

## Final confirmations

- Durable reference/product/barcode/stock mapping: implemented and exercised against the real source.
- Atomic checkpoint and replay safety: verified with PostgreSQL tests and actual restart.
- Any HORMAT Products created automatically: **No**.
- Source Products/Products UI, accounting balances, destructive reset or extra cancellation rules implemented: **No**.
- Source measure mapping unresolved: **No**; exact IDs were verified against all observed products.
- Operation-date timezone semantics resolved: **No**; this allowed diagnostic limitation is documented and the field remains unchanged.
- Full historical regression claimed: **No**; targeted test scope and actual commands/results are recorded above.
- Known test/build failures: **None**.

The implementation is ready for review. No next module/stage is started.

### Executed verification commands

```sh
npm run build
TEST_PRODUCTION=1 node --import tsx --test tests/unit/durable-sync.test.ts tests/unit/vendor-sync.test.ts tests/unit/couchdb-analysis.test.ts tests/unit/sync-storage.test.ts tests/unit/vendors.test.ts tests/unit/database.test.ts
TEST_PRODUCTION=1 node --import tsx --test tests/unit/vendors.test.ts
node --import tsx --test tests/unit/durable-sync.test.ts tests/unit/couchdb-analysis.test.ts
TEST_PRODUCTION=1 CHROME_PATH=/usr/bin/google-chrome node node_modules/@playwright/test/cli.js test tests/vendors.spec.ts tests/vendors-navigation.spec.ts --project=core
TEST_PRODUCTION=1 CHROME_PATH=/usr/bin/google-chrome node node_modules/@playwright/test/cli.js test tests/vendors.spec.ts --project=core --grep "Vendors (tm|ru|en)"
npm run db:migrate
npm run localization:check
git diff --check
```

Final operational verification confirmed that the existing development server restarted, `GET /health` returned **200**, and that same Node process held an established connection to the configured CouchDB source. The one-off catch-up/verification managers were stopped; the normal application owns ongoing synchronization.
