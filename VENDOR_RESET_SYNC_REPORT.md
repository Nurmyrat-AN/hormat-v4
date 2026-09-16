# HORMAT V4 — Vendor Reset Sync Data: completion report

## Result and scope

Implemented the administrative **Reset Sync Data** operation for one selected Vendor. It resets synchronization progress and rebuilds derived stock while retaining synchronized source/reference entities and their relationships. Source Products UI was not started. No Media behavior, Vendor credentials, CRUD fields, or navigation availability was changed.

## Implementation

1. **Menu action:** the existing Vendor three-dot menu now contains Reset Sync Data when the actor has the effective reset permission. The existing Grid/List implementation and shared dialog remain in use.
2. **Permission:** registered assignable boolean `vendors.reset_sync` in the central Vendors permission group. It automatically appears in Permissions Management. Exact JSON `true` grants; missing/false/string/number/null deny. Update/status/view do not grant reset. Super User needs no individual reset row.
3. **Endpoint:** `POST /cpanel/api/vendors/:id/reset-sync`, empty JSON body `{}`. Existing authentication, independent reset authorization, CSRF and bounded JSON parsing apply. Unexpected body/query fields, target overrides and invalid IDs are rejected. The screen itself still requires `vendors.view`; direct reset requires only its own independent permission.
4. **Service architecture:** thin controller → `VendorSyncResetService` → existing authorized repository transaction and `VendorSyncManager.withPausedVendor`. SQL and lifecycle rules do not live in EJS/controllers.
5. **Stop/lock:** the manager reserves a per-Vendor gate before awaiting work. It waits for pending reconciliation, aborts and awaits that Vendor's worker, including the active durable batch/transaction, and clears in-memory progress. Configuration notifications are coalesced while paused. Other Vendors remain running. Shutdown waits for reserved resets before closing PostgreSQL.
6. **Tables cleared:** only selected-Vendor rows in `product_stocks` and `source_stock_movements`. Both deletes occur in the same transaction under the Vendor row lock; no TRUNCATE is used.
7. **Tables preserved:** `vendors`, `warehouses`, `currencies`, `measures`, `source_products`, `product_barcodes`, `products`, `transaction_types`. The source binding in `vendor_sync_sources` is retained too. A fresh null-checkpoint Vendor receives its normal source binding atomically.
8. **Checkpoint:** text `last_sequence = '0'`.
9. **Dates:** `date_last_sync = NULL`, `date_last_operation = NULL`.
10. **Active Vendor:** reload current authoritative configuration and start exactly one worker from the persisted zero checkpoint, subject to the existing global synchronization enable setting. Initial credential/transport setup is explicitly acknowledged before reporting normal restart scheduling.
11. **Inactive Vendor:** remains inactive with no worker, empty derived state and checkpoint zero until activation.
12. **Isolation:** every delete/update is Vendor-scoped. Tests confirm Vendor B's rows/checkpoint/dates and running worker are unaffected by resetting A.
13. **Rollback:** stop failure prevents any reset. SQL failure rolls back deletes/checkpoint/dates together. The manager attempts to restore the worker from original persisted progress/current configuration. Authority is checked before pausing and again inside the transaction.
14. **Restart failure:** a committed reset is never undone. Response `VENDOR_RESET_RESTART_PENDING` explicitly says reset completed but synchronization restart is pending, and that another reset is unnecessary. Existing bounded configuration retries recover transient lookup failures. Permanent credential errors retain the existing runtime error state until corrected. Active Vendor with globally disabled sync also receives the pending result.
15. **Replay:** zero/null checkpoint performs the existing bounded reference prepass, then normal durable replay from zero. Clearing OLD snapshots together with stock prevents replay from cancelling its own historical effects. Tests prove purchase +10 and sale −3 rebuild to 7; an OLD −10 movement replays to −10, not zero.
16. **Source Product IDs:** reset leaves them unchanged; replay UPSERT reuses them. Reference identities and source fields also remain present.
17. **Products FK:** an existing `products.source_product_id` still points to the same Source Product before reset, after reset and after replay.
18. **Permission verification:** independent exact grant, missing/invalid denial, Super User bypass, revoked session/permission, and revocation during pause tested. Unauthorized requests do not pause a worker. UI action disappears on subsequent permission evaluation.
19. **CSRF verification:** missing/invalid tokens denied without data changes, both browser API and enabled production HTTP fixtures. Valid token succeeds.
20. **Concurrency verification:** duplicate reset rejected with safe HTTP 409 while the gate is held; reset during a held batch waits; lifecycle refresh cannot start a duplicate; shutdown waits safely. Tests cover stop failure, transaction failures at both deletion/checkpoint stages, failed configuration restart and failed credential decryption.

