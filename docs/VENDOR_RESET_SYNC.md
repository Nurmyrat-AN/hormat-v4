# Vendor Reset Sync Data

## Contract

Reset only the selected Vendor's synchronization progress and derived stock. It is not a source-data deletion operation.

```text
Authorize vendors.reset_sync + CSRF
  → reserve Vendor in SyncManager
  → stop and await current worker
  → reauthorize in PostgreSQL transaction / lock Vendor
  → delete selected Vendor product_stocks
  → delete selected Vendor source_stock_movements
  → last_sequence = text "0"
  → date_last_sync = NULL; date_last_operation = NULL
  → commit
  → reload configuration; restart one worker if active
  → reference prepass + normal durable replay from zero
```

Preserve all Vendor configuration and credentials, warehouses, currencies, measures, source products, barcodes, HORMAT Products relationships, transaction definitions and source URL binding. Never touch Media/cache. Product/reference IDs remain stable during reset and natural UPSERT replay.

## HTTP and authorization

`POST /cpanel/api/vendors/:id/reset-sync`, body `{}`, existing session CSRF header. No query/body target overrides. `vendors.reset_sync` is an assignable registered boolean with real tm/ru/en metadata; Super User inherits it without an explicit row. Direct reset is independent of view/update/status. The existing Vendors screen requires view, so UI use needs view plus reset. Revoked permission/session is checked again after pausing and before mutation.

Controller: `src/controllers/cpanel/vendors-api.ts`; service: `src/vendors/sync/reset.ts`; lifecycle gate: `src/vendors/sync/manager.ts`. SQL lives in the dedicated service's authorized repository transaction, never EJS/controllers. No business schema changes; migration 029 adds 14 keys / 42 localized values.

## Failures and lifecycle

- A concurrent reset receives HTTP 409 `VENDOR_RESET_BUSY` while the selected Vendor gate is held. Independent Vendors are not blocked by that gate.
- Stop failure prevents reset. A pending/active durable transaction must finish or roll back before deletion starts. Vendor configuration events cannot create a second worker during the operation.
- SQL failure rolls back both deletes and checkpoint/dates. The manager attempts to restore the worker using current authoritative configuration and original persisted progress. Existing retries/logs expose recovery failures; no raw DB or credential details reach HTTP.
- Committed reset plus failed configuration restart returns HTTP 200 with `VENDOR_RESET_RESTART_PENDING`: reset succeeded, restart is pending. It never asks the administrator to repeat the destructive reset. The usual configuration retry loop recovers transient lookup failures. Permanent credential/source errors retain the existing safe runtime error behavior and need configuration correction.
- An active Vendor on a globally disabled/shutting-down manager also receives the pending message. Inactive Vendors remain stopped and return completed. The normal deployment has one enabled application process; this does not create distributed worker coordination.
- Starting a worker schedules asynchronous preparation/feed processing. A successful reset response confirms commit and scheduling, not completed CouchDB replay or guaranteed source availability. Later network/decoding errors use normal retry/error state. Zero/null bootstrap does not advance checkpoint or diagnostic dates; the normal committed replay does.
- Reset does not replace source URL binding. Mismatched URL or unbound legacy non-null checkpoint returns HTTP 409 `VENDOR_RESET_SOURCE_CHANGED`; no deletion occurs. A fresh null-checkpoint Vendor is bound to its configured URL inside the reset transaction and can bootstrap from zero.
- Shutdown blocks new reset requests and waits for operations already reserved before releasing database resources.

## Verification scope

Use isolated PostgreSQL schemas and a local fake CouchDB source for active worker/replay tests. Browser fixtures are inactive and uniquely named; never reset actual Vendor 97. Test preservation, Vendor isolation, stock +10−3=7, OLD -10 replay, source IDs/FKs, permission strictness, CSRF, duplicate requests, in-flight batches, rollback, restart failure/recovery, disabled/inactive states, fresh zero bootstrap, and shutdown. Keep historical suites for later full checkpoints under architecture section 42.

[Permanent rule](ARCHITECTURE.md#47-vendor-reset-sync-data) · [Durable mapping](DURABLE_VENDOR_SYNC.md)
