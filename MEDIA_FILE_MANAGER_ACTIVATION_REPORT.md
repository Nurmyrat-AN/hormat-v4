# HORMAT V4 — Media File Manager activation

## Scope and owner decisions

The approved filesystem UI is connected to real operations. The owner's latest clarification is authoritative: **any file type**, with a maximum **10 MB (10,485,760 bytes, inclusive) per direct File Manager file**. This supersedes the activation brief's generic format/executable rejection requirement. Files are never executed; non-raster public responses are attachment downloads with nosniff and sandbox CSP. No antivirus claim is made.

Profile/Users retain Universal Upload → cacheToken → domain Save → trusted finalization. Their format/size policy is unchanged.

## Requested implementation report

| # | Area | Result |
| --- | --- | --- |
| 1 | Direct upload | POST `/cpanel/api/media/files?path=<relative folder>`; multipart contains exactly one `file`. Complete original bytes publish exclusively in that existing folder, HTTP 201 `{success:true,item}`. No cacheToken. |
| 2 | Existing upload | POST `/cpanel/media/upload` remains separate and returns the existing cache reference. |
| 3 | Multiple upload | Up to 100 selected files per UI queue; sequential independent requests, real XHR progress, individual success/error. Retry skips successful rows; conflict never rolls back successful siblings. |
| 4 | Names | Original safe names retained, including spaces/Unicode. One segment, at most 255 UTF-8 bytes; no absolute path, slash/backslash, colon, percent-encoding ambiguity, controls, hidden names or reserved private metadata names. |
| 5 | Collision | Upload uses an exclusive hard link of complete staged bytes; mkdir is exclusive; rename uses no-replace semantics. Existing target contents remain intact. No suffix or overwrite. |
| 6 | New Folder | POST `/cpanel/api/media/folders`, JSON `{parent,name}`, creates one direct child. |
| 7 | Rename | POST `/cpanel/api/media/rename`, JSON `{path,name}`, same parent only. Files/folders supported; no Move or DB reference rewrite. Extension changes allowed under the approved all-format policy. |
| 8 | Delete file | POST `/cpanel/api/media/delete`, JSON `{path,recursive:false}`, physically unlinks selected file. |
| 9 | Empty folder | Nonrecursive rmdir; stale newly-added children cause a conflict instead of accidental recursive removal. |
| 10 | Recursive delete | Explicit boolean `recursive:true`; UI preflight GET `/cpanel/api/media/delete-info` detects actual children including hidden files. Strong warning plus separate checkbox. Permanent deletion, no trash/undo. |
| 11 | Root | Empty root target rejects rename/delete server-side. Parent root remains valid for upload/new child. |
| 12 | System folders | Authorized rename/delete can affect system/domain folders. Rename/delete always show reference-risk warnings, including system/cache paths. No claim of reference safety or hidden reference catalog. |
| 13 | Cache | Ordinary direct cache files are allowed, but gain no owner record or token. Private UUID token-directory writes and global `record.json` names are reserved. Cache deletion is allowed; next domain upload recreates it. |
| 14 | Token security | Forged/manual token-looking files fail finalization. Renaming cache cannot expose owner metadata or allow creation of replacement `record.json`. Existing ownership/expiry/one-time tests remain. |
| 15 | Path safety | One shared resolver checks root-relative paths and every existing component. Every request revalidates current paths; stale/missing parents fail. Relative names/URLs only in client responses. |
| 16 | Symlinks | Symlink components cannot be selected/traversed for reads/mutations. Recursive rm removes descendant links, never follows their external destinations. Actual Linux symlink tests executed. |
| 17 | Permissions | Five independent registry definitions unchanged. All read/preflight endpoints require view; each mutation its corresponding action. Missing/false/null/string/number/object/array deny. Exact Super User bypass without individual rows. |
| 18 | CSRF | Existing header CSRF checked before multipart/JSON parsing for every mutation. Missing/invalid CSRF leaves files unchanged. |
| 19 | Mutation UI | Approved dialogs activated, duplicate submissions blocked, saving state shown, actual success/errors localized. Fast responses wait for Bootstrap's opening transition before closing the dialog. |
| 20 | Refresh | Refresh current folder/search after success, retaining Grid/List and scope; stale entries/selection cleared. Rename changes the next Details/Copy URL. |
| 21 | Localization additions | Migration 019: 13 keys / 39 values. Migration 020: permanent deletion warning / 3 values. Migration 021 clarifies the existing rename/delete risk in all three languages. Total new: **14 keys / 42 values**, plus three updated values. |
| 22 | Languages | Every new key has actual tm/ru/en values in canonical SQL and current development DB. Final total: **285 keys / 855 translations / 269 used UI keys**. Running cache refreshed and live browser verification executed. |
| 23 | Registry | Still 12 assignable boolean keys plus protected superuser; no duplicated catalog or new Media grants. |
| 24 | Permissions UI | Real Permissions Save grants/revokes Media assignments for an already logged-in target; later requests enforce the change. |
| 25 | References | Tests preserve `cpanel_users.avatar_url` after its file is renamed/deleted. Old URL may break; no automatic repair/clear or cross-domain database coupling. |
| 26 | Universal Media | Existing cache ownership, forged/consumed tokens, cleanup, finalization, replacement/deletion and compensation covered by regression. |
| 27 | Profile | Existing avatar upload/wait/Save/replacement and password/profile regression retained. |
| 28 | Users | Existing Add/Edit/avatar/status/password/session/Super User regression retained. |
| 29 | Full regression | PASS: full production run — 60 unit/integration + 61 core browser + 5 Users browser = **126 passed**, no skips, npm exit 0. Final refinements/navigation received the additional checks below. |
| 30 | Build | PASS: final `npm run build`, including TypeScript and production assets, exit 0. |
| 31 | Production | Compiled `npm start` used for HTTP/browser tests, including actual uploads/mkdir/rename/delete/recursive deletion, public URLs and real translated UI outcomes. PASS; final enabled-navigation build also served the 10 post-enable browser scenarios. |
| 32 | Documentation | Architecture section 38; Media, localization, permissions and README updated. No business schema changes. |
| 33 | Navigation | **Enabled**: Catalog → Media → `/cpanel/media`, usable only with effective `media.view` or Super User. Verified true/missing/false and same-session revocation. |
| 34 | Limits/issues | See operational boundaries below. No known blocking UI issues or failing regression checks remain. Runtime/storage limitations are explicit below. |