## UI and localization

The confirmation names the actual selected Vendor and explains temporary stop, cleared calculated stock, cleared applied movements, sequence zero, cleared dates, active/inactive replay, and all retained source/reference/HORMAT entities. Cancel is separate; confirmation uses the existing Bootstrap danger button and warning surface. During submission, confirmation/dismissal controls are disabled. Errors permit safe retry; completion refreshes the existing filtered dataset.

Migration **029_vendor_reset_translations.sql** adds **14 semantic keys / 42 real PostgreSQL values**, covering Turkmen, Russian and English:

- `cpanel.vendors.resetSync`
- `cpanel.vendors.resetTitle`
- `cpanel.vendors.resetPause`
- `cpanel.vendors.resetStock`
- `cpanel.vendors.resetMovements`
- `cpanel.vendors.resetCheckpoint`
- `cpanel.vendors.resetDates`
- `cpanel.vendors.resetReplay`
- `cpanel.vendors.resetKeep`
- `cpanel.vendors.resetCompleted`
- `cpanel.vendors.resetRestartPending`
- `cpanel.vendors.resetBusy`
- `cpanel.vendors.resetFailed`
- `cpanel.vendors.resetSourceChanged`

Existing generic cancel/close/working, permission-denied and invalid-request translations are reused. Migration applied to the development DB. Running localization cache was reloaded, and subsequent source restarts loaded the same updated DB. No JSON/TypeScript translation dictionaries were added.

Browser verification covers all three languages, light/dark themes, 1440px desktop and 375px mobile, Grid/List access, full confirmation content, cancellation, loading/duplicate prevention, safe failure/retry and real persistence. Screenshots are in `artifacts/vendor-reset-{tm,ru,en}-{light,dark}-{1440,375}.png`. No visible semantic keys were found.

## Verification actually executed

### New tests

- `tests/unit/vendor-reset.test.ts`: **15 cases**, including isolated PostgreSQL preservation/rollback, manager coordination, replay, source binding, permissions, global-disabled/inactive behavior, shutdown, and enabled production HTTP/Nano against a local controlled CouchDB fixture.
- `tests/vendor-reset.spec.ts`: **4 cases** — tm/ru/en complete confirmation workflows and independent HTTP permission/CSRF/input validation.

### Related regression

Targeted Node test selection, **104 tests**:

```sh
TEST_PRODUCTION=1 node --import tsx --test \
  tests/unit/vendor-reset.test.ts \
  tests/unit/vendor-sync.test.ts \
  tests/unit/durable-sync.test.ts \
  tests/unit/source-operation-date.test.ts \
  tests/unit/vendors.test.ts \
  tests/unit/vendors-preview.test.ts \
  tests/unit/permission-registry.test.ts \
  tests/unit/permissions.test.ts \
  tests/unit/database.test.ts \
  tests/unit/sync-storage.test.ts
```

Browser regression: the **9 existing Vendors/permission-navigation tests** in `tests/vendors.spec.ts` and `tests/vendors-navigation.spec.ts` passed. The **4 new Reset browser cases** passed on the final production build. These are targeted runs, not a full historical regression claim.

- `npm run localization:check`: passed; **338 current UI keys** have real tm/ru/en values.
- Fresh migration tests: **29 migrations**, **358 canonical keys**, **1,074 translation values**, complete UI-language coverage.
- Standard `scripts/verify-localization.ts` (the `localization:verify` implementation) against actual `http://127.0.0.1:3000`: passed all three languages, including current Vendor strings and existing shared localization/authenticated UI flows. Disposable Vendor fixtures now start inactive so the live enabled manager cannot contact them.
- `npm run typecheck`: passed.
- `npm run build`: passed (TypeScript compilation and production asset copy).
- `git diff --check`: passed.

Initial verification exposed stale expected registry/translation counts and a browser fixture that waited for the result count before the debounced search completed. Counts were updated for actual additions; the new Reset test now waits for the exact fixture name and targets its exact Vendor ID before opening the action. No unintended reset was submitted. A credential-failure fixture was corrected to use a valid encrypted payload with the wrong key, preserving the database's ciphertext-format constraint. The worker's initial-connection acknowledgement uses the project's existing TypeScript target; no compiler target or dependency change was needed.

### Production verification and real data safety

