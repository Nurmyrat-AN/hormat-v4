# Universal Media Upload V1 — implementation report

## Request and decisions

Implemented the owner's exact universal upload contract and subsequent clarification: accept all file formats, without a format allowlist. No application size cap is enabled by default (`MEDIA_MAX_UPLOAD_BYTES=0`). MIME and image dimensions are descriptive only; unknown, malformed and empty files remain accepted. Original bytes are preserved. Existing authentication and CSRF protection remain in force; multipart must contain exactly one `file`, without destination or domain fields.

## Delivered behavior

- `POST /cpanel/media/upload`: authenticated multipart upload, exact HTTP 201 `{success:true,media:{cacheToken,url,originalName,mimeType,size,width,height}}` response; stable upload error codes with localized UI messages.
- Streaming disk writes, generated filenames, bounded MIME inspection and best-effort image metadata; no resizing, conversion or compression.
- Reusable EJS/JS uploader with idle/uploading/uploaded/error states, real XHR progress, temporary preview/download, retry, cancellation and reselection guards.
- Shared Save gate waits automatically, prevents duplicate Save, blocks errors and uses only the latest selection's token. Idle selection supplies no new media. Cache URLs are never authoritative model input.
- Remove clears the temporary selection and restores the existing image; it does not delete permanent media.
- Internal `finalizeCachedMedia({cacheToken,destination,ownerId})` checks ownership/expiry, atomically claims the token once, moves unchanged bytes to a trusted backend destination and returns the final URL. No browser finalization endpoint exists.
- Private filesystem metadata survives restart. Default cache TTL is 24 hours; startup/hourly cleanup leaves permanent files alone. Controlled `/media/...` serving hides private metadata and paths. Non-raster files download with nosniff and sandbox CSP.
- Profile selection now performs a real temporary upload. Basic Information Save remains preview-only. No profile/email/avatar/password update was added; the already-approved password-change feature remains separate.
- No Media database table, Media management page, new permission or sidebar enabling.

## Localization and database

Migration `009_cpanel_media_translations.sql` was applied to the current development database; running localization was refreshed and verified through the browser.

11 new `cpanel.media.*` keys: `fileRequired`, `fileTooLarge`, `typeNotAllowed`, `fileInvalid`, `uploadFailed`, `uploading`, `uploaded`, `chooseFile`, `removeSelection`, `retry`, `previewFile`. Each has real tm, ru and en SQL values (33 additions). `typeNotAllowed` is reserved for contract compatibility; unrestricted V1 does not reject formats. Existing profile Save/preview text is reused. The former profile-only avatar action key remains historical seed data.

Current totals: 139 seeded keys, 417 required-language values, 131 used UI keys. No JS/JSON translation dictionaries. No known missing real tm/ru/en values or exposed semantic keys.

## Files created/modified

- Infrastructure: `src/media/{index,errors,store,metadata,multipart,http}.ts`, `src/controllers/cpanel/media.ts`.
- Integration/config: `src/routes/cpanel/index.ts`, `src/cpanel/auth/http.ts`, `src/app/index.ts`, `src/server.ts`, `src/config/env.ts`, `.env.example`, `.gitignore`.
- UI: `src/views/cpanel/partials/media/uploader.ejs`, `src/views/cpanel/pages/profile-content.ejs`, `src/views/cpanel/layouts/application.ejs`, `src/public/cpanel/js/media/uploader.js`, `src/public/cpanel/js/profile.js`, `src/public/cpanel/css/media-uploader.css`.
- Dependencies: `package.json`, `package-lock.json`; Busboy streaming parser, file-type descriptive identification, Sharp image metadata, Busboy TypeScript types. No additional UI framework or ORM.
- Localization: migration 009; `scripts/verify-localization.ts`, `docs/LOCALIZATION.md`, `docs/INTERFACE_TRANSLATIONS.md`.
- Tests: `tests/unit/media.test.ts`, `tests/media.spec.ts`, `tests/unit/database.test.ts`, `tests/profile.spec.ts`, `playwright.config.ts` (isolated `.test-media` root).
- Permanent documentation: `docs/ARCHITECTURE.md` section 30, `docs/MEDIA_UPLOAD_CONTRACT_V1.md`, `docs/MEDIA.md`, `docs/CPANEL_PROFILE.md`, `README.md`, this report.

## Verification

- `npm run typecheck`: passed.
- `npm run build`: passed, production assets and migrations copied successfully.
- `npm run db:migrate`: migration 009 applied successfully.
- `npm run localization:check`: passed, 131 used keys have real tm/ru/en values.
- `CHROME_PATH=/usr/bin/google-chrome npm run localization:verify`: passed against the actual server on port 3000 in all three languages, including real temporary uploads and unchanged profile rows.
- `CHROME_PATH=/usr/bin/google-chrome npm test`: **29 unit/integration tests and 40 browser tests passed**.
- `TEST_PRODUCTION=1 CHROME_PATH=/usr/bin/google-chrome npm test`: **29 unit/integration tests and 40 browser tests passed**, using `npm start` and the production build.

Coverage includes login/authentication/logout, Super User, permission foundation, session behavior, password changing, fresh migrations, localization, shell/sidebar roadmap, pin/collapse/mobile, theme/language switching, Frontend and Socket.IO. Media checks include exact protocol, arbitrary/empty/image bytes, optional size limit, malformed multipart, ownership across restart, invalid/expired/consumed tokens, concurrent finalization, cleanup, safe destinations/public serving, actual upload progress, pending Save, duplicate Save, error/retry and selection races.

Before/after upload and Save interactions compare entire profile and auth database rows: profile values, auth email and password hash are unchanged. Light/dark and 375px mobile uploader screenshots are in `artifacts/media-*.png`.

- Final focused production browser run after stabilizing screenshot scroll/animation state: `TEST_PRODUCTION=1 CHROME_PATH=/usr/bin/google-chrome npx playwright test tests/media.spec.ts` — **3 passed**.
- Light/dark desktop and 375px mobile screenshots were visually inspected: readable controls, intact shell and no horizontal page overflow.
- Local documentation links: passed.

## Limits and review readiness

Basic Information persistence is deliberately inactive. Future domain Save implementations must use trusted destinations and decide compensation if database persistence fails after filesystem promotion. Atomic moves require a shared root on one filesystem; an interrupted finalization may leave an unavailable private claim until cleanup. Upload transport timeout is five minutes; deployment proxies/storage may impose operational bounds. These limits are documented in `docs/MEDIA.md`.

No unresolved implementation or UI failures were found in the executed checks.

This checkout has no Git repository metadata, so no Git diff/commit is available. Changed files are listed above.

**Did this task update the user's persisted profile/avatar or introduce profile/password mutation? No.**

**Did it create a Media database table or enable Media/Users management? No.**

**Are there known upload translation keys without real tm/ru/en database values? No.**
