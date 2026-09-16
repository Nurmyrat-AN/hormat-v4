# HORMAT V4 — Media File/Folder Move

## Implementation

- Added independent assignable boolean `media.move` to the centralized Media permission group. Permissions Management picks it up automatically. Exact `superuser=true` supplies effective access without inserting a `media.move` row.
- Added Move to file/folder three-dot menus only for authorized actors. The existing Bootstrap modal now has a dedicated Move view with actual folder browsing, root/ancestor navigation, current destination, warning, localized errors and Move here action. No manually typed filesystem path or hardcoded domain folders.
- GET `/cpanel/api/media/move-folders?path=` returns safe child directories; POST `/cpanel/api/media/move` accepts exactly `{path,destination}`. Both require authentication and `media.move`; POST also requires header CSRF and bounded JSON. Move does not imply `media.view` or sibling mutation rights. The service repeats active-session/permission verification, including after a cross-device copy.
- `MediaManager.moveItem` preserves the name and changes only the parent; Rename remains same-parent only. The shared safe resolver rejects root movement, absolute/traversal/encoded/hidden paths and symlink traversal. Same-parent, self and descendant destinations reject. Moved trees containing symlinks/special files reject.
- Existing destination names and reserved cache aliases are conflicts. No overwrite, folder merge, suffix or automatic renaming. Same-device move uses the established GNU coreutils exclusive no-copy operation.
- Cross-device fallback creates private staging on the destination filesystem, copies recursively, verifies source/copy SHA-256 snapshots, rechecks authorization, publishes exclusively and then removes the source. Copy, mismatch, conflict or revocation failure retains the original and cleans staging. If source removal fails after publication, the complete destination stays and the UI reports that both locations need inspection. This avoids deleting the remaining complete copy.
- Ordinary files/folders can move into/out of existing domain/system directories. Private record/cache-token boundaries remain. Every Move dialog warns that references can break; cache additionally retains its temporary-storage notice.
- Success refreshes current folder/search and preserves Grid/List. Fresh Details and Copy URL use the new path; public old URLs return 404. No database-reference scan or rewrite occurs.

## Localization and database

Migration `022_media_move_translations.sql` adds **11 keys / 33 real tm/ru/en values**:

`cpanel.media.movePermission`, `move`, `moveTo`, `selectDestination`, `moveHere`, `moved`, `sameFolder`, `moveSelf`, `moveRisk`, `moveFailed`, `moveIncomplete`.

Existing conflict, cancel, loading, generic-error and cache-warning keys are reused. Migration applied to the current development database. Actual running-server verification passed for tm, ru and en, confirming the refreshed cache renders real DB values. Current totals: **296 canonical keys / 888 values / 280 used UI keys**. No business schema or database references changed.

## Changed files in this task

- Registry: `src/cpanel/permissions/definitions.ts`.
- Service: `src/cpanel/media/mutations.ts`; new `src/cpanel/media/move-filesystem.ts`.
- HTTP/controllers: `src/routes/cpanel/media-api.ts`, `src/controllers/cpanel/media-mutations.ts`, `src/controllers/cpanel/media-browser.ts`.
- UI: `src/views/cpanel/pages/media-content.ejs`, `media-results.ejs`, `src/public/cpanel/js/media-browser.js`.
- Localization: new migration 022.
- New tests: `tests/unit/media-move.test.ts`, `tests/media-move.spec.ts`.
- Existing test inventories/expectations: `tests/unit/database.test.ts`, `permission-registry.test.ts`, `permissions.test.ts`, `tests/media-browser.spec.ts`, `tests/media.spec.ts`.
- Documentation: architecture section 39, Media, Permissions, localization/inventory documentation, README and this report.

The workspace already contained uncommitted Media activation changes. Those changes were preserved; this task did not commit or reset the repository.

## Verification

- `npm run typecheck`: passed.
- `npm run build`: passed; the compiled application was used by the production regression and started/stopped successfully for both Playwright projects.
- `TEST_PRODUCTION=1 CHROME_PATH=/usr/bin/google-chrome npm test`: **135 passed** (66 unit/database/service + 64 core browser/HTTP + 5 Users), exit 0.
- This includes complete Media/Universal Upload/cacheToken, Profile and Users media, Permissions, authentication/Super User, localization, shell/navigation/theme/language, Frontend and Socket.IO regression.
- Six new isolated filesystem tests cover file/folder movement and descendants, URLs/search, system directories, collision/self/descendant/root/path/symlink safety, EXDEV success, partial copy errors, checksum mismatch, revocation, publication conflict and source-removal failure.
- Browser/HTTP Move tests cover independent missing/false/invalid grants, fresh revocation, CSRF, Super User without an explicit row, public old/new URLs, unchanged database references, actual folder selection, disabled destinations, network-failure retry, search refresh and Grid/List retention.
- Move dialog screenshots cover tm/ru/en × light/dark × 1440/375 pixels (12 artifacts); horizontal overflow checks passed. Desktop light and mobile dark/Turkmen and mobile light/Russian screenshots were also visually inspected.
- `npm run localization:check`: passed, **280 used UI keys** have real tm/ru/en DB values. Fresh-migration integrity is included in the 66 service/database tests.
- `CHROME_PATH=/usr/bin/google-chrome npm run localization:verify`: passed against the current running server on port 3000 for all three languages, exit 0. No exposed semantic keys.
- Final focused production run `playwright test tests/media-move.spec.ts --project=core`: **2 passed**, exit 0, including the strengthened UI check that a real file remains visible while Move is absent without permission.
- `git diff --check`: passed.

Initial verification exposed a migration-count expectation needing 22 instead of 21, an old Universal Upload assertion that still expected Media navigation to be disabled, and an ambiguous all-Media search selector after a previous language fixture remained on disk. These test expectations/fixture cleanup were corrected; the complete production rerun above passed. No failing application regression remains.

## Operational boundaries

- EXDEV is exercised deterministically by injecting the rename failure, while real filesystem copy/hash/removal executes against isolated temporary roots. A separate physical-device/mount test was not performed.
- The existing Linux/coreutils no-replace runtime requirement remains. Filesystem ownership/local-operator trust remains unchanged; no claim of immunity to a hostile local process swapping paths.
- Cross-device operations are not crash/power-loss atomic. A source-removal error keeps the verified destination and reports incomplete movement instead of claiming rollback or success.
- Picker uses existing-style bounds (500 child folders / 10,000 examined entries) with a localized limited-results notice. Private infrastructure and unsafe names are excluded.

## Required confirmations

| Question | Answer |
| --- | --- |
| Can files be moved between Media directories? | **YES** |
| Can folders be moved? | **YES** |
| Can a folder be moved into itself/descendant? | **NO** |
| Can Media root be moved? | **NO** |
| Are existing destination files overwritten? | **NO** |
| Does Move automatically update DB references? | **NO** |
| Is `media.move` independently permission-controlled? | **YES** |
| Does Super User receive Move through `superuser=true`? | **YES** |
| Are all Move UI strings database-translated in tm/ru/en? | **YES** |