The production-build test runs a separate server with an isolated PostgreSQL schema and a **local fake CouchDB**. It sends a real authenticated/CSRF-protected HTTP reset, verifies the prior longpoll closed, holds replay to inspect checkpoint `"0"`, null dates and empty stock/snapshots, confirms retained entities/FK, then releases history and verifies rebuilt stock **7**, two applied movements and the advanced checkpoint. Shutdown succeeds cleanly. Remote production CouchDB is not used for destructive verification.

Actual **Vendor 97 was not reset**. Post-verification read-only checks retain:

| Data | Rows |
| --- | ---: |
| Warehouses | 33 |
| Measures | 5 |
| Currencies | 3 |
| Source Products | 11,960 |
| Product Barcodes | 11,960 |
| Product Stocks | 15,171 |
| Source Stock Movements | 97,569 |

Its persisted checkpoint remains present; original sync/operation dates remain populated. The current development server returns `/health` 200 and retains an established CouchDB synchronization connection.

### Intentionally not executed

The full historical `npm test` suite and unrelated deep Media/Move/Universal Upload/Profile/Users domain suites were not rerun. Reset changes Vendor synchronization orchestration, its isolated route/UI/registry definition, and localization seed data; those integrations and durable stock correctness were directly exercised. Shared authentication/session/Media implementations were not changed. Standard localization verification additionally exercised existing shared UI flows. All historical tests remain available unchanged in their normal full-suite selection.

## Files created or changed for this task

- Server: `src/vendors/sync/reset.ts` (new), `manager.ts`, `worker.ts`, `durable.ts`, `durable-repository.ts`; `src/controllers/cpanel/vendors-api.ts`, `vendors.ts`; `src/routes/cpanel/vendors-api.ts`; `src/cpanel/permissions/definitions.ts`.
- UI: `src/public/cpanel/js/vendors.js`; `src/views/cpanel/pages/vendors-content.ejs`; `src/views/cpanel/partials/vendors/dialog.ejs`.
- Localization: `src/database/migrations/029_vendor_reset_translations.sql` (new).
- Tests: `tests/unit/vendor-reset.test.ts` and `tests/vendor-reset.spec.ts` (new); registry/count expectations in `tests/unit/database.test.ts`, `permissions.test.ts`, `permission-registry.test.ts`, `vendors-preview.test.ts`; safe inactive live fixtures in `scripts/verify-localization.ts`.
- Documentation: architecture section 47, `docs/VENDOR_RESET_SYNC.md` (new), `docs/DURABLE_VENDOR_SYNC.md`, `docs/CPANEL_VENDORS.md`, `README.md`, this report.

Existing unrelated working-tree changes were preserved. No commit or publishing operation was performed.

## Operational boundaries / unresolved issues

No known unresolved failure in the implemented scope. Existing deployment contract remains **one enabled application process**; the per-Vendor gate is not distributed coordination for multiple independently enabled managers. A changed source URL or legacy non-null checkpoint without a binding is deliberately rejected rather than mixing retained source identities. Source switching requires a separate approved workflow. Restart acknowledgement does not wait for the entire historical replay; later network/decode errors use existing asynchronous retry/error handling. These boundaries are documented in architecture section 47 and `docs/VENDOR_RESET_SYNC.md`.

## Explicit confirmations

| Question | Answer |
| --- | --- |
| Does Reset Sync Data apply only to the selected Vendor? | **YES** |
| Are its `product_stocks` rows deleted? | **YES** |
| Are its `source_stock_movements` rows deleted? | **YES** |
| Is `last_sequence` reset to string `"0"`? | **YES** |
| Is `date_last_sync` cleared? | **YES** |
| Is `date_last_operation` cleared? | **YES** |
| Are Warehouses preserved? | **YES** |
| Are Currencies preserved? | **YES** |
| Are Measures preserved? | **YES** |
| Are Source Products preserved? | **YES** |
| Are Product Barcodes preserved? | **YES** |
| Are HORMAT Products preserved? | **YES** |
| Are Source Product PostgreSQL IDs preserved? | **YES** |
| Is Media/cache untouched by reset? | **YES** |
| Is Vendor configuration/credential preserved? | **YES** |
| Does an active Vendor restart synchronization from the beginning? | **YES**, with the existing enabled-manager setting; otherwise explicit restart-pending feedback. |
| Does an inactive Vendor remain stopped? | **YES** |
| Can another Vendor's data or worker be reset by this operation? | **NO** |
| Is reset protected by `vendors.reset_sync`? | **YES** |
| Is reset CSRF-protected? | **YES** |

Stopped after this scope; Source Products UI was not started.
