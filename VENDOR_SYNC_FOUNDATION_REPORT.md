# Vendor CouchDB SyncManager Foundation — completion report

## Result

Implemented the requested listener foundation using Nano. The subsystem loads active PostgreSQL Vendors, maintains one listener per Vendor, consumes `_changes` in complete batches, reacts to post-commit Vendor lifecycle events and shuts down cleanly.

**No source documents or synchronization progress are persisted. No Source Products, business tables, routes or monitoring UI were created.**

External listeners are opt-in: `VENDOR_SYNC_ENABLED=false` by default. Set it to `true` and restart when the environment should connect to configured Vendors. The owner's `.env` and real Vendor credentials were not changed. All verification used fakes, isolated PostgreSQL schemas and local HTTP CouchDB simulators.

## Implementation

- `VendorSyncManager`: idempotent start/stop, startup loading, serialized/coalesced per-Vendor configuration reloads, safe internal status and memory checkpoint retention across same-source reconnects.
- `VendorSyncWorker`: per-Vendor single-flight, whole-batch temporary processing, sequence advances only after success, isolated failures, bounded exponential jitter, cancellation of requests/retries/queued jobs.
- FIFO processing scheduler: default five simultaneous batches; one pending batch per worker, no prefetch queue growth.
- Nano adapter: longpoll + include_docs + configured limit/timeout/since; no per-document requests. Full database URL path is preserved, including proxy paths and encoded slashes. Separate private authentication/client/dispatcher per worker. Nano redirects are rejected; request deadlines and AbortSignal stop hung requests.
- Existing AES-GCM credentials service reused. Invalid URL/decryption errors produce fixed safe codes and await corrected configuration. Remote errors never leak raw Nano error bodies.
- Temporary processor counts ordinary documents, deletions and design/system documents. Missing docs are valid; system IDs are classified separately. Logs contain only Vendor IDs, counts and fixed codes.
- Vendor service publishes immutable IDs/change type/field names after commit, never credentials or field values. Real deferred-COMMIT failure produces no event.
- Active create/activation starts; inactive create does not; deactivation aborts; name-only change does not reconnect; username/password replacement reconnects with memory checkpoint retained; URL change observed in the current manager lifetime restarts memory at zero.
- Existing server starts the optional manager after initialization and stops it before closing PostgreSQL.

## Checkpoint/database contract

Initial memory sequence is stored `last_sequence` or `"0"` for null. Retry uses the last successfully processed memory sequence. Full manager/application restart loses new progress and may replay changes. URL changes do not reset persisted state; permanent source-identity/reset behavior is deferred.

No listener writes to `last_sequence`, `date_last_sync`, `date_last_operation`, `updated_at`, or any business table. A before/after snapshot of **every table in the isolated test schema** remained identical after processing. Schema/migrations are unchanged. Existing UI remains based on unchanged runtime columns and normally displays Not synced.

Future boundary documented: receive complete batch → persist/process business data → commit → only then persist checkpoint. Not implemented now.

## Changed files for this stage

- New `src/vendors/events.ts`.
- New `src/vendors/sync/{config,repository,scheduler,transport,worker,manager,index}.ts`.
- Updated `src/vendors/service.ts`, `src/config/env.ts`, `src/server.ts`.
- Updated `.env.example`, `package.json`, `package-lock.json`, `yarn.lock`.
- Updated `playwright.config.ts` and child-server test environment in `tests/unit/database.test.ts` to disable real listeners.
- New `tests/unit/vendor-sync.test.ts`; expanded `tests/unit/vendors.test.ts` (including explicit listener-disable for existing startup tests).
- New `docs/VENDOR_SYNC.md`, this report; updated `docs/ARCHITECTURE.md` section 43, `docs/CPANEL_VENDORS.md`, `README.md`.

Other existing uncommitted project changes were preserved and are not changes introduced by this stage.

## Tests actually executed

### New coverage: 13 tests

Eleven SyncManager/Nano tests cover:

1. Configuration defaults/ranges and bounded jitter.
2. Five independent active Vendors, inactive exclusion, duplicate start, restart and safe diagnostics.
3. One hundred Vendors, FIFO progress, global concurrency limit, single-flight and cancellation of queued work.
4. Active/inactive create, activation/deactivation, name/username/password/URL lifecycle semantics.
5. Rapid edits converge to authoritative configuration; stop during pending reload.
6. Failed processing does not advance sequence; reconnect resumes last success; another Vendor continues.
7. Decryption failure isolation/no futile retry, replacement recovery and disabled mode.
8. Missing/deleted docs and design-doc classification.
9. Actual Nano calls against local HTTP: batched query, encoded proxy path, auth, abort and resource destruction.
10. Invalid batch/URL isolation, checkpoint protection and retry cancellation.
11. Safe authentication-error mapping without leaking CouchDB response bodies.

Two PostgreSQL/Vendor tests cover:

12. Post-commit event timing, rollback suppression (deferred trigger fails at COMMIT), safe payloads, real lifecycle integration, existing opaque starting checkpoint and whole-schema no-write proof.
13. Compiled production server with enabled listeners against only a local fixture: startup, batches, SIGTERM abort of held longpoll, clean exit and unchanged database runtime state.

### Related regression results

- Initial combined unit/integration invocation: **49 passed, 0 failed** across `vendor-sync`, `vendors`, `vendors-preview`, `permission-registry`, `permissions`, `auth`, `navigation`, `database`.
- After adding three further error/lifecycle cases, re-ran complete `vendor-sync` + `vendors`: **22 passed, 0 failed**. This overlaps the first run; total distinct unit/integration tests verified is **52**.
- Compiled production browser/HTTP run: **20 passed, 0 failed** across `vendors.spec.ts`, `vendors-navigation.spec.ts`, `auth.spec.ts`, `navigation.spec.ts`, `foundation.spec.ts`.
- Browser regression exercised real Vendor CRUD/search/status/details/security, permissions management grants/revocation, CSRF, sessions/login/logout, tm/ru/en, responsive Grid/List, light/dark, full roadmap, Frontend/CPanel assets, Socket.IO and health.
- `npm run typecheck`: passed.
- `npm run build`: passed; the generated build was used by browser checks and enabled-listener production lifecycle test.
- `git diff --check`: passed.

**72 distinct targeted checks passed (52 unit/integration + 20 browser/HTTP). This was not a full historical regression run.**

Commands (from project root):

```sh
npm run typecheck
npm run build
TEST_PRODUCTION=1 node --import tsx --test tests/unit/vendor-sync.test.ts tests/unit/vendors.test.ts tests/unit/vendors-preview.test.ts tests/unit/permission-registry.test.ts tests/unit/permissions.test.ts tests/unit/auth.test.ts tests/unit/navigation.test.ts tests/unit/database.test.ts
TEST_PRODUCTION=1 node --import tsx --test tests/unit/vendor-sync.test.ts tests/unit/vendors.test.ts
TEST_PRODUCTION=1 CHROME_PATH=/usr/bin/google-chrome npx playwright test tests/vendors.spec.ts tests/vendors-navigation.spec.ts tests/auth.spec.ts tests/navigation.spec.ts tests/foundation.spec.ts --project=core
```

Deep Media/Move/upload, Profile, Users-management and standalone full Permissions UI suites were intentionally not rerun: this stage does not alter their code or shared authorization behavior. Relevant permission/auth/CSRF tests and Vendor integration with Permissions Management were run. No localization keys or user-visible strings were added; no translation migrations or running-cache refresh were needed. Existing Vendor tm/ru/en workflows were verified in the browser.

## Findings resolved

The initial Nano adapter test exposed incompatibility between Undici 8 and Node 22 built-in fetch (`invalid onRequestStart`). Dependency now uses Undici 7 (`^7.29.1`), with a passing real Nano HTTP/abort test. All initially failing tests were rerun successfully.

## Limits / review notes

- No known failing checks or unresolved implementation defects.
- Real external CouchDB endpoints/credentials were not used or tested.
- Internal events and worker uniqueness are process-local. Use one enabled application process; external SQL changes require restart/internal refresh. Distributed locking/event delivery is outside this foundation.
- Batch record count and processing concurrency are bounded; document byte sizes are not capped in this stage.
- During a configuration-read database outage, a worker may retain its last loaded configuration until the manager can reload successfully.
- Decryption errors need corrected credentials/key; key changes require restart. Full restart returns to persisted checkpoint, intentionally losing temporary progress.
- The continuation covering sections 62–107 has now been received and verified; see the supplemental verification below.

**Are documents, last_sequence or sync timestamps persisted by this foundation? No.**

**Were Source Products, new business tables, routes, or UI monitoring added? No.**

**Did tests connect to real Vendor CouchDB servers? No.**

Ready for review. No subsequent synchronization/persistence stage was started.

## Supplemental completion — sections 62–107

The continuation was reviewed against the implementation. No runtime or UI changes were needed. Expanded tests now exercise the missing combinations through the real service, and the permanent requirement to make HORMAT Vendor lifecycle changes through VendorService is explicit in architecture section 43 and the subsystem guide.

### Additional verification

