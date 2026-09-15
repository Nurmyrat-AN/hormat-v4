# HORMAT V4 — Media File Manager UI/read foundation

Covers the complete supplied request, sections 1–119, including the continuation and final-report checklist. Media is an authenticated filesystem browser with intentionally mock mutation controls. The Media roadmap remains disabled. No Media database/catalog or File Manager mutation endpoint exists.

## Required report (65 points)

| # | Area | Implemented behavior / evidence |
| --- | --- | --- |
| 1 | Route | GET `/cpanel/media`; partial HTML uses the same protected route. GET `/cpanel/api/media/details?path=...` is a separate read-only JSON API. |
| 2 | Structure | Approved shell, search/scope toolbar, Upload/New Folder, Refresh/sort/view controls, breadcrumbs, file area and reusable dialogs. |
| 3 | Grid/List | Browser-local `hormat.cpanel.media.view`; cards on desktop, adaptive rows on narrow screens. |
| 4 | Read service | `src/cpanel/media/browser.ts`: resolve, entry, list/search and inspect. No filesystem traversal in controllers. |
| 5 | Root boundary | Configured MEDIA_ROOT, resolved server-side; no absolute root in response data or UI. |
| 6 | Relative paths | Reject absolute Unix/Windows paths, traversal, backslashes, controls, hidden/empty intermediate segments and symlinks. Validate before every read. |
| 7 | Breadcrumbs | Escaped relative segments; ancestors link to their folder, current segment has aria-current. |
| 8 | Navigation | Real dynamically discovered directories; folder-name click/keyboard activation opens them. |
| 9 | Parent/root | Breadcrumb ancestor links; unavailable-folder state provides an explicit Media-root recovery link. Root has no item actions. |
| 10 | Browser history | Normal location links preserve Back/Forward/refresh/shareable safe path queries. Search replaces only the current history entry. |
| 11 | Current Folder | Case-insensitive name matching over direct children only. |
| 12 | All Media | Case-insensitive recursive search from root for files and folders; no binary-content search. |
| 13 | Limits | At most 500 results, 10,000 examined entries or 2.5 seconds checked between async I/O operations. |
| 14 | Truncation | Localized incomplete-results notice; no false claim that a bounded result is exhaustive. Refine search/open a smaller folder. |
| 15 | Race/cancellation | AbortController plus sequence guards; clearing search and Refresh cannot be overwritten by an older result. Existing results survive ordinary errors. |
| 16 | Classification | Inexpensive extension hints for ordinary listing; existing cached MIME takes precedence where already available. Details inspects actual MIME. Folders/images/videos/other files remain distinct. |
| 17 | Sorting | Folders first, default by name; size/modified descending, type grouping with name tie-breaker. No recursive folder sizes. |
| 18 | Safe metadata | Name, relative path/parent, type, size, modified time, public URL where supported and temporary/managed markers. Details adds MIME, dimensions or bounded direct-child count. |
| 19 | Details | Loads safe JSON on demand, handles failures, cancels stale requests and shares Copy/Rename/Delete handlers with the item menu. Root is not a detail/action target. |
| 20 | Preview | Lazy original-file raster thumbnails and a Details preview for supported safe public images. No autoplay/video subsystem/editor/conversion/variants. |
| 21 | Public URLs | Shared MediaStore public-reference/URL mapping preserves the existing `/media/...` convention and cache token URL format. Unsupported names get no invented URL. See limitation below. |
| 22 | Copy URL | Canonical relative public URL, Clipboard API and textarea fallback, nonblocking localized feedback. Folders do not have Copy URL. |
| 23 | Absolute paths | Never included in HTML, JSON, clipboard data, error text or Details. Automated checks inspect responses. |
| 24 | System locations | All actual visible directories are discovered from disk. A small centralized config registers only established cache/users locations; future domains register when introduced. |
| 25 | Cache | Visible/browsable; Temporary markers and explicit warning about upload forms and automatic cleanup. Private records remain hidden. |
| 26 | Hidden files | Dotfiles/directories, Thumbs.db and desktop.ini are omitted without deletion. Cache record.json is not exposed. |
| 27 | Symlinks | All encountered symlinks, internal or external, are inaccessible/omitted. Automated symlink checks executed successfully on this platform. |
| 28 | Root protection | No Rename/Delete root controls; direct inspect of the empty root path is rejected. |
| 29 | Upload UI | Local selection/drop and up to 100 preview queue entries. Empty selection error; confirmation previews completed bars with an explicit non-persistence notice. No upload request. |
| 30 | New Folder | Name dialog and empty-name validation; confirmation changes no filesystem state. |
| 31 | Rename | Existing name prefilled; extension guidance; mock confirmation only. |
| 32 | Delete | Identifies item, warns about possible folder contents, mock confirmation only. |
| 33 | System warning | Known managed locations warn that files MAY be used by HORMAT. No database reference scan and no invented “unused” status. |
| 34 | Mutation state | Upload/New Folder/Rename/Delete remain UI-only; no POST/PATCH/DELETE manager mutation route. |
| 35 | Definitions | media.view, media.upload, media.create_folder, media.rename, media.delete: unique, boolean, assignable, localized, grouped under Media. |
| 36 | Read authorization | Both read routes require current authentication and effective media.view; denied actors receive forbidden, not an authentication fiction. |
| 37 | Permissions integration | Media switches automatically render from the existing registry. No manually duplicated Permissions EJS controls. Complete save still handles all twelve assignable definitions. |
| 38 | Translation keys | Migration 017: 54 manager/definition keys. Migration 018: refresh, notFound, backToRoot, mime, dimensions, children, cacheWarning. Existing generic/uploader/forbidden strings reused. |
| 39 | Database values | 61 new keys across this Media UI stage, 183 real tm/ru/en values. Current canonical totals: 271 keys / 813 values / 256 used UI keys. Migrations applied to development DB and live values verified. |
| 40 | Themes | Focused browser checks cover light/dark Grid/List, selection, previews and dialogs; shared shell regression also runs. |
| 41 | Responsive | Media checked at 1440, 768 and 375 px; controls wrap and List omits nonessential columns without main-page horizontal overflow. |
| 42 | Isolated tests | Unit tests create unique OS temporary roots. Browser/production server uses dedicated `.test-media` with disposable unique subtrees. No synthetic manager tree is written into real development storage. |
| 43 | Traversal tests | Relative/deep traversal, Unix/Windows absolute paths and singly/doubly encoded variants reject safely; responses do not reveal the root. |
| 44 | Symlink test | PASS for internal and external links; no platform skip. |
| 45 | Current search tests | Direct file/folder matching, case-insensitive folder matching and nonrecursive scope verified. |
| 46 | Global search tests | Root/deep files, nested folders, mixed-case Unicode and relative location context verified. |
| 47 | Limit tests | More than 500 fixtures verifies bounded service results and actual localized browser truncation notice. |
| 48 | Details/URL tests | Real PNG MIME/dimensions, cache MIME reuse without private-owner disclosure, folder count, malformed-image fallback, canonical managed URL and clipboard source verified. |
| 49 | Permission tests | Missing/false view denies page/details; each mutation capability independently controls its mock UI affordance. Mutation endpoints remain absent. |
| 50 | Super User | Browse/search/details work through exact superuser=true; test asserts no extra media.* assignment rows. |
| 51 | Registry tests | Existing registry validation, strict booleans and dynamic Permissions rendering include Media; Users/Permissions definitions preserved. |
| 52 | Universal Media regression | PASS (full production suite); cache upload/token/finalization/replacement/cleanup/managed deletion and failure compensation remain unchanged. |
| 53 | Users regression | PASS (full production suite); list/search, CRUD, avatar, status/password/session behavior and independent permissions. |
| 54 | Permissions regression | PASS (full production suite); registry-driven saves, rollback, self-edit/Super User protection and same-session revocation. |
| 55 | Profile regression | PASS (full production suite); Basic Information/avatar/password/topbar. |
| 56 | Authentication/security | PASS (full production suite); login/logout, active/inactive users, sessions, CSRF, hashing and authorization. |
| 57 | Shell regression | PASS (full production suite); navigation, pin/collapse/mobile, themes, languages and user menu. |
| 58 | Frontend | PASS (full production suite) for existing `/` and assets. |
| 59 | Socket.IO | PASS (full production suite) for existing connection foundation. |
| 60 | Full regression | PASS (full production suite); see exact command/count below. |
| 61 | TypeScript/build | `npm run typecheck` and `npm run build` passed; client JS syntax checked. |
| 62 | Production | PASS (full production suite) using compiled `npm start` with isolated test Media root, real reads/details, authorization, assets and localized UI. |
| 63 | Documentation | Architecture section 37/continuation, CPANEL_MEDIA, Permissions/localization catalogs and this report updated. Read and mutation responsibilities remain separate. |
| 64 | Unresolved UI limits | Existing public handler does not serve arbitrary filenames; such files remain browsable/inspectable without preview/Copy URL. Search/count bounds may yield partial results. No other known failing behavior after verification. |
| 65 | Pending mutation contracts | Direct permanent upload, create folder, rename file, rename folder, delete file, delete folder. No contract is silently frozen by these mock forms. |

