# CPanel users, authentication and permissions

This stage implements the approved login backend. It adds no user/permission management UI, roles, self-service flows, profile editing, dashboard, Media integration or business socket events.

## Schema

Migration [003_cpanel_auth.sql](../src/database/migrations/003_cpanel_auth.sql) adds four tables. All timestamps below are `timestamptz NOT NULL DEFAULT now()` unless specified. Update triggers maintain `updated_at` even for direct SQL updates.

| Table | Columns |
| --- | --- |
| `cpanel_users` | `id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY`, `name text NOT NULL` (nonblank), nullable `phone text`, `job text`, `avatar_url text`, `created_at`, `updated_at` |
| `cpanel_user_auth` | `user_id bigint PRIMARY KEY`, `email text NOT NULL UNIQUE`, `password_hash text NOT NULL`, `created_at`, `updated_at` |
| `cpanel_user_permissions` | `user_id bigint NOT NULL`, `key text NOT NULL` (nonblank), `value jsonb NOT NULL`, `created_at`, `updated_at`; composite primary key `(user_id,key)` |
| `cpanel_sessions` | `token_hash text PRIMARY KEY` (64 lowercase hex characters), `user_id bigint NULL`, `csrf_token text NOT NULL`, `created_at`, `expires_at timestamptz NOT NULL` |

All `user_id` foreign keys reference `cpanel_users(id) ON DELETE CASCADE`. Deleting a profile removes its credentials, permissions and sessions. Primary/unique constraints supply indexes for profile identity, auth identity, email, per-user permission lookup, and session-token lookup. Sessions additionally index `user_id` and `expires_at` for cascading deletion and expiry cleanup. No redundant email/profile fields exist. IDs remain strings in JavaScript to preserve bigint precision.

Email uses `trim().toLowerCase()` for bootstrap and login. Database checks enforce lowercase trimmed, non-whitespace `local@domain.suffix` form and at most 254 characters. Provider-specific dot/plus transformations are intentionally absent. This is one canonical case-insensitive email identity; phone and job never participate in authentication.

## Passwords and bootstrap

The `argon2` package implements Argon2id with a random library-generated salt, 64 MiB memory, 3 iterations and parallelism 1. It stores the encoded hash only. Parameters exceed the [OWASP Argon2id minimum](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html). Bootstrap requires 12 or more characters and at most 1024 UTF-8 bytes. Login imposes the same byte ceiling without trimming/changing passwords. Unknown validly formatted accounts verify against an ephemeral dummy hash; responses do not distinguish an unknown email from a wrong password.

Run explicitly in your own terminal after migration:

```sh
npm run cpanel:bootstrap
```

The command asks for missing name, email and a **hidden password**. It does not write the password to a file. For noninteractive use, supply `CPANEL_SUPERUSER_NAME`, `CPANEL_SUPERUSER_EMAIL`, `CPANEL_SUPERUSER_PASSWORD` through the process environment. Optional profile inputs are `CPANEL_SUPERUSER_PHONE`, `CPANEL_SUPERUSER_JOB`, `CPANEL_SUPERUSER_AVATAR_URL`. `.env.example` documents empty placeholders only. Do not put real credentials in committed files, shell arguments, screenshots, reports or test fixtures. Production command: `npm run cpanel:bootstrap:production` after build/migration.

Bootstrap runs under an advisory transaction lock. Profile, auth and `superuser` JSONB literal `true` are inserted in one transaction. Concurrent/repeated bootstrap with the same normalized email creates one account. An existing Super User is left entirely unchanged; an existing non-superuser email causes an explicit error with no silent promotion. Bootstrap never runs on application startup. This command is an administrator operation, not a public registration endpoint.

## Permissions

`PermissionContext` is constructed with a server-validated user identity once per HTTP request. Its first lookup loads that user's permission map; concurrent and repeated lookups share the same promise. A new request reloads permissions, so revocations are not hidden by session-lifetime caching.

- `hasPermission(key)`: no authenticated identity → false; exact JSON boolean `superuser=true` → true for any key; otherwise only exact JSON boolean `true` for the requested key allows access. Missing, false, numbers, strings and objects deny.
- `getPermissionValue(key)`: returns the actual JSONB value or `undefined`. Super User does not invent numeric limits or configuration objects.
- `requirePermission(key)` uses the same context and returns localized 403 on denial.

