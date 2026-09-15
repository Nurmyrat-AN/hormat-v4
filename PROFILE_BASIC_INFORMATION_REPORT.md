# HORMAT V4 — Basic Information activation report

## Delivered scope

Activated current-user Basic Information persistence while preserving the approved two-tab profile UI. This is the first real domain consumer of Universal Media Upload/Cache. Users management, email/job changing, Media Library, new business tables, cropping and image optimization remain outside the implementation.

### Route and validation

- **POST /cpanel/profile**: existing authenticated CPanel session + existing CSRF, URL-encoded body (8 KiB request limit).
- Self-editable: **name, phone, avatar**. Visible/read-only: **job, email**.
- Target comes exclusively from the server-side authenticated user/session. No target ID is accepted.
- Accepted fields: name, phone, optional avatarCacheToken and existing _csrf. Unknown fields and query parameters are rejected. No client authority over URLs, paths, destinations, names, credentials or permissions.
- Name: trim, required, maximum 200 Unicode characters, no control characters. Phone: trim, maximum 50 characters, no control characters; empty becomes NULL. No country-specific phone scheme. Existing columns are text with no declared maximum, so these are application validation limits, without schema changes.
- Authentication is revalidated under transaction locks. The repository locks auth → session → user, using the existing authentication lock order and serializing concurrent saves.

### Exact avatar Save flow

Select file → universal authenticated upload → real progress → cacheToken + temporary preview → Save waits if uploading → validate profile/session → Media Service validates owner/token/TTL → finalize to trusted **users/avatars** → receive **/media/users/avatars/<generated UUID>.<extension>** → UPDATE cpanel_users.avatar_url → COMMIT → delete old managed avatar.

Original bytes and generated filenames are preserved. No cache URL, absolute filesystem path or traversal component is stored as a new final avatar URL. Browser supplies only avatarCacheToken. Absent/null token preserves the current avatar. Remove-new-selection clears only the new token and preserves the existing permanent file.

### Replacement and compensation

- Old avatar is read from the locked current profile row, not stale browser input.
- New media must finalize successfully and the profile transaction must COMMIT before old managed media can be deleted.
- Managed deletion belongs to Media Service. It only accepts an exact generated UUID filename within the trusted destination; unknown/external/legacy paths, traversal and symlinks are refused.
- On UPDATE failure after finalization: PostgreSQL rolls back, the newly finalized file is removed, OLD database value/file remains. The consumed token is not revived; client retry/reselection uploads again.
- A lost COMMIT acknowledgement is treated as uncertain: retain files and log a reconciliation need, never delete a potentially referenced new avatar. This conservative branch is tested by committing a real transaction and then simulating the lost acknowledgement.
- Post-COMMIT old-file cleanup failure cannot reverse a successful Save. Compensation/cleanup I/O failures log reconciliation needs. No cross-resource crash-proof atomicity or durable cleanup queue is claimed.

### UI and current-user freshness

The reusable Save gate waits for active upload and prevents duplicate saves. Upload failure blocks Save; profile validation leaves input editable. Controls freeze during the profile request and recover on errors. No second Save click is needed after upload.

After success, the browser performs a fresh GET of Basic Information. Existing auth middleware queries the user per request, so profile and topbar show the new name/avatar without logout. No duplicated profile state was added to sessions. The updated query marker only selects a localized success notice and is immediately removed from browser history; database values remain authoritative.

Email/job are read-only. Password changes still use their separate route. No-JavaScript Save/upload controls remain disabled, preserving the existing UI convention.

## Database/localization

No schema/business table changes. Migration **010_cpanel_profile_update_translations.sql** adds five keys and 15 actual translations:

- cpanel.profile.saved
- cpanel.profile.invalidName
- cpanel.profile.invalidPhone
- cpanel.profile.avatarFailed
- cpanel.profile.failure

Generic errors.invalidRequest and existing media/form labels are reused. Current totals: **144 seeded keys, 432 tm/ru/en values, 135 used UI keys**. Migration applied to the current development database. The running server's stale localization cache was refreshed with its supported SIGUSR2 signal, then actual browser translations and Save were verified again successfully in all three languages. No hardcoded language dictionaries or known untranslated keys.

