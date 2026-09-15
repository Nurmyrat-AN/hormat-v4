# HORMAT V4 — Users Management activation

## Scope and outcome

The approved Users UI is connected to real PostgreSQL search and administrative create/edit/status/password operations. Both supplied requirement documents (sections 1–54 and 55–77) were used. No Permissions management, roles, public recovery or unrelated module was implemented.

## Database and authentication

1. **Migration 013:** `cpanel_user_auth.is_active BOOLEAN NOT NULL DEFAULT TRUE`.
2. **Status ownership:** authentication only. `cpanel_users` remains a profile table without status.
3. **Existing accounts:** after migration, a read-only check of the development DB reported one account, zero inactive accounts, zero inactive Super Users. Existing credentials/profile/permissions were not rewritten.
4. **Login:** normalized email/password flow and Argon2id remain central. Inactive accounts receive the same generic invalid-login response as invalid credentials, including password verification work.
5. **Sessions:** session lookup checks current auth status. Login/session creation locks and revalidates active auth and the verified password hash. Existing profile/password transactions revalidate active auth too. Deactivation deletes every target session in the same transaction as the status change. Reactivation never restores deleted sessions. Admin password change invalidates every target session, including the current session if a normal administrator targets themselves. Other users' sessions remain valid.

## Real Users operations

6. **List:** authenticated `GET /cpanel/users` renders the initial real data. Separate JSON routes are mounted under `/cpanel/api/users`; page/EJS and JSON controllers remain separate. Safe rows include profile fields, email, active state and derived protection flag only.
7. **Search:** PostgreSQL parameterized, case-insensitive partial ILIKE. Trusted Name/Email/Phone/Job/All mapping; literal percent/underscore/backslash escaping. Server pagination is nine rows, deterministic ID order, with total/page/pageSize. No full-directory download.
8. **Filters:** empty query / Name / Active are server and UI defaults. Active/Inactive map to auth status, All removes status restriction. Grid/List consume the same server result, retain filters and preserve browser-local view preference. Debounce stays 300 ms; cancellation and request sequence checks prevent old responses replacing new results. Search failure stays inline and can be retried with the next interaction.
9. **Add:** creates only a normal user, with profile and auth inserted atomically. Existing status selector is honored; Active remains default. Email normalization/uniqueness and central password policy/hash apply. No permissions are inserted.
10. **Edit:** changes normal-user name/phone/job/email/avatar only. Password, status and permissions stay unchanged. Name required/≤200 Unicode characters; phone ≤50; job ≤200; control characters rejected. Email uses existing validation and uniqueness.
11. **Avatar:** existing Universal Media uploader waits for upload before Save. Only cacheToken is submitted; trusted service finalizes to `users/avatars`, using the authenticated uploader's ownership. Cache URL is never persisted. Old managed media is removed only after committed replacement. Known rollback compensates newly promoted media. Lost COMMIT acknowledgement retains potentially referenced files and logs reconciliation need, matching Profile's existing safety boundary.
12. **Status:** normal users may be activated/deactivated only with users.status. Deactivation atomically invalidates all target sessions. Normal actors cannot deactivate themselves. Super User targets cannot receive either activation or deactivation mutations.
13. **Admin password:** new password + confirmation, no target current password. Central policy/Argon2id; all target sessions invalidated. Password fields are cleared after submission and never returned/logged.

## Authorization and security

14. Independent boolean permissions: `users.view`, `users.create`, `users.update`, `users.status`, `users.change_password`.
15. Both HTTP handlers and service transactions enforce authorization. Only exact JSON boolean true grants authority; absent/false/string/number/object/null deny. Mutations reject unknown fields, including permission-like fields, IDs, avatar URLs and destinations. Authenticated denial is HTTP 403, not a login redirect. All writes require CSRF; JSON bodies are bounded and malformed input returns a localized error. Permitted management attempts are limited to 100 per account per 15 minutes in the current process.
16. **Super User actor:** `superuser=true` alone grants all operation permissions; individual users.* rows are not generated.
17. **Super User target:** always protected, even against the same or another Super User actor or a normal actor with every Users permission. Authority is derived from the exact permission value, never name/email/job/ID/order. UI shows the protected badge/explanation and no usable management actions; services independently reject the target.
18. **Self-management:** Super User remains exclusively under `/cpanel/profile`. Normal self-deactivation is forbidden. Job is organizational display information, never permission authority.
19. **Permission freshness/navigation:** request-local permission caching only; revocation applies to the next request with the same session. Transactions read permissions again. Users availability and actor authorization are separate: enabled navigation is not usable without effective users.view. UI capabilities hide Add and disable forbidden row actions. Permissions remains disabled.

## Localization and files

20. Migration 014 adds **11 backend keys / 33 real tm/ru/en values**: invalidJob, invalidEmail, duplicateEmail, notFound, selfDeactivate, failure, created, updated, activated, deactivated, passwordChanged under cpanel.users. Existing forbidden, profile validation/avatar, password policy/mismatch, protected-target and dialog labels are reused. Totals: **190 canonical keys / 570 required-language values / 177 used UI keys**. Development DB updated and running cache refreshed. No JSON/JS translation dictionary.
21. Changed/created files:

- `src/database/migrations/013_cpanel_auth_status.sql`, `014_cpanel_users_backend_translations.sql`
- `src/cpanel/auth/repository.ts`, `service.ts`, `sessions.ts`, `password-change-repository.ts`; `src/cpanel/profile/repository.ts`
- `src/cpanel/users/repository.ts`, new `service.ts`, `errors.ts`, `presentation.ts`
- `src/controllers/cpanel/users.ts`, new `users-api.ts`; `src/routes/cpanel/index.ts`, new `users-api.ts`
- `src/cpanel/shell/context.ts`, `navigation.ts`
- `src/views/cpanel/pages/users-content.ejs`, `src/views/cpanel/partials/users/dialog.ejs`, `src/public/cpanel/js/users.js`
- Removed `src/public/cpanel/images/users-sample-avatar.svg`; removed runtime mock dataset/toggle/caption
- `tests/unit/users.test.ts`, `tests/unit/database.test.ts`, `tests/users.spec.ts`, `tests/profile.spec.ts`, `scripts/verify-localization.ts`, `package.json`, `playwright.config.ts`
- `docs/ARCHITECTURE.md` section 34, `docs/CPANEL_USERS.md`, `docs/CPANEL_AUTH.md`, `docs/CPANEL_NAVIGATION.md`, localization documentation, README and this report

No dependencies or owner environment values changed. Historical UI-only regression cases were updated to assert the now-approved real behavior, retaining their relevant search/view/dialog/theme/mobile coverage.

## Verification actually executed

22. `npm run typecheck` — passed.
23. `npm run db:migrate` — migrations 013 and 014 applied.
24. `npm run localization:check` — passed, 177 used UI keys have real tm/ru/en values.
25. `CHROME_PATH=/usr/bin/google-chrome npm run localization:verify` — passed against the existing port 3000 development server in all three languages, including real Users creation/search and cleanup, previous profile/password/avatar/login flows.
26. `npm run test:unit` — **40 passed** (34 existing + 6 Users integration tests in isolated schemas).
27. Focused Users browser run — **5 passed**, covering the full real CRUD lifecycle in tm/ru/en, direct HTTP permission matrix and search response races. Additional error-message/UI-permission assertions are included in the full regression below.
28. `npm run build` — passed.
29. `CHROME_PATH=/usr/bin/google-chrome npm test` — **40 unit/integration + 43 core browser + 5 Users browser tests passed**, exit 0.
30. `TEST_PRODUCTION=1 CHROME_PATH=/usr/bin/google-chrome npm test` — **40 unit/integration + 43 core browser + 5 Users browser tests passed**, exit 0. Both browser projects used the compiled production application; production startup, secure sessions, assets/EJS, localization, media URLs, shell and real Users operations verified.
31. Documentation links — passed. Light/dark desktop and mobile screenshots visually inspected.

### Integration scenarios

- **A:** Super User creates/searches/edits normal user, replaces avatar, deactivates, verifies session invalidation/login denial, reactivates, changes password, verifies old password rejection and new login — passed in tm/ru/en focused run.
- **B:** normal restricted administrators, independent grants, missing/false/non-boolean values, direct denied requests, next-request revocation — passed in service and HTTP tests.
- **C:** same/other Super User targets reject all mutations with database unchanged — passed.
- Media cache ownership, finalization/replacement, old-file deletion, invalid token, rollback compensation, password hashing and session isolation are covered across new Users and existing Media/Profile tests.
- New migration preserves preexisting auth records and tests absence of a profile status column. Tests use disposable accounts/isolated schemas and clean up; there are no production mock users.

## Roadmap timing and limitations

Users was already enabled for the previously approved UI stage. This task adds actor authorization to that existing entry; final readiness is confirmed only after activation tests/regression. It would be inaccurate to claim it was disabled before this task. Permissions remains disabled.

Permission changes apply next request. A future permission-writing service must acquire the target auth lock before changing authority to coordinate concurrent mutations; this module never writes permissions. Media filesystem/DB atomicity across process crashes is not claimed; existing post-commit cleanup/unknown-COMMIT reconciliation limitations remain.

## Explicit answers

| Question | Answer |
| --- | --- |
| Is account status stored in cpanel_user_auth.is_active? | **YES** |
| Is account status stored in cpanel_users? | **NO** |
| Can an inactive account log in? | **NO** |
| Are sessions invalidated when a normal user is deactivated? | **YES** |
| Does reactivation restore old sessions? | **NO** |
| Does superuser=true bypass actor permission checks? | **YES** |
| Can even a Super User actor modify a Super User target through Users Management? | **NO** |
| Are missing Users permissions denied? | **YES** |
| Does only JSON boolean true grant a boolean Users permission? | **YES** |
| Can Users CRUD modify cpanel_user_permissions? | **NO** |
| Does Add User create a Super User? | **NO** |
| Are avatar uploads using the existing Universal Media contract? | **YES** |
| Is /cpanel/profile still the only self-management path for Super User? | **YES** |
| Was Users enabled only after this backend stage's regression? | **It was already enabled for approved UI; backend readiness results are recorded above.** |
| Was System → Access → Permissions left disabled? | **YES** |

**Review readiness: complete and ready for review. No known unresolved implementation issues.** The documented media crash/unknown-COMMIT limitations are unchanged. Work stops here; Permissions management was not started.


## Regression harness corrections

The first combined run passed 40 unit/integration tests and 44/48 browser tests. One old profile assertion still expected Users navigation for an actor without any permissions; it was updated to assert hidden navigation and HTTP 403 while profile remains accessible. Three new Users login scenarios exhausted the unchanged 30-attempt IP limit after the older login-heavy suite. `npm test` now runs core and Users browser projects sequentially with a fresh server for each; it still executes all tests and the existing rate-limit test. No product rate limit or authorization was weakened.

The initial production core run passed 42/43 browser tests. The additional direct Users-denial assertion omitted the Secure cookie in Playwright's HTTP client over loopback HTTP and followed a login redirect to 200. It now runs authenticated browser fetch; Users direct HTTP tests explicitly pass their session cookie, following existing Media/Profile tests. Application Secure-cookie behavior is unchanged. Final rerun results are recorded above.