## Operational boundaries

- Linux/GNU coreutils rename is an explicit runtime requirement: `mv --no-copy --update=none-fail --no-target-directory`, tested with coreutils 9.7 and the workspace filesystem. No shell interpolation and no copy/delete fallback. Other deployments need equivalent supported no-replace behavior; unsupported options fail rather than using a weaker fallback.
- MEDIA_ROOT is application-owned and local filesystem operators remain trusted. Component checks are not an OS sandbox against a malicious local administrator replacing ancestors between checks/syscalls. This task verifies request path escapes and ordinary stale/concurrent collision cases.
- System/domain folder mutations can break database URLs intentionally. No reference/audit module exists. Future reference tracking/audit history needs a separate approved task.
- Hidden work areas and globally reserved `record.json` stay private even if cache is renamed. UUID token subdirectories are internal infrastructure, not destinations for manually manufactured cache uploads. Ordinary system folders remain manageable.
- Direct files placed in cache have no domain-token TTL guarantee; their cleanup is administrator-managed. Existing real cache-token TTL cleanup remains unchanged. Arbitrary domain directories are not recreated; a later domain finalization naturally recreates its destination.
- Normal failed/aborted uploads clean staging after the writer settles. A process crash can leave hidden `.manager-incoming` staging for operator cleanup; it is never served/listed. Filesystem and database are not presented as one transaction.
- Unsupported/oversized tests follow the final owner policy: executable/arbitrary/empty bytes are accepted; only size/protocol/path/authorization failures reject. Exactly 10 MB succeeds; 10 MB + 1 byte fails.

## Checks executed and fixes found

- Initial baseline: 56 existing unit/integration tests passed.
- First focused mutation run exposed public serving incorrectly rejecting the configured hidden storage root, and the multipart boundary rejecting exactly 10 MB. Both were fixed; the default Universal Upload parser behavior remains unchanged.
- Focused production Media tests: 11 passed before final hardening/navigation changes.
- Expanded review added a regression for private cache metadata after container rename and an explicit permanent-delete notice for files as well as folders.
- Full regression exposed a fast-response Bootstrap transition race: deletion succeeded but its dialog could remain open. Closing now waits for the shown lifecycle event.
- Final checks: Full production regression **126 passed (exit 0)**. After final translation/error/preflight refinements: **60 unit/integration passed**, **3 production mutation browser/HTTP tests passed**. Cache-alias collision hardening: **4 filesystem unit tests and 1 production HTTP test passed**. After navigation enabling: **4 navigation unit tests and 10 production browser tests passed**. `localization:check`: **269 keys**, real tm/ru/en. Final live `localization:verify`: **tm/ru/en passed**, exit 0. Final build/typecheck passed. Light desktop and dark mobile destructive-dialog captures were visually inspected; automated layouts cover 1440/768/375, Grid/List and both themes.