## Files created/modified

- New: src/cpanel/profile/service.ts, src/cpanel/profile/repository.ts.
- Route/controller: src/routes/cpanel/index.ts, src/controllers/cpanel/profile.ts.
- Shared Media Service: src/media/store.ts (managed deletion).
- UI: src/views/cpanel/pages/profile-content.ejs, src/public/cpanel/js/profile.js.
- Localization: migration 010, scripts/verify-localization.ts.
- New tests: tests/unit/profile-update.test.ts, tests/profile-update.spec.ts.
- Updated regressions: tests/unit/database.test.ts, tests/profile.spec.ts, tests/password-change.spec.ts, tests/media.spec.ts. Universal uploader tests exercise an explicit test callback; new domain tests exercise real persistence.
- Documentation: docs/ARCHITECTURE.md section 31, docs/CPANEL_PROFILE.md, docs/MEDIA.md, docs/MEDIA_UPLOAD_CONTRACT_V1.md (later profile-scope authorization noted), docs/LOCALIZATION.md, docs/INTERFACE_TRANSLATIONS.md, README.md, this report.

No new dependencies. No owner .env changes. This workspace has no Git repository metadata; no commit was created.

## Verification results

- npm run typecheck: passed.
- npm run build: passed; compiled production assets/migrations prepared.
- npm run db:migrate: migration 010 applied.
- npm run localization:check: passed, 135 used keys have real tm/ru/en values.
- CHROME_PATH=/usr/bin/google-chrome npm run localization:verify: passed against running port 3000, including translated Save success/validation, final media URL, unchanged auth, password change and logout in tm/ru/en.
- `CHROME_PATH=/usr/bin/google-chrome npm test`: **34 unit/integration tests and 43 browser tests passed**.
- `TEST_PRODUCTION=1 CHROME_PATH=/usr/bin/google-chrome npm test`: **34 unit/integration tests and 43 browser tests passed**, using the compiled build and npm start.
- Documentation links: passed.

The initial browser run passed 41/43 tests; two universal-uploader test callbacks exposed an empty status paragraph after retirement of the old mock notice. Their test fixtures were updated to explicitly display their test callback completion, preserving zero-persistence coverage for the reusable uploader. No production behavior was weakened.

Verified integration outcomes: full cache upload → final file → DB URL lifecycle; exact original bytes; cache consumption; old avatar deletion after replacement; no-new-avatar preservation; invalid/forged/foreign/expired/consumed/missing/traversal tokens rejected; protected fields unchanged; rollback compensation; concurrent saves and safe managed deletion. Test data uses temporary accounts, isolated schemas and media storage. Real owner profile/credentials were not modified.

Screenshots artifacts/profile-saved-*-light.png, *-dark.png and *-mobile.png were visually reviewed for representative English desktop light/dark and Russian mobile. Layout and read-only controls remain usable, with no horizontal page overflow.

Full regressions cover login/logout, password change, sessions/CSRF, Super User/permissions, universal upload/cache/finalization, localization, profile, shell/navigation, theme/language, Socket.IO and Frontend.

## Explicit answers

| Question | Answer |
| --- | --- |
| Can the user change their own name? | **YES** |
| Can the user change their own phone? | **YES** |
| Can the user change their avatar? | **YES** |
| Can the user change their job here? | **NO** |
| Can the user change their email here? | **NO** |
| Does this Save store /media/cache/... as a final avatar? | **NO** |
| Does the browser control the final media destination? | **NO** |
| Is the old managed avatar deleted only after successful replacement? | **YES** |
| Does Save wait when avatar upload is still running? | **YES** |
| Was Users management enabled? | **NO** |

Operational limits: uncertain COMMIT acknowledgement, process crashes and cleanup I/O failure require reconciliation as documented above; the application protects potentially referenced files. There are no newly introduced email/job/permission mutation paths.

## Completion

No unresolved implementation failures were found in the executed checks. The documented cross-resource operational limits remain explicit. **Universal Media Upload/Cache has been successfully validated by its first real domain consumer, My Profile.** This stage is complete and ready for review; no subsequent module was started.