`job` is display-only. There is no roles system, `is_superuser` column or SuperUser role.

## Sessions and HTTP flow

A conventional opaque bearer token comes from 32 cryptographically random bytes. PostgreSQL stores only its SHA-256 digest, user reference, CSRF token and expiry. SHA-256 here indexes a high-entropy session token; passwords use Argon2id. No custom password cryptography is implemented.

Cookie: `hormat_cpanel` in development/test, `__Secure-hormat_cpanel` in production. Flags: `HttpOnly`, `SameSite=Lax`, `Path=/cpanel`, `Secure` in production, no Domain. Absolute expiry is 8 hours after login; anonymous login/CSRF sessions last 20 minutes. No sliding expiry or remember-me. Production must use HTTPS; local production browser tests use Chrome's trusted loopback origin.

`loadCpanelAuth` validates token format, rejects duplicate cookie names, queries an unexpired session, loads only profile fields, and creates the request permission context. Auth responses are `Cache-Control: no-store` and disallow framing. Expired sessions are rejected immediately and physically cleaned on new-session creation; cleanup can also be run administratively using `DELETE FROM cpanel_sessions WHERE expires_at <= now()`.

| Route | Behavior |
| --- | --- |
| `GET /cpanel/login` | Authenticated → 303 `/cpanel`; otherwise create/reuse anonymous CSRF session and render approved form |
| `POST /cpanel/login` | Limited body and attempts; validate synchronizer CSRF token, normalize email, verify hash; invalid credentials → localized generic 401; success transactionally deletes old session and creates a fresh token/CSRF pair, then 303 `/cpanel` |
| `GET /cpanel` | `requireCpanelAuth` redirects unauthenticated requests to `/cpanel/login`; otherwise render foundation heading, escaped user name and logout form |
| `POST /cpanel/logout` | Authentication and CSRF required; delete server session, clear cookie, 303 `/cpanel/login` |

The login form also works without JavaScript. Browser code retains password visibility, local validation and language selection; actual authentication always happens on the server. Raw passwords/hashes are never passed to EJS, API responses or application logs. HTTP error logging omits request bodies and error objects that could contain submitted data.

`express-rate-limit` bounds login POSTs to 30 per IP per 15 minutes, including malformed attempts. This lightweight store is process-local and resets on restart; it is suitable for the current single-process application. A multi-instance deployment must deliberately share/enforce throttling at its trusted ingress. Express does not blindly trust forwarded IP headers; reverse proxy trust must be configured to the actual deployment topology. Session persistence itself is PostgreSQL-backed and survives process restarts.

## Socket.IO

Existing public Socket.IO infrastructure remains intact and conveys no CPanel authorization. An open socket is not an authenticated user. The `/cpanel` cookie path deliberately does not authenticate `/socket.io`. Before adding protected events, design explicit validation against the server-side session and reuse the permission service; do not infer identity from connection presence or browser-supplied user IDs.

## Localization and verification

Migration [004_cpanel_auth_translations.sql](../src/database/migrations/004_cpanel_auth_translations.sql) adds six keys with complete tm/ru/en values: `cpanel.auth.invalidCredentials`, `invalidRequest`, `forbidden`, `tooManyAttempts`, `signedInAs`, `logout` (all under `cpanel.auth`). Old mock-only keys remain in historical migration seeds but are no longer rendered.

Run `npm run localization:check`, `npm test`, `npm run build`, and `TEST_PRODUCTION=1 npm test`. `CHROME_PATH=/usr/bin/google-chrome` selects the local browser. Run `npm run localization:verify` against the actual running server after refreshing its localization cache.

Unit integration tests use random isolated schemas. Browser and live-localization tests create randomly named temporary Super Users with random memory-only passwords and remove those profiles afterward (cascading auth/permissions/sessions). They never use/reset the owner's account. Interrupted tests may leave temporary records requiring review/cleanup; normal test completion removes them.

## Account status and Users activation

Migration 013 adds `cpanel_user_auth.is_active` (NOT NULL, default true); existing accounts remain active. Login returns the existing generic failure for inactive accounts. Session lookup joins current active auth, and session creation/profile/password transactions revalidate active auth under lock. Users deactivation and administrator password changes delete all target sessions atomically. Reactivation requires a new login. See [Users management](CPANEL_USERS.md) and architecture section 34 for permission and protected-target rules.