## Files created

- `src/media/paths.ts`
- `src/cpanel/media/mutations.ts`
- `src/controllers/cpanel/media-mutations.ts`
- `src/routes/cpanel/media-api.ts`
- `src/database/migrations/019_media_file_manager_activation_translations.sql`
- `src/database/migrations/020_media_permanent_delete_translation.sql`
- `src/database/migrations/021_media_reference_risk_translation.sql`
- `tests/unit/media-mutations.test.ts`
- `tests/media-mutations.spec.ts`
- `tests/media-navigation.spec.ts`
- This report.

## Files updated

- `src/media/multipart.ts`, `src/media/http.ts`, `src/media/store.ts`
- `src/cpanel/media/browser.ts`
- `src/routes/cpanel/index.ts`
- `src/cpanel/shell/navigation.ts`, `src/cpanel/shell/context.ts`
- `src/views/cpanel/pages/media-content.ejs`, `media-results.ejs`
- `src/public/cpanel/js/media-browser.js`
- `tests/media-browser.spec.ts`, `tests/unit/media-browser.test.ts`, `tests/unit/database.test.ts`, navigation tests
- `docs/ARCHITECTURE.md`, `docs/CPANEL_MEDIA.md`, `docs/MEDIA.md`, `docs/LOCALIZATION.md`, `docs/INTERFACE_TRANSLATIONS.md`, `docs/CPANEL_PERMISSIONS.md`, `docs/CPANEL_NAVIGATION.md`, `README.md`

## Explicit confirmations

| Question | Answer |
| --- | --- |
| Direct File Manager upload is permanent and independent from cacheToken flow? | YES |
| Profile/Users still use cacheToken/finalization? | YES |
| File Manager creates folders? | YES |
| Renames files? | YES |
| Renames folders? | YES |
| Permanently deletes files? | YES |
| Recursively deletes nonempty folders after explicit confirmation? | YES |
| Media root itself can be renamed/deleted? | NO |
| Mutation input can escape MEDIA_ROOT? | NO, within the documented application-owned-filesystem boundary |
| Existing upload/rename targets silently overwritten? | NO |
| Manually placed cache file can forge a valid token? | NO |
| Automatically repairs database references? | NO |
| Filesystem remains source of truth? | YES |
| Media catalog DB table created? | NO |
| Each action protected by its own media.* permission? | YES |
| Super User receives actions without explicit rows? | YES |
| All mutations CSRF protected? | YES |
| All new strings have real tm/ru/en DB translations? | YES |
| Full regression passed? | YES — full 126-test run plus targeted final-change checks above |
| Media enabled in navigation? | YES |

Stop after this activation. No next module started.


## Verification evidence

- `/tmp/media-activation-regression-final.log` and `.exit`: full production suite, 126 passed, exit 0.
- `/tmp/media-activation-unit-final.log`: final 21-migration integrity plus all 60 unit/integration tests.
- `/tmp/media-activation-mutations-final.log`: localized network failure/retry, preflight permission, per-file outcomes and destructive confirmations — 3 passed.
- `/tmp/media-activation-cache-alias.log`, `/tmp/media-activation-cache-unit.log`: final cache-alias collision and private-record safeguards.
- `/tmp/media-activation-navigation.log`, `/tmp/media-activation-navigation-unit.log`: enabled menu and sidebar regression — 10 browser + 4 unit passed.
- `/tmp/media-activation-build-enabled.log`: final production build.
- `/tmp/media-activation-localization-enabled.log`: actual dev-server tm/ru/en verification after the final migration/navigation changes.
- `artifacts/media-activation-{language}-{theme}-{width}.png`: permanent/recursive/reference-risk dialogs. `artifacts/media-{language}-{theme}-{view}-{width}.png`: responsive manager. `artifacts/roadmap-*.png`: final sidebar.

No destructive File Manager verification ran against actual development media. All such operations used disposable isolated roots. Live localization used its established disposable Profile/Users workflow; live File Manager localization inspection remained read-only.