- Real PostgreSQL VendorService creates active and inactive Vendors while the manager is already running. Lifecycle events alone drive the manager; the test never manually calls `refresh` to make mutation handling work.
- Real service activation starts a listener at the preexisting opaque checkpoint. Deactivation aborts a held request, removes the worker and prevents later requests while another worker remains running.
- Real name-only edit retains the logical connection. Password edit decrypts the newly committed credential and preserves memory sequence; username edit preserves sequence; URL edit uses the new endpoint and temporary sequence zero.
- Six rapidly committed connection edits converge to the final committed URL/username/password. A connection counter proves the old transport closes before any replacement, with no live overlap or remaining connections after stop.
- A deferred COMMIT failure while a listener is active emits no event, leaves the same connection running and preserves valid configuration.
- Every lifecycle event contains only ID/type/changed-field names, with no secret values. Logs/status exclude plaintext, ciphertext and document bodies.
- Runtime-field snapshots remain identical across listener activity and all real service lifecycle mutations. A processed batch containing a deletion and design document advances memory and only increments their classifications; no business delete occurs.
- Explicit global limit of **3** is reached and never exceeded. A held first batch prevents the same Vendor requesting/processing its next batch; low-volume Vendors progress while that Vendor is busy. Batch completion and sequence advancement order are verified.
- Restart after progressing from persisted **X** to memory **Z12** starts from **X** again, proving memory progress was not treated as durable.
- Repeated refresh/start requests during failure retain one logical worker/retry loop. Simulated timeout, refusal and DNS errors recover independently; healthy Vendors continue; successful handling clears retry state. Backoff growth/cap and jitter diversity use deterministic random samples without long waits. No real external DNS/CouchDB failure testing was performed.
- Existing tests also verify real Nano HTTP query/abort/auth-error handling, five Vendors, approximately 100 fake Vendors, decryption failure isolation, malformed-batch failure without advancement, queued cancellation, and compiled production startup/SIGTERM with enabled local listeners.

### Current continuation run

Commands executed:

```sh
npm run build
TEST_PRODUCTION=1 node --import tsx --test tests/unit/vendor-sync.test.ts tests/unit/vendors.test.ts tests/unit/vendors-preview.test.ts tests/unit/database.test.ts
TEST_PRODUCTION=1 CHROME_PATH=/usr/bin/google-chrome npx playwright test tests/vendors.spec.ts tests/vendors-navigation.spec.ts --project=core
```

**Results: 35 unit/integration passed; 9 browser/HTTP passed; 0 failures. `npm run build` passed.** The production test explicitly started both true and false modes against the same active localhost fixture: true issued batches and aborted longpoll on SIGTERM; false returned healthy HTTP responses and made zero additional CouchDB requests. No browser was needed for enabled listener startup. `git diff --check` passed. These runs include the complete SyncManager tests, complete Vendor service/encryption tests, historical Vendor UI-model tests, relevant application lifecycle/database tests, and complete Vendor browser/HTTP/navigation/permission integration coverage. Normal browser and application tests explicitly disable synchronization; the enabled production-start test uses only a local simulator and isolated schema, without browser/login/Socket.IO dependence.

Deep Media, Profile and Users CRUD suites were intentionally not rerun: this continuation changes tests and documentation only. No runtime behavior, shared authentication, permission service, schema or UI changed. Relevant regression was targeted, not a full historical regression run.

### Required explicit confirmations

| Confirmation | Answer |
| --- | --- |
| At most one active Sync worker per Vendor? | **YES**, within the documented single enabled application process. |
| Multiple Vendors operate independently? | **YES**. |
| Suitable for approximately 5 and designed/tested with approximately 100? | **YES**; fake scale simulation passed. |
| Nano/CouchDB `_changes` in batches? | **YES**, longpoll, limit, include_docs and since. |
| Avoids normal document-by-document refetch? | **YES**, no fallback refetch was introduced. |
| Per-Vendor single-flight? | **YES**. |
| Global batch concurrency bounded? | **YES**, default 5, explicit limit-3 test passed. |
| One Vendor failure leaves others running? | **YES**. |
| Retry delays bounded and jittered? | **YES**; retries may continue until recovery/stop. |
| Add/Activate starts a worker without application restart? | **YES**, when globally enabled. |
| Deactivate stops the worker? | **YES**. |
| Name-only edit avoids reconnect? | **YES**. |
| URL/username/password changes reconnect? | **YES**. |
| Credentials absent from event payloads/logs? | **YES**; changed-field names are metadata, never credential values. |
| Newly received documents persisted? | **NO**. |
| `vendors.last_sequence` updated by listeners? | **NO**. |
| `date_last_sync` updated by listeners? | **NO**. |
| `date_last_operation` updated by listeners? | **NO**. |
| Progress memory-only? | **YES**. |
| Changes may replay after restart? | **YES**. |
| Replay expected and safe for this temporary non-persisting stage? | **YES**. |
| Source Products started? | **NO**: no table/repository/routes/UI/permissions. |
| Socket.IO used for internal Vendor lifecycle? | **NO**. |
| Relevant targeted tests passed? | **YES**, 35 unit/integration + 9 browser/HTTP in this continuation. |
| TypeScript/production build passed? | **YES**. |

Before durable synchronization, source identity/reset rules, durable batch persistence and checkpoint commits, deletion propagation, date/lag semantics, and any multi-process deployment coordination still require separate design/approval. They are documented boundaries, not features started by this task.
