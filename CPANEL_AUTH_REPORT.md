# HORMAT V4 — CPanel authentication foundation report

## Request and implementation

The approved login UI now performs real email/password authentication. `/cpanel` requires an authenticated PostgreSQL session and shows the user's escaped display name with a real logout form. The existing layout, local image, assets, language selector and password toggle are preserved; there is no dashboard or Users/Permissions management UI.

The owner explicitly authorized this domain/schema in the attached authentication-foundation specification. No unrelated module, role model, self-service flow or business Socket.IO event was added.

## Database and architecture

Applied migration **003_cpanel_auth.sql** adds:

- `cpanel_users`: `id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY`; `name text NOT NULL CHECK(nonblank)`; nullable `phone text`, `job text`, `avatar_url text`; `created_at`, `updated_at` both `timestamptz NOT NULL DEFAULT now()`.
- `cpanel_user_auth`: `user_id bigint PRIMARY KEY REFERENCES cpanel_users(id) ON DELETE CASCADE`; normalized `email text NOT NULL UNIQUE`; `password_hash text NOT NULL` constrained to Argon2id encoding prefix; `created_at`, `updated_at` as above.
- `cpanel_user_permissions`: `user_id bigint NOT NULL REFERENCES cpanel_users(id) ON DELETE CASCADE`; nonblank `key text NOT NULL`; `value jsonb NOT NULL`; same timestamps; composite primary key `(user_id,key)`.
- `cpanel_sessions`: `token_hash text PRIMARY KEY` constrained to 64 lowercase hex digits; nullable `user_id bigint REFERENCES cpanel_users(id) ON DELETE CASCADE`; `csrf_token text NOT NULL`; `created_at timestamptz NOT NULL DEFAULT now()`; `expires_at timestamptz NOT NULL`. Anonymous rows supply login CSRF protection. Additional indexes: `user_id`, `expires_at`.

Primary/unique indexes cover identity, normalized email and per-user key uniqueness. Triggers maintain all three `updated_at` columns. No existing domain schema changed. All dependent auth/permission/session records cascade when a profile is deleted. No `is_superuser`, roles, groups or duplicate profile email.

Password hashing: **Argon2id, 64 MiB, 3 iterations, parallelism 1**, library-generated random salt. Bootstrap enforces minimum 12 characters and maximum 1024 UTF-8 bytes. Email normalization uses trim + lowercase and the same database-enforced canonical form, with format/length validation. No provider-specific alias rewriting.

Explicit bootstrap: `npm run cpanel:bootstrap` (or compiled `cpanel:bootstrap:production`). Missing inputs are requested interactively; password entry is hidden. `CPANEL_SUPERUSER_*` environment inputs are supported with empty placeholders documented in `.env.example`. A transaction/advisory lock serializes creation of profile, auth and `superuser` JSONB boolean `true`. Repeated/concurrent invocation for the same normalized email does not duplicate or modify an existing Super User. An existing normal account is not silently promoted. Nothing runs automatically on startup.

`PermissionContext` shares one loaded permission map within a request, including concurrent lookups. It reloads for each new request. `hasPermission` allows exact `superuser=true`, otherwise only exact requested JSON boolean `true`; missing/false/other JSON types deny. `getPermissionValue` returns actual JSONB values without inventing values for Super Users. Identity is supplied by server-side authentication middleware. `job` is display-only.

## Sessions, routes and security review

Server-side PostgreSQL sessions persist across process restarts. Cookie holds only 256 random bits encoded as hex; the database stores their SHA-256 digest. No password/hash/profile data appears in the cookie. Authenticated sessions expire absolutely after 8 hours; anonymous login sessions after 20 minutes. Expired rows are rejected immediately and cleaned on session creation.

Cookie: `hormat_cpanel` in development/test, `__Secure-hormat_cpanel` in production; `HttpOnly`, `SameSite=Lax`, `Path=/cpanel`, explicit expiry, no Domain, `Secure` in production. Production requires HTTPS. Local production tests use Chrome's trusted loopback origin.

- `GET /cpanel/login`: render anonymous login, or redirect authenticated users to `/cpanel`.
- `POST /cpanel/login`: rate/body limits → session-bound CSRF verification → email normalization → parameterized credential lookup → Argon2id verification → transactional session rotation → 303 `/cpanel`. Invalid email/password returns the same localized generic 401, and no password is echoed.
- `GET /cpanel`: `requireCpanelAuth` redirects unauthenticated visitors to `/cpanel/login`; otherwise renders the minimal protected foundation.
- `POST /cpanel/logout`: validate auth and CSRF → delete persistent session → clear cookie → 303 `/cpanel/login`.

Security checks cover plaintext rejection, parameterized SQL, FK/unique constraints, exact boolean default-deny semantics, generic errors, session fixation/rotation, expired-session rejection, cookie flags, logout/replay rejection, CSRF including malformed/multibyte tokens, permission refresh and bootstrap rollback. Passwords/hashes are not passed to EJS, API responses or application logs; HTTP error logging no longer prints request-bearing error objects. Auth pages disallow framing and shared caching. Login also works without JavaScript.

