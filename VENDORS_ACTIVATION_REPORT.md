# HORMAT V4 — Vendors activation report

## Implemented scope

The approved Vendors UI now uses persistent PostgreSQL configuration data. Add, Edit, Details, activation/deactivation and live search are implemented. Existing Grid/List, dialogs, shared password visibility, themes, language switching and shell remain in place.

Synchronization is not implemented. No CouchDB connection, connectivity test, `_changes`, listener, worker, retry loop, sequence advancement, Source Products or Delete Vendor functionality was added.

## Database and credentials

- Migration 024 creates exactly one domain table, `vendors`, with the twelve approved columns. IDs use bigint identity. `last_sequence` is nullable TEXT; runtime dates are nullable timestamptz; active defaults true. Created/updated timestamps follow the existing project convention.
- Passwords are encrypted with AES-256-GCM using fresh random IVs, an authentication tag and versioned domain-authenticated payload. The dedicated server service can decrypt for a future synchronization service; passwords are never hashed as login credentials or stored plaintext.
- `VENDOR_CREDENTIALS_KEY` requires exactly 64 hex characters (32 bytes). Missing/invalid configuration fails startup; no plaintext fallback exists. A random key was provisioned only in the ignored local `.env`, without printing its value. `.env.example` contains an empty placeholder.
- Keep this key stable and securely backed up. No rotation implementation is included; losing/replacing the key prevents decrypting existing credentials.
- Normal list/search/detail/create/update response projections expose only `passwordConfigured`, never plaintext, ciphertext or the key. Edit never reads/decrypts the old password into its form. Empty/omitted replacement retains the existing ciphertext; a supplied replacement is encrypted afresh.
- Browser-supplied runtime/system fields and target overrides are rejected. Status updates preserve credentials, checkpoint and runtime dates. Transaction failures roll back.

## Routes and authorization

| Route | Permission |
| --- | --- |
| GET `/cpanel/vendors` | vendors.view |
| GET `/cpanel/api/vendors` | vendors.view |
| GET `/cpanel/api/vendors/:id` | vendors.view |
| POST `/cpanel/api/vendors` | vendors.create |
| PATCH `/cpanel/api/vendors/:id` | vendors.update |
| POST `/cpanel/api/vendors/:id/status` | vendors.status |

The four assignable boolean definitions already existed and remain registry-driven in Permissions Management. They are independent: missing/false/non-boolean deny, exact true grants; Super User requires no individual Vendor rows. Mutation routes require CSRF. Services revalidate active actor, session and effective permission inside the transaction; updates lock the target. Revocations affect subsequent requests without logout. UI actions reflect current effective capabilities.

Vendors navigation is enabled only after the full activation regression, with effective vendors.view controlling visibility. Source Products remains disabled. Availability is not a permission.

## Validation, search and presentation

Name and username are required, trimmed and bounded to 200 Unicode characters. Password is required on Add and bounded to 16,384 UTF-8 bytes; whitespace is preserved. URL requires an explicit HTTP(S) scheme and host, rejects embedded credentials/query/fragment/whitespace/backslashes, and uses standard URL serialization. Scheme/host case and default ports normalize; trailing path slashes are preserved, and paths are not manually truncated.

PostgreSQL live search defaults to Name and Active. Name, URL, Username and All Fields use a trusted field allowlist, parameterized SQL and escaped literal wildcards. Passwords are never searched. Pagination uses nine records and stable ID order. Grid/List share the same filtered result and retain query/field/status/view. Aborted requests and revision checks prevent stale results.

New records have null runtime state and display **Not synced**. Non-null sync timestamps display neutral **Not evaluated yet** until actual synchronization health rules are approved. Existing opaque checkpoints/timestamps render safely; lag is shown only when both timestamps exist. No health thresholds or persisted health columns were invented.

Save prevents duplicate submissions, shows localized progress/results and refreshes the filtered list. Failures preserve nonsecret input and allow retry; password inputs clear. The modal lifecycle waits for a previous closing animation before opening another dialog.

## Localization

Migration 025 adds 15 semantic `cpanel.vendors.*` keys: healthPending, invalidName, invalidUrl, invalidUsername, invalidPassword, passwordRequired, notFound, createFailed, updateFailed, statusFailed, readFailed, created, updated, activated and deactivated. Existing permission, field, status, search, visibility, working, cancellation and generic error keys are reused.

Migration 026 updates the existing subtitle to describe connection settings without claiming active synchronization. All new/updated entries contain actual tm/ru/en database values. The development DB was migrated and the live cache refreshed. Canonical totals are 344 keys / 1,032 required-language values; 324 keys are currently referenced by UI source.

## Files

