# HORMAT V4 — Activate Current User Change Password

## Implemented scope

Activated only **POST /cpanel/profile/password** in the existing server-rendered CPanel profile. Basic Information and Change Photo remain UI-only. No email change, user management, administrator reset, recovery, 2FA or password history was added.

## Validation and hashing

The endpoint accepts currentPassword/newPassword/confirmPassword and the existing `_csrf` transport field. Unknown fields, including user_id, are rejected. Target user and current session are taken only from authenticated server locals.

Server checks required strings, current-password match, central password policy, exact confirmation and a new password different from the current one. The existing bootstrap policy is now named `meetsPasswordPolicy` and reused by `hashPassword`: minimum 12 JavaScript string code units, maximum 1024 UTF-8 bytes. No trimming or new composition rule was introduced.

The same Argon2id implementation is retained: memoryCost 65536, timeCost 3, parallelism 1. No plaintext is persisted or logged, and hashes are never passed to profile templates.

## SQL and session behavior

No business schema change was needed. A new focused repository uses parameterized SQL in one transaction:

1. Lock the current user's authentication row.
2. Recheck and lock the authenticated, unexpired current session by server-held token_hash and user_id.
3. Verify old password and compute the new hash using the shared service.
4. Update only `cpanel_user_auth.password_hash`; existing trigger updates `updated_at`.
5. Delete all other session rows belonging to this same user.
6. Commit, or roll everything back on error.

The current token/expiry stay unchanged. Other users' sessions are untouched. Concurrent changes serialize and cannot proceed using a just-invalidated session. Login session creation takes the same auth-row lock and checks the hash actually verified by login, preventing an old-password login from inserting a session after password-change commit.

## CSRF, limiting and UI

Existing CSRF middleware and session/cookie protection are reused. Missing/invalid CSRF returns the existing localized 403. No new session/CSRF architecture was introduced.

Existing express-rate-limit infrastructure permits **10 CSRF-valid attempts per account per 15 minutes**. Invalid values and successful changes count. It is an in-memory limiter for the current single process; restart resets counters, and multi-process deployment would require shared limiter storage for a global quota.

The approved two-tab UI is preserved. Required-field and confirmation checks run client-side; policy/security checks remain server-authoritative. The submit button is disabled while sending; show/hide remains shared with login. Server responses render empty password fields, keep Change Password selected and display a localized status message. With JavaScript the URL becomes `/cpanel/profile#password`. Without JavaScript the same result renders at the POST URL; browser refresh can prompt resubmission. No successful persistence is claimed for Basic Information.

Unexpected errors return a generic localized failure, without details or stack traces. Submitted bodies are removed from the request before rendering and never supplied to EJS or logging.

## Localization

Applied migration **008_cpanel_password_translations.sql** to the development database; refreshed its running localization cache. Added **8 keys / 24 real tm/ru/en values**:

`cpanel.password.required`, `.policy`, `.mismatch`, `.same`, `.incorrect`, `.success`, `.failure`, `.limited`.

Reused existing labels, CSRF and generic request messages. Current inventory: **121 used keys**, **128 seeded keys / 384 database values**. The live verifier changes only its disposable random verification account and removes it afterward.

## Files

Created `src/cpanel/auth/password-change.ts`, `password-change-repository.ts`, migration 008, `tests/unit/password-change.test.ts`, `tests/password-change.spec.ts`, `docs/CPANEL_PASSWORD.md` and this report.

Updated shared password policy, login authentication/session creation, profile controller and POST route, profile tab template/client behavior, shell language return destination, existing profile UI expectations and localization tests/verifier. Updated ARCHITECTURE section 29, profile/localization documentation and README. Navigation and permission configuration were not changed.

## Executed checks

- `npm run typecheck`: passed, exit 0.
- `npm run build`: passed, exit 0, including compiled server and production assets/views/migrations.
- `npm run db:migrate`: migration 008 applied successfully.
- `npm run localization:check`: passed for all 121 used keys and tm/ru/en values.
- `CHROME_PATH=/usr/bin/google-chrome npm run localization:verify`: passed against actual :3000 server, including translated password errors/success, cleared fields, retained session, profile, shell, login/logout, languages and Frontend.
- `CHROME_PATH=/usr/bin/google-chrome npm test`: **25/25 unit/server tests and 37/37 browser tests passed**.
- `TEST_PRODUCTION=1 CHROME_PATH=/usr/bin/google-chrome npm test`: **25/25 unit/server tests and 37/37 browser tests passed**, using the compiled application through `npm start`.

New focused database tests pass: every validation category; old password no longer verifies/new does; auth updated_at changes; profile/email/permissions unchanged; no plaintext in persisted account rows; current/other/unrelated session behavior; stale-login rejection; concurrent changes; transaction rollback when session deletion fails.

Browser checks pass for tm/ru/en: unauthenticated protection, CSRF, injected target rejection, real error/success values, empty password fields, active password tab, current-session continuity, actual account-scoped rate limiting and Basic Information safety. Existing regression covers login/logout/authentication, Super User, permissions, profile UI, shell/sidebar/navigation, theme, language switching, mobile, Socket.IO and Frontend.

Initial full run required updating an obsolete UI-only assertion (no forms now applies only to Basic Information); two shell checks were interrupted by the development server restarting during a source edit. The live verifier was adjusted to await page loading before subsequent menu navigation. Production API checks also explicitly forward the disposable test session cookie: the API client does not apply Chromium’s Secure-cookie exception for trusted loopback HTTP. Application cookie security was not changed. Final clean runs are recorded above.

## Security review

- No plaintext password or submitted hash is persisted/logged; only the new Argon2id hash reaches password storage.
- Queries are parameterized; only authenticated user/session identifiers select target rows.
- Current-password verification is mandatory, confirmation/policy/same-password checks run server-side.
- Existing CSRF is enforced and repeated guesses are bounded by account.
- Password update and session invalidation are atomic; failure and concurrency behavior are tested.
- Other-user sessions, profile fields, email and permissions remain unchanged.
- Passwords/hashes are not rendered; password inputs are empty after server responses.
- Generic unexpected-failure messages expose no internal information.

## Explicit answers

- Does password change require the current password? **YES**.
- Can the request select another user ID? **NO**.
- Is any plaintext password stored/logged? **NO**.
- Does the current session remain active after success? **YES**.
- Are the user's other sessions invalidated? **YES**.
- Was Basic Information backend activated? **NO**.
- Are all new visible messages backed by real tm/ru/en database translations? **YES**.

Known limitations: single-process in-memory rate-limit counters; without JavaScript a rendered POST response may prompt resubmission on refresh. No unresolved functional/security defect is known. Documentation links were checked successfully. The change is ready for review; work stops here. No other profile functionality was activated.
