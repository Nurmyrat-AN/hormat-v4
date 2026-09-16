# Media File Manager — UI review stage

`GET /cpanel/media` uses the approved CPanel shell and requires current authentication plus effective `media.view`. Its HTML partial uses the same route and authorization. The Catalog → Media roadmap entry stays **disabled**. Visit the route directly for review.

## Source and reads

The configured `MEDIA_ROOT` filesystem is authoritative. There is no media database catalog, table or index. `src/cpanel/media/browser.ts` provides asynchronous listing, filename/folder-name search, metadata and sorting; the controller prepares presentation data. The browser receives relative paths only.

Query parameters: `path` (relative directory, at most 2048 characters), `query` (at most 200 characters), `scope` (`all`, default, or `current`), `sort` (`name`, default, `modified`, `size`, `type`), optional `select` (a validated direct child to highlight), and `partial=1`. Empty search lists the current folder; nonempty All Media search starts at root. Folders sort first, with name as the tie-breaker. Modified/size sort descending. Live search aborts previous requests and ignores stale responses; failure preserves existing results.

Traversal uses async directory iterators and metadata reads. Each request stops at 10,000 examined entries, 500 results or 2.5 seconds, with a localized partial-results notice. Bounds are cooperative between I/O operations, not a promise that a slow filesystem syscall completes in 2.5 seconds. No synchronous recursive scan or recursive folder-size calculation. Refine search/open a smaller folder when limited. No database search index is introduced.

Paths reject absolute paths, traversal, backslashes, controls, hidden segments and empty intermediate segments. All encountered symbolic links, including links resolving inside root, are inaccessible and excluded. Hidden dotfiles/directories, Thumbs.db and desktop.ini are omitted without deletion. Cache remains visible with Temporary markers, but private `cache/<token>/record.json` records never appear or open. `.incoming`, `.claims` and `.trash` remain private infrastructure. There is no content-reading endpoint for arbitrary files. Trusted operating-system administrators must not replace directories while requests are in flight; this is not isolation from a malicious local filesystem owner.

## Public URLs

The existing controlled `/media` namespace is unchanged. A read-only `MediaStore.publicUrlForRelativePath` maps supported managed UUID files to existing public URLs and cache assets to their existing token URL. It does not expose private cache records or widen public serving. Images use the original safely served file; no variants/conversion/thumbnail generation. Unsupported files use type icons. A failed image load falls back to its icon.

Arbitrary filenames (including Unicode and spaces) are browsable, selectable and inspectable. They currently have no public URL if the existing public handler cannot serve them; Copy URL is disabled and Details explains this. Expired cache assets similarly have no URL. Expanding public serving requires the owner's pending decision under the frozen Media rule; this stage has not silently enabled public access to arbitrary files.

## Interface

- Prominent search/scope toolbar, Upload and New Folder, breadcrumb links, folders-first sorting and persistent Grid/List (`hormat.cpanel.media.view`).
- Single selection with visible highlight. Folder-name click opens the folder; file-name click opens Details. Enter/Space on an item activates its name. Global results include a clickable containing path.
- Safe text rendering for names/paths, truncation and full-name tooltips. Light/dark Bootstrap variables and single-column mobile list.
- Reusable Rename/Delete/Details dialog and New Folder dialog. System-managed media gets a stronger delete warning; folders get a contents warning. These are UI proposals, not permanent protection rules.
- Upload dialog accepts local selection/drop and displays up to 100 selected files in a preview queue with per-file progress placeholders (a UI bound, not a future upload contract). Empty confirmation shows a localized validation error; confirmation with files previews completed bars and explicitly says no files changed. It sends **no upload request**, never simulates server persistence and remains marked as an interface preview. No arbitrary permanent-directory upload semantics are defined.
- Rename, Delete, New Folder and Upload confirmation only show a localized non-persistence notice. No filesystem mutation endpoint exists. Details first shows safe list metadata, then loads `GET /cpanel/api/media/details?path=...` under media.view. MIME and image dimensions are inspected only on demand; directories get a direct-child count capped at 500/10,000 examined entries/2.5 seconds between I/O. No absolute root. Actual cache MIME is reused in the list when already cheaply available.
- Copy URL uses Clipboard API with a textarea fallback and localized feedback. No Copy URL is offered for folders.

## Permissions and localization

The centralized application registry adds assignable boolean `media.view`, `media.upload`, `media.create_folder`, `media.rename`, `media.delete`. The Media group appears automatically in Permissions without duplicating its UI/catalog. Only view currently authorizes a File Manager backend action; the other four are definitions for the later approved mutation stage. No automatic user permission rows or Super User grants are inserted.