- New backend: `src/vendors/{credentials,repository,service}.ts`.
- Safe UI projection: `src/cpanel/vendors/presentation.ts`; obsolete runtime mock data moved to `tests/fixtures/vendors-preview.ts`.
- Controllers: `src/controllers/cpanel/vendors.ts`, `vendors-api.ts`.
- Routing: `src/routes/cpanel/vendors-api.ts`, `index.ts`.
- UI activation: `src/public/cpanel/js/vendors.js`, `src/views/cpanel/pages/vendors-content.ejs`; approved vendor dialog/CSS reused.
- Configuration: `src/config/env.ts`, `.env.example`, ignored local `.env`.
- Migrations: 024 Vendors, 025 activation translations, 026 subtitle correction.
- Navigation: `src/cpanel/shell/navigation.ts`, `context.ts`.
- Verification: Vendor unit/browser/navigation tests, fresh-migration integrity expectations, fixture import and `scripts/verify-localization.ts`.
- Documentation: architecture section 41, `docs/CPANEL_VENDORS.md`, navigation/localization/translation docs and README.

Prior Media/UI-stage changes already present in the workspace were preserved. No unrelated domain schema was changed.

## Verification results

All final commands completed successfully:

| Check actually executed | Result |
| --- | --- |
| `npm run db:migrate` | Migrations 024, 025 and 026 applied to the development DB |
| `npm run build` | Passed; TypeScript compiled and production assets generated |
| `npm run typecheck` | Passed |
| `TEST_PRODUCTION=1 CHROME_PATH=/usr/bin/google-chrome npm test` before enabling Vendors | **151 passed:** 76 unit/integration + 70 core browser + 5 Users browser |
| Final `npm run test:unit` after navigation activation | **77 passed**, including fresh migrations and new navigation availability test |
| Final production Playwright run of Vendors, Vendors navigation, roadmap and shell | **13 passed** |
| `npm run localization:check` | **324 used UI keys** have real tm/ru/en values |
| `CHROME_PATH=/usr/bin/google-chrome npm run localization:verify` against dev port 3000 | Passed in **tm, ru, en**, including real disposable Vendor creation and actual translated messages |
| `git diff --check` | Passed |
| `.env` ignore check | Confirmed ignored |

The production suites started the compiled application with `npm start`; valid-key startup and real HTTP behavior passed. Missing/invalid-key subprocess startup failures were tested independently.

Coverage includes encryption roundtrip/randomization/authentication failure, strict independent permissions, Super User bypass, CSRF, runtime injection rejection, safe reads, empty-password preservation/replacement, status/runtime preservation, defaults/allowlisted search/pagination/race cancellation, transaction rollback and a local HTTP trap proving zero supplier requests. Permission registry/UI integration and same-session revocation passed.

Full regression covered Users CRUD/avatar/password/status permissions, authentication/sessions/Super User, Profile/password changes, Permissions, complete Media File Manager/Move/universal upload/avatar integration, localization, Frontend, Socket.IO, shell, pin/unpin, collapsed/mobile navigation and themes.

Vendors Grid/List and Edit/Details were checked in tm/ru/en, light/dark, at 1440px and 375px; no horizontal overflow. Screenshots are saved under `artifacts/vendors-active-*.png`; representative desktop/mobile/modal screenshots were visually inspected. The final navigation test confirms enabled status, active link, Super User access without individual rows, normal view access, and removal/403 after revocation. Source Products stays disabled.

During verification, test-only production-cookie handling and language-navigation waits were corrected; final runs have no failures. The activation source was rebuilt before that production browser run. The supplemental security review below records subsequent test/documentation changes.

## Boundaries and remaining work

Vendors CRUD owns configuration. A future VendorSyncService will own checkpoint/runtime writes. Connection testing, synchronization, health thresholds, key rotation tooling and Source Products require separate approved work. These are deliberate scope boundaries, not simulated features. **No known unresolved issue remains in the implemented CRUD/navigation scope.**

**Did this task implement CouchDB synchronization or Source Products? No.**

**Are normal read responses allowed to contain the password, encrypted payload or encryption key? No.**

**Can browser CRUD requests write synchronization runtime fields? No.**


## Supplemental security review — sections 61–87

The continuation was reviewed against the actual code and extended tests. No runtime implementation change, new permanent schema, route or visible UI text was needed. Changes in this continuation are Vendor tests and documentation.

### Explicit confirmations

