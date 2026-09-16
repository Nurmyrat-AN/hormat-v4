# VendorSyncManager — listener foundation

> Current runtime: [durable source synchronization](DURABLE_VENDOR_SYNC.md) supersedes the historical stage boundaries below.

## Scope and ownership

The owner approved this stage after persistent Vendors CRUD. `src/vendors/sync/` is a separate server-side subsystem. It listens and inspects batches only. It creates no tables, routes, Source Products, document persistence, monitoring UI or Socket.IO events. Existing Vendor UI remains based on unchanged PostgreSQL runtime fields (normally **Not synced**).

`VendorSyncRepository` has only parameterized SELECTs. Its internal credential-bearing projection is separate from the safe CRUD projection. Browser responses and internal lifecycle events never contain encrypted or decrypted credentials.

## Starting and stopping

`src/server.ts` starts the manager after application initialization and stops it before closing the database pool. `start()` is idempotent; `stop()` unsubscribes, cancels requests, queued processing and backoff, waits for running processing/reconciliation, destroys per-worker HTTP dispatchers and clears memory. Normal disabled-mode application startup/shutdown continues unchanged. PostgreSQL query timeouts and the existing ten-second application shutdown deadline remain in effect.

The foundation is **opt-in**: set `VENDOR_SYNC_ENABLED=true` and restart the application when this environment should contact configured Vendors. Default is `false`. The task did not enable external connections in the owner's `.env`. Tests explicitly disable listeners on normal browser/child servers; the enabled-server test uses an isolated schema, random test encryption key and localhost CouchDB simulator only.

| Setting | Default | Accepted |
| --- | --- | --- |
| `VENDOR_SYNC_ENABLED` | `false` | `true` / `false` |
| `VENDOR_SYNC_BATCH_SIZE` | 100 | 1–10000 |
| `VENDOR_SYNC_MAX_CONCURRENT_BATCHES` | 5 | 1–100 |
| `VENDOR_SYNC_LONGPOLL_TIMEOUT_MS` | 25000 | 1000–120000 |
| `VENDOR_SYNC_RETRY_MIN_MS` | 2000 | 100–300000 |
| `VENDOR_SYNC_RETRY_MAX_MS` | 30000 | min–300000 |

Invalid values fail startup without echoing values/secrets. No additional encryption key exists; use the existing stable Vendor credentials key.

## Nano transport and batches

Nano 11 is the CouchDB client. Its `request()` API sends one `_changes` GET with `feed=longpoll`, `include_docs=true`, configurable `limit`, `timeout` and opaque `since`. The convenience `db.changes()` does not forward a request AbortSignal, so the adapter uses Nano's request API (not custom HTTP). A per-Vendor Undici 7 dispatcher provides one connection and explicit destruction; Undici 8 was incompatible with the tested Node 22 built-in fetch dispatcher protocol. Nano's runtime supports `parseUrl:false` and `request.signal`; narrowly scoped typing adaptations cover those missing declarations.

The full stored URL is the database endpoint, including reverse-proxy prefixes and encoded database paths. Nano appends `_changes`, respecting existing trailing slash behavior. HTTP/HTTPS only, no embedded auth/query/fragment; a root-only URL is a terminal worker configuration error because it identifies no database. Credentials are decrypted only on connection creation and supplied in a private Basic Authorization header, never URL parameters. Nano disables redirects. Requests have cancellation plus a deadline of longpoll timeout + 5 seconds. A closed worker releases its client and destroys its dispatcher. There is no mutable shared authentication client.

Each worker awaits the response, then awaits the complete batch processor, then advances its memory sequence, then issues the next request. There are no per-document fetches or prefetching. A FIFO scheduler caps global processing concurrency; each worker holds at most one received/queued batch. At approximately 100 workers, up to 100 longpoll connections or bounded-by-record-count waiting batches are possible. Document byte sizes are not capped by this stage; batch-size tuning still matters for large documents.

Temporary processing counts changes, included ordinary documents and deletions; `_design/` and `_local/` IDs count separately and are excluded from ordinary document/deletion counts. Missing docs and deleted docs are tolerated. No document body or ID is logged. Invalid batch shapes/oversized result arrays fail without advancing sequence. An immediate empty response waits 250 ms before another request, preventing an empty hot loop if a proxy ignores longpoll.

## Checkpoints and lifecycle

- First start uses stored `last_sequence`; null means `"0"`.
- Only a successfully inspected complete batch advances the worker's memory sequence to `last_seq`.
- Retry resumes that memory sequence. Failed processing can replay a batch.
- Deactivate/reactivate in the same manager lifetime retains the memory checkpoint for the same URL.
- Name-only edits do not reconnect.
- Username/password changes stop the old worker before starting the new one and preserve memory sequence when URL is unchanged.
- A different URL starts temporary memory sequence at `"0"` when the manager has already seen the old URL. It never reuses that old source's in-memory checkpoint. **No persisted checkpoint is reset.** After a full process restart the stored checkpoint remains the initial source, so true source-identity/durable reset rules still require the later stage.
- Full manager stop/application restart loses memory progress; replay is expected.
- `last_sequence`, `date_last_sync`, `date_last_operation` and Vendor `updated_at` receive **no writes from listeners**.

**Permanent internal-event rule:** HORMAT Vendor lifecycle mutations must go through `VendorService`. Direct manual SQL is outside automatic runtime event guarantees. Socket.IO must not be used for this server-internal lifecycle.

CRUD publishes immutable `{vendorId, changeType, changedFields}` notifications only after COMMIT returns. Changed field names carry no values. Listener failures cannot turn a committed transaction into a reported CRUD rollback. The manager subscribes before loading startup IDs, reloads authoritative PostgreSQL configuration, and serializes/coalesces reconciliation per Vendor. Active creates/activation start; inactive creates do not; deactivation aborts. A worker is fully stopped before replacement, including processing. Rapid edits converge to the latest committed settings.

Events and uniqueness guarantees are **within one application process**. Run one enabled manager instance for this foundation. Direct SQL/external-process updates do not send these events; restart or internal `refresh(id)` is needed. No cross-process coordination, durable event delivery or distributed lock was introduced. A database configuration-read failure retries with backoff; an existing listener can remain on its last loaded configuration until a successful reload. This is not an authorization cache.

## Failure isolation and diagnostics

Connection/authentication/processing errors retry independently with bounded exponential jitter: attempt cap = min(max, min × 2^attempt); delay is uniform from min to cap. Success clears retry state. Invalid URL and credential decryption errors are terminal for that worker configuration; corrected connection credentials/settings trigger replacement. A changed encryption master key needs application restart. Startup configuration reads also use abortable backoff.

Logs contain only fixed event/error codes, Vendor ID, attempt/delay and counts. Never serialize Nano errors, configuration, Authorization headers, documents or credentials. `getStatus()` is server-internal only: running/state/sequence, last batch size/time/counts, retry attempt and a fixed error code. There is no API or socket exposing it.

## Future durable contract

When Source Product persistence is separately approved:

```text
receive whole batch
→ persist/process the batch safely
→ commit business data
→ only then persist last_sequence
```

Never record durable progress before business processing succeeds. Timestamp/lag/health semantics, source URL reset semantics and deletion propagation remain future decisions. This foundation does not authorize their implementation.

## References

Adapter behavior was checked against the installed Nano source and [official Nano documentation](https://github.com/apache/couchdb-nano), with request semantics from [CouchDB `_changes`](https://docs.couchdb.org/en/stable/api/database/changes.html).

See [verification report](../VENDOR_SYNC_FOUNDATION_REPORT.md) for actual targeted tests and limitations.