## Existing public-serving boundary

The existing protected public handler accepts generated UUID filenames. A managed file such as `users/avatars/<uuid>.png` maps to `/media/users/avatars/<uuid>.png`; cache assets map to their existing opaque-token URL. Arbitrary `user-a.jpg`, spaces or Unicode filenames can be navigated/inspected, but the current handler does not give them a public URL. Encoding in internal browser URLs preserves such names safely.

**Deviation from the illustrative user-a.jpg URL example:** no nonworking URL was fabricated and no public-serving rule was widened without approval. Copy URL works for files with a valid existing canonical public URL. Broader public serving is still an explicit architecture decision, separate from these six mutation contracts.

Filesystem owners/operators remain trusted. Component-by-component lstat checks prevent user-input and ordinary symlink escape; this is not an OS isolation boundary against a malicious local administrator replacing directories during a read. Time budgets are cooperative between asynchronous I/O operations, not guaranteed deadlines for a blocked filesystem syscall.

## Executed checks

- Four focused filesystem tests passed: root/symlink/hidden safety; limits/cancellation; deep search/metadata/external changes; real EACCES recovery. No skips.
- Eight focused browser tests passed, including tm/ru/en and all continuation interaction cases. One initial test selected all `.alert` elements, including the hidden Delete warning; it was corrected to scope the actual result notice and rerun successfully.
- `localization:check`: 256 UI keys have real tm/ru/en DB values.
- Live `localization:verify`: PASS tm/ru/en. Manager checking is read-only; synthetic empty/limited trees are tested solely in isolated browser roots. Existing Profile/Users localization checks retain their established disposable account/upload workflow.
- Build/typecheck/client JS syntax: PASS.
- Final full production suite: **56 unit/integration + 58 core browser + 5 Users browser = 119 passed, no skips, npm exit 0**.
- Additional production Details visual test: **1 passed, exit 0**, with light/dark captures at 1440px and 375px. Desktop/light and mobile/dark screenshots were visually inspected; text wraps and actions remain within the dialog. Captures: `artifacts/media-details-{theme}-{width}.png`; log: `/tmp/media-continuation-dialogs.log`.