* Is Vendor CRUD now fully functional? **YES**
* Is `Vendors → Vendors` enabled? **YES**
* Is `Source Products` still disabled? **YES**
* Is CouchDB password stored in plaintext? **NO**
* Is CouchDB password one-way hashed? **NO**
* Is it stored using reversible authenticated encryption? **YES**
* Is the encryption key stored in PostgreSQL? **NO**
* Can normal Vendor GET/list/details expose the password or ciphertext? **NO**
* Does editing Vendor without providing a new password preserve the existing encrypted credential unchanged? **YES**
* Does intentionally entering a new password replace the encrypted credential? **YES**
* Does the browser ever receive the existing CouchDB password for Edit Vendor? **NO**
* Does the browser receive only a safe `passwordConfigured`-style state? **YES**
* Are `last_sequence`, `date_last_sync`, and `date_last_operation` system-managed? **YES**
* Can Add/Edit Vendor manually modify synchronization fields? **NO**
* Is `last_sequence` stored in a form capable of preserving an opaque CouchDB sequence value? **YES**
* Is synchronization health stored as a permanent DB column? **NO**
* Is Vendor Active/Inactive status separate from synchronization health? **YES**
* Does changing Vendor status start or stop a CouchDB listener in this task? **NO**
* Does Vendor CRUD make any CouchDB request? **NO**
* Was `_changes` implemented? **NO**
* Was a synchronization worker/service implemented? **NO**
* Were Source Products implemented? **NO**
* Are all Vendor actions protected by their respective `vendors.*` permissions? **YES**
* Does Super User receive Vendor permissions through `superuser=true` without explicit `vendors.*` rows? **YES**
* Are all Vendor mutations CSRF-protected? **YES**
* Do all new visible Vendor strings have real tm/ru/en database translations? **YES**
* Did the complete HORMAT V4 regression suite pass? **YES**
* Did the TypeScript production build pass? **YES**


### Review performed and evidence

- **Password/key separation:** reviewed `src/vendors/credentials.ts`, config, migration 024 and all repository writes. PostgreSQL contains only authenticated encrypted password payloads; no plaintext or master-key column/write exists. `.env` is ignored and untracked; `.env.example` contains an empty variable plus format guidance. Normal read projections do not select ciphertext into response models.
- **Cryptography:** AES-256-GCM uses `randomBytes(12)` per encryption, 16-byte tags and domain/version AAD. Actual payload is `v1.<base64url IV>.<base64url tag>.<base64url ciphertext>`. Tests separately alter IV, tag, ciphertext and version and verify safe failure; wrong-key/malformed-payload and fresh-nonce roundtrip checks pass. No rotation subsystem was introduced.
- **Logging:** searched/reviewed Vendor controllers, service, repository, crypto/config validation, API parser/error handler, global HTTP handler, pool error handling, browser JS and tests. Vendor paths have no logging/debug statements; operation errors become fixed codes, and generic HTTP handling logs only error class names. No request-body logger exists. Secret comparisons in unit tests now assert boolean results instead of printing compared plaintext/ciphertext on assertion failure. The review concerns application/test paths; no master key was sent to PostgreSQL to perform a content search.
- **Browser exposure:** actual list/search/HTML/Details/Edit initialization and validation/error responses are checked for secret exposure. Inputs start empty for password replacement. Only configured state represents the stored credential. UI inspection and automated comparisons use disposable data, not owner credentials.
- **Replacement failure:** service tests force encryption and SQL failure and verify that the complete old row remains unchanged and password A still decrypts. A production-browser test also forces a real PostgreSQL update failure using a disposable trigger restricted to one test Vendor, verifies HTTP 500 with only the fixed failure envelope, localized UI error, cleared replacement input and unchanged encrypted A. The temporary trigger/function and test data are removed in `finally`.
- **Configuration:** missing/invalid-key startup subprocesses fail with safe errors; no predictable/default/plaintext fallback is present. Valid-key compiled startup and all workflows pass.
- **URL/runtime rules:** HTTP(S) URL userinfo is rejected. `/products-db` is retained; standard URL normalization is documented. Newly created runtime fields are null. Edit—including changing URL, username and password—and status changes preserve all runtime values. No reset/restart/resync rule is inferred.
- **Indexes/uniqueness:** database tests find only the primary-key B-tree on ID. Name/URL/username are not uniquely constrained; creating identical configurations succeeds. No speculative synchronization/status/search index was added. Current substring search uses allowlisted columns and parameterized values; stale-response protection remains tested.
- **Permissions:** a normal view-only administrator can search/filter/open Details but receives no Add/Edit/Status actions. Each additional action grant is tested independently, alongside the existing strict backend matrix. Revocation through the actual Permissions Management UI removes the live user's navigation and produces 403 on the next direct Vendor request, without logout.
- **Presentation/scope:** inactive styling remains separate from neutral synchronization health. Vendors remains enabled and Source Products disabled. No listener, `_changes`, Sync Service or Source Products work was performed.

### Supplemental verification

`npm run build` passed. The full `TEST_PRODUCTION=1 CHROME_PATH=/usr/bin/google-chrome npm test` run passed **156 tests: 78 unit/integration + 73 core browser + 5 Users browser**, including real compiled server startup. All previously completed modules remain covered. The focused production browser run of the final real replacement-failure scenario also passed **1/1**, including its exact safe-response assertion and fixture cleanup. No new localization key or seed/cache change was required in this continuation.

The changed verification files are `tests/unit/vendors.test.ts`, `tests/vendors.spec.ts`, and `tests/vendors-navigation.spec.ts`; documentation changes are this report, `docs/CPANEL_VENDORS.md` and architecture section 41. No known unresolved issue remains in the approved Vendor CRUD scope.