Login throttling is 30 POSTs per IP per 15 minutes, process-local for the current single-process deployment. It resets on restart; multiple application instances require deliberate shared ingress throttling. Proxy trust is not blindly enabled. This is a documented deployment limitation, not a persistent session limitation.

Socket.IO remains public infrastructure with no privileged events. Connection presence never grants authentication; the CPanel-path cookie does not authenticate `/socket.io`. Future protected events must explicitly validate persistent sessions and use permissions.

## Localization

Applied **004_cpanel_auth_translations.sql** adds six keys, each with real tm/ru/en values (18 rows):

- `cpanel.auth.invalidCredentials`
- `cpanel.auth.invalidRequest`
- `cpanel.auth.forbidden`
- `cpanel.auth.tooManyAttempts`
- `cpanel.auth.signedInAs`
- `cpanel.auth.logout`

There are 40 seeded keys / 120 values; 38 currently used keys. Two retired mock messages remain in historical migration seeds. The actual development server's stale localization cache was detected by live verification and refreshed with its documented development signal; live verification then passed.

## Files

Created: `src/cpanel/auth/{password,repository,permissions,bootstrap,bootstrap-cli,sessions,http,service}.ts`; migrations 003/004; `tests/auth-fixture.ts`, `tests/auth.spec.ts`, `tests/zz-auth-limit.spec.ts`, `tests/unit/auth.test.ts`; `docs/CPANEL_AUTH.md`; this report.

Modified: `src/routes/cpanel/index.ts`, `src/controllers/cpanel/login.ts`, `src/views/cpanel/pages/{login,index}.ejs`, `src/public/cpanel/js/login.js`, `src/app/index.ts`; `package.json`, `package-lock.json`, `.env.example`; existing foundation/login/localization/database tests; `scripts/verify-localization.ts`; `AGENTS.md`, `README.md`, `docs/ARCHITECTURE.md`, `docs/LOCALIZATION.md`, `docs/CPANEL_LOGIN.md`, `docs/INTERFACE_TRANSLATIONS.md`.

Added focused dependencies: `argon2`, `express-rate-limit`. npm installation reported zero audit vulnerabilities. CSS, images, original localization migrations and user `.env` were not changed. npm/package-lock remain the documented installation workflow.

## Verification and remaining setup

| Check actually executed | Result |
| --- | --- |
| `npm run typecheck` | Passed, exit 0 |
| `npm run build` | Passed, exit 0; compiled app, migrations, EJS and browser assets prepared |
| `npm run db:migrate` | Applied 003 and 004 successfully |
| `npm run db:migrate:production` | Passed; no pending migrations, no duplicate data |
| `CHROME_PATH=/usr/bin/google-chrome npm test` | 20/20 Node tests and 25/25 browser tests passed |
| `CHROME_PATH=/usr/bin/google-chrome npm test -- tests/zz-auth-limit.spec.ts` | 20/20 Node tests and the additional development throttle test passed |
| `TEST_PRODUCTION=1 CHROME_PATH=/usr/bin/google-chrome npm test` | 20/20 Node tests and all 26/26 browser tests passed; compiled production server started successfully |
| `npm run localization:check` | Passed: 38 used keys with real tm/ru/en values |
| `CHROME_PATH=/usr/bin/google-chrome npm run localization:verify` | Passed against existing server :3000: 9 route/language checks, selector checks, real invalid/valid login, protected page, CSRF errors and logout in all three languages |
| Database final inspection | Migration ledger contains 001–004; zero remaining CPanel test profiles |
| Documentation links and desktop screenshot review | Passed; login geometry/layout preserved |

Early checks caught and resolved two test assumptions: Argon2 parameter serialization order and a manually supplied language Cookie header incompatible with normal browser session cookies. Live verification also detected the stale translation cache, which was refreshed. No known test failures remain. The existing harmless test-runner color-environment warnings appeared; expected oversized-body tests logged sanitized error names.

The permanent owner Super User has **not** been created: no owner name/email/password was supplied in the current bootstrap environment. An input request was sent. Tests/bootstrap verification create temporary accounts with random memory-only passwords and remove them afterward. The owner can finish setup in their terminal with `npm run cpanel:bootstrap`; there is no default password or publicly known account.

Explicit confirmations:

- Any plaintext CPanel password persisted to database/source/files by this implementation? **NO**. Passwords necessarily exist transiently in process memory during input/hash verification.
- Does exact JSON `superuser=true` grant every boolean permission without individual rows? **YES**.
- Does `job` affect permissions? **NO**.
- Are permissions direct per-user `key → JSONB value`? **YES**.
- Does unauthenticated `/cpanel` redirect to `/cpanel/login`? **YES**.

Implementation is ready for review after the checks below; owner-account provisioning remains a clearly identified setup step. No subsequent stage has started.