Logs: `/tmp/media-continuation-browser-final.log`, `/tmp/media-continuation-build-final.log`, `/tmp/media-continuation-live.log`, `/tmp/media-continuation-production.log`, `/tmp/media-continuation-production.exit`.

## Files added/changed by the continuation

Added: `src/cpanel/media/locations.ts`, `src/views/cpanel/pages/media-error.ejs`, `src/views/cpanel/pages/media-error-content.ejs`, `src/database/migrations/018_media_file_manager_read_translations.sql`.

Updated: `src/cpanel/media/browser.ts`, `src/media/store.ts` (read mapping only), `src/controllers/cpanel/media-browser.ts`, `src/routes/cpanel/index.ts`, Media content/results EJS, `src/public/cpanel/js/media-browser.js`, `src/public/cpanel/css/media-browser.css`, `scripts/verify-localization.ts`, Media browser/unit tests, fresh-migration count checks and architecture/localization/Permissions documentation. Existing upload/finalization implementation, assignment storage and business schemas were not redesigned.

## Explicit final confirmations (section 117)

### Storage architecture

- Filesystem under MEDIA_ROOT remains the source of truth? **YES.**
- Media database/catalog table created? **NO.**

### Filesystem safety

- Can relative/absolute/traversal input browse outside MEDIA_ROOT? **NO.**
- Are absolute server paths exposed to browser/UI? **NO.**
- Are displayed paths relative to Media root? **YES.**
- Are unsafe symlink escapes inaccessible? **YES; automated tests executed, no skip.**

### Browsing

- Can administrators browse actual current files/folders? **YES**, subject to the documented hidden/private/symlink policy.
- Are folders dynamically discovered? **YES.**
- Is cache visible? **YES.**
- Are system/domain media folders visible? **YES.**

### Search

- Does Current Folder search work? **YES.**
- Does it inspect direct contents only? **YES.**
- Does All Media recursively search from the complete root? **YES**, subject to explicit traversal/result bounds.
- Can it find files and folders? **YES.**
- Do global results show safe relative location context? **YES.**
- Are results bounded server-side? **YES.**
- Are stale responses prevented from replacing newer results? **YES.**

### URLs

- Can a file's canonical public URL be copied? **YES, where the existing public handler supports that file; arbitrary-name limitation documented above.**
- Is it the same canonical convention as existing model fields? **YES.**
- Does Copy URL ever expose MEDIA_ROOT/absolute filesystem paths? **NO.**

### Existing Universal Media

- Was cache upload repurposed as direct permanent File Manager upload? **NO.**
- Does select → cache upload → cacheToken → domain Save → finalization remain? **YES.**
- Do Profile/Users avatars retain that contract? **YES.**

### Mutation state

- Can File Manager actually rename files/folders? **NO.**
- Can it actually delete files/folders? **NO.**
- Can it actually create folders? **NO.**
- Can it directly upload permanent files into the current folder? **NO.**

### Permissions

- Were all five requested Media definitions registered? **YES.**
- Did they appear automatically through the centralized registry? **YES.**
- Does Super User receive access without explicit media.* rows? **YES.**
- Does normal-user read access require effective media.view? **YES.**

### Localization

- Does every new Media UI string have real tm/ru/en database values? **YES.**
- Are semantic keys visibly rendered in normal Media UI? **NO.**

### Navigation

- Was Media enabled in the roadmap during this UI/read stage? **NO.**

## Architecture status and stop condition

The Media File Manager **read architecture and UI are validated**, within the documented existing public-serving boundary, but the Media module is **not yet complete**.

The following require explicit approval before backend implementation:

1. Direct permanent File Manager upload.
2. Create folder.
3. Rename file.
4. Rename folder.
5. Delete file.
6. Delete folder.

No mutation backend or next module was started. Stop for UI review and explicit contract decisions.