Migration 017 adds 54 keys / 162 values; migration 018 adds seven keys / 21 real tm/ru/en values for Refresh, recovery, cache warning and Details metadata. Totals are 271 canonical keys / 813 translations / 256 used UI keys. Existing uploader translations share `cpanel.media.*`; verification inventories the actual uploader partial instead of assuming the entire namespace belongs to Profile.

The existing universal cache upload → cacheToken → domain Save → finalization contract remains unchanged. Profile/Users still own their authorized media mutations. No File Manager rename, delete, mkdir or direct upload backend is authorized here.

## Continued interaction and authorization

Refresh re-reads the current query/path/scope without changing Grid/List and without polling. Normal folder links support browser Back/Forward/refresh. Global file-name/context links navigate to the containing folder and validate/select the direct child. Full-page and partial missing-directory errors show a localized recovery link to Media root; Details errors are safe JSON. Permission errors never masquerade as authentication failure.

Mutation buttons reflect their independent Media permission. Missing grants disable the action with a permission explanation. Authorized actors still see explicitly mock dialogs because no mutation endpoint exists. Copy/Rename/Delete in Details use the same client handler as the three-dot menu. The root never has Rename/Delete actions. Known managed-location metadata is centralized for cache/users only; future domains register themselves when introduced. Cache has an explicit automatic-cleanup warning. No usage/reference tracking or "unused" status is inferred.

## Review limitations

The complete supplied request through section 119 is now accounted for. Public serving of arbitrary names remains unchanged: unmanaged names such as user-a.jpg or Unicode filenames can be browsed/inspected but have no canonical public URL under the existing UUID-only handler. A broader serving contract requires explicit review; no nonexistent URL is fabricated. No Media database is introduced.

The read architecture/UI is reviewed through tests, but the Media module is not complete. Direct permanent upload, create folder, rename file/folder and delete file/folder each require explicit contract approval. Preview upload progress is not a real transfer. New Folder name/extension/delete warnings remain UI decisions, not frozen backend business rules.

## Verification roots

Filesystem unit tests create unique OS temporary roots; browser/production tests configure `.test-media` and create unique disposable subtrees. Traversal, symlinks (executed on this platform), inaccessible directories, external changes, deep search, bounded results, metadata and cancellation are covered. Live manager translation checks use existing read-only locations; synthetic empty/limited trees belong solely to isolated tests.

## Activation (supersedes the UI-only status above)

The owner approved the mutation contracts and clarified direct uploads: **all types, maximum 10,485,760 bytes per file**. Profile/Users retain the separate Universal Upload policy and cacheToken workflow. See architecture section 38 for the full contract and [activation report](../MEDIA_FILE_MANAGER_ACTIVATION_REPORT.md) for final verification/navigation status.

File Manager endpoints are `/cpanel/api/media/files` (multipart + relative path query), `/folders` (parent/name), `/rename` (path/name), `/delete` (path/recursive), and GET `/delete-info` (path). POST actions use authentication, independent action permission and header CSRF. No full-control action repairs database references. Recursive deletion requires separate explicit UI confirmation and backend boolean mode. Root and private token metadata are protected.

Human filenames now receive encoded canonical URLs through controlled public serving, retaining safe attachment handling. Rename changes URLs; old references remain unchanged. Existing cache aliases remain ownership/TTL-controlled. Direct files in cache are ordinary files, not domain tokens; their cleanup is administrator-managed. Known cache/domain warnings remain visible.

Rename requires GNU coreutils with `--no-copy --update=none-fail` (verified 9.7/Linux). Complete direct uploads publish with exclusive hard links on the same filesystem. Aborted uploads remove their staging directories; a process crash may leave hidden `.manager-incoming` staging for operator cleanup. Private staging is never browsable/servable. No overwrite fallback exists.

Catalog → Media is enabled following the successful activation regression, protected by media.view. Final validation: 126-test production regression plus targeted final mutation/navigation checks; see the activation report for exact runs. Existing cache public aliases are also checked for filename conflicts.

## Move files and folders

The item menu now offers Move with independent `media.move` permission (or Super User). A dedicated view in the existing modal browses real destination folders with root/ancestor controls; no typed path is required. The endpoint is POST `/cpanel/api/media/move` with `{path,destination}` and CSRF. The folder picker uses GET `/cpanel/api/media/move-folders?path=` under the same Move permission.

Rename preserves the parent; Move preserves the name. Root, same-parent, self/descendant and collision targets reject. Shared path/private-cache rules remain. Tree symlinks and special files reject. Cross-device copy is staged and content-verified before exclusive publication and source removal; an incomplete source removal reports a localized error while keeping the complete destination. No operation repairs database references. Details, Copy URL and search read the refreshed path; Grid/List is retained.

See [permanent Move contract](ARCHITECTURE.md#39-media-file-manager-move) and [verification report](../MEDIA_MOVE_REPORT.md).
