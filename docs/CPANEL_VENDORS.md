# Vendors / CouchDB Suppliers

Vendors is a persistent configuration module. The approved Grid/List and Add/Edit/Details/Status dialogs remain. CRUD itself performs no CouchDB requests. After commit, safe internal lifecycle events notify the optional [VendorSyncManager](VENDOR_SYNC.md); when enabled, its independent listeners react asynchronously.

## Storage and ownership

Migration 024 creates only `vendors`: bigint identity ID, required name/URL/username/encrypted password, `is_active BOOLEAN NOT NULL DEFAULT TRUE`, nullable TEXT `last_sequence`, nullable timestamptz `date_last_sync`/`date_last_operation`, and normal created/updated timestamps.

Vendors CRUD manages configuration. A future VendorSyncService will own `last_sequence`, `date_last_sync`, and `date_last_operation`. Browser requests containing runtime fields are rejected. Status changes retain credentials and all runtime state. No persisted health/status/lag, history, Source Products or other domain tables exist.

New records display **Not synced**. Records with a sync timestamp display neutral **Not evaluated yet** until synchronization rules are approved. Existing timestamps and opaque sequences render safely; lag is the nonnegative operation-minus-sync interval when both timestamps exist, otherwise unavailable. No health thresholds are frozen.

## Credentials and configuration

Set `VENDOR_CREDENTIALS_KEY` to exactly 64 hexadecimal characters representing 32 cryptographically random bytes, supplied through environment/secret configuration. `.env.example` contains no key. Startup fails with a safe configuration error for missing/invalid keys; there is no plaintext fallback. Migration/test commands also load this configuration.

Provision the key with a secret manager or a cryptographically secure generator. Keep a protected backup separate from the database. Keep the same key across application restarts/deployments: losing or replacing it makes existing credentials undecryptable. Never commit, print, log or send it to browsers. No automatic key rotation is implemented; rotation requires a separately designed decrypt/re-encrypt migration.

`src/vendors/credentials.ts` provides reusable AES-256-GCM encryption/decryption with fresh 12-byte random IVs, 16-byte authentication tags and domain/version additional authenticated data. Stored format is `v1.<base64url IV>.<base64url tag>.<base64url ciphertext>`. Tampered, malformed or wrong-key payloads fail with a fixed safe error.

Add requires a nonempty password. Edit's omitted/empty password preserves the existing encrypted payload; intentional replacement encrypts a new value. Passwords are not trimmed and are bounded to 16,384 UTF-8 bytes. Normal read projections never select ciphertext into the response; only `passwordConfigured` is exposed. No existing password is decrypted for editing. Request bodies are not logged; client errors contain stable codes only.

## Validation and API

Name/username are trimmed, nonempty, at most 200 Unicode characters and reject control characters. URL is trimmed, limited to 2,048 characters and parsed with the standard WHATWG URL parser. Only explicit HTTP(S) URLs with a host are accepted; userinfo, query, fragment, internal whitespace and backslashes are rejected. Standard normalization lowercases scheme/host, removes default ports and serializes the path; trailing path slashes are preserved. Database paths are not manually collapsed or truncated.

| Route | Required permission |
| --- | --- |
| GET `/cpanel/vendors` | `vendors.view` |
| GET `/cpanel/api/vendors` | `vendors.view` |
| GET `/cpanel/api/vendors/:id` | `vendors.view` |
| POST `/cpanel/api/vendors` | `vendors.create` |
| PATCH `/cpanel/api/vendors/:id` | `vendors.update` |
| POST `/cpanel/api/vendors/:id/status` | `vendors.status` |

Mutation requests require existing session authentication and CSRF before bounded JSON parsing. Each permission is independent, exact JSON true grants, and Super User bypass requires no individual Vendor rows. Each operation rechecks active authentication, session and current authority inside a transaction following the existing auth-before-session lock protocol. Updates lock the target Vendor. Validation/encryption/SQL failure rolls back; safe stable errors hide internals.

Create accepts name/url/username/password and optional status (`active` default). Edit accepts name/url/username/password only. Status accepts only status (`active`/`inactive`). Unexpected body/query fields and target overrides are rejected. No Delete or Test Connection endpoint exists.

## Search and UX

Parameterized PostgreSQL search uses an allowlist of Name (default), URL, Username, All Fields. Literal `%`/`_` are escaped; credentials are excluded. Active is the backend default; Inactive/All are supported. Results use nine items per page, stable ID order and a shared Grid/List dataset. Query, field, status and selected view survive view switching; only view preference is persisted locally.

Search aborts stale requests and checks a revision counter. Details/Edit fetch fresh safe data. Mutations prevent duplicate submission, show localized working/success/failure states, refresh the current filtered data and preserve retryable nonsecret input on errors. Password inputs clear on success/error/close. Effective permissions control available actions; backend authorization remains authoritative and revocations apply on subsequent requests.

Migration 025 adds 15 activation keys with real tm/ru/en values. Registry definitions remain automatically manageable through Permissions Management. See [architecture](ARCHITECTURE.md#41-activated-vendors-configuration-module) and [activation report](../VENDORS_ACTIVATION_REPORT.md).

Synchronization, connection testing, `_changes`, workers, retries, runtime writes, Source Products and health thresholds remain out of scope.

Migration 026 updates the existing Vendor subtitle in tm/ru/en to describe connection settings only, without implying that synchronization is available. Translation-key totals are unchanged.

## Indexes, identity and synchronization lifecycle

The only Vendor index is the primary-key B-tree on `id`, supporting target lookups and stable result ordering. No uniqueness constraint exists on name, URL or username; duplicate configuration values are allowed. Current substring `ILIKE '%query%'` search does not gain a useful general solution from a simple name B-tree. No speculative status, trigram or synchronization indexes were added; future measured requirements can justify them.

Normal Edit preserves all runtime fields even when URL, username or password changes. CRUD never resets persisted checkpoints or validates connections. The separately approved [listener foundation](VENDOR_SYNC.md) now reconnects asynchronously on connection changes, preserving memory sequence for credential changes and starting from zero for a changed URL in the current manager lifetime. Durable source-identity/reset semantics remain undecided. Standard URL serialization retains `/products-db` and trailing path slashes, adds `/` to an empty path and applies WHATWG encoding/dot-segment normalization; no custom removal of database/path components occurs.

Vendor CRUD is completed/frozen after the supplemental security review and full production regression. Future Sync Service may load active Vendors, decrypt credentials server-side and own connection/change processing plus runtime writes; these are conceptual boundaries only, with exact behavior still unapproved. See architecture section 41 and the activation report.

## Explicit synchronization reset

The separately approved [Reset Sync Data action](VENDOR_RESET_SYNC.md) is now available in the Vendor menu with `vendors.reset_sync`. POST `/cpanel/api/vendors/:id/reset-sync` requires that independent permission plus CSRF, and accepts only `{}`. It clears selected derived stock/snapshots and progress, keeps all configuration/source entities, and restarts an active worker. The current durable lifecycle and source-binding rules supersede the historical listener-only notes above; normal CRUD still cannot write runtime fields.
