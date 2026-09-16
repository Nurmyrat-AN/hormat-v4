# Reusable Media Picker

The Picker is a selection adapter for the existing HORMAT Media File Manager. It creates no database, storage root, fake folder catalog or new HTTP endpoint.

## Sources and permissions

- Browse/search: `GET /cpanel/media?partial=1&path=...&query=...&scope=...&sort=name`. Uses the same bounded filesystem resolver/search as File Manager. The client reads prepared `data-entry` records from its EJS partial; it does not insert that partial's mutation controls into the Picker.
- Confirm: existing `GET /cpanel/api/media/details?path=...` revalidates each selected file, public reference and current `media.view` permission.
- Upload: existing `POST /cpanel/api/media/files?path=...`, multipart one file per request, current CSRF token and independent `media.upload`. Files upload sequentially with individual pending/success/error messages; maximum 100 selected files per batch, existing 10 MB/file cap and no type allowlist. A failed file can be reselected/retried. No overwrites or domain cacheToken behavior.
- View denial prevents opening from Brands. Permission revocation on an open Picker is enforced by subsequent server reads. Brand permissions do not bypass Media permissions.

Upload is real permanent Media storage; cancellation of selection does not undo it. A localized notice explains that uploads survive cancelled selection or unsaved Brand changes. All runtime reads use the actual configured filesystem. Automated uploads use isolated `.test-media` fixtures.

## Component interface

Render `partials/media/picker.ejs` within the host dialog's `.modal-content`, providing existing session CSRF, translation context and caller-prepared Media capabilities. Load `media-picker.css` and instantiate `MediaPicker(root, hostDialog)`.

Call `open({mediaType:'image'|'all', mode:'single'|'multiple', permanentOnly:false, initialSelection:[descriptors], exclude:[paths], trigger, onSelect})`. A successful callback returns `{path,url,name,image,type}` descriptors from authoritative Details responses. Exclude prevents duplicate relationships. Do not exclude Main Image merely because the same file may also belong to Gallery.

The Picker keeps its own candidate Map; cancellation never invokes `onSelect`. Selecting a different folder or switching Grid/List preserves candidates. Search uses existing current/all behavior with abort plus generation checks; late responses cannot replace a newer result. Unavailable URLs/folders cannot be selected as files. Preview failures use an icon fallback, not a broken image.

It occupies the host dialog surface while marking its normal children inert. Existing Bootstrap focus trapping and scroll/backdrop ownership remain; title association changes while Picker is active. Cancel/Escape restores the Brand surface, draft state and triggering control's focus. During confirmation/upload, duplicate actions and dismissal are blocked until completion; errors preserve safe candidates and permit retry.

Brands supplies `mediaType:'image'` in both cases: single mode for Main Image and multiple mode for Gallery. Image mode requires the existing Media descriptor to have `image=true`, `type=image` and a public URL, both when rendering choices and on fresh Details confirmation. Non-images remain visible but disabled with a localized explanation; folders remain navigable. Upload remains universal and newly uploaded non-images remain unselectable for these Brand fields. The generic default is `all`; unknown media types fail closed. The candidate Map returns files in selection order; optional initialSelection retains eligible, non-excluded candidates (one in single mode, at most 200 in multiple mode). Main Image belongs to Basic save; Gallery remains independently ordered and saved. The caller persists relationships through its own authorized domain operations; Picker never unlinks or deletes files.

Brands sets permanentOnly:true: cache/temporary entries remain ineligible both during browse and confirmation. Existing File Manager cache warnings/lifetime behavior remain unchanged. Brands also validates eligibility server-side; a Picker descriptor is not authorization. Main/Gallery persistence uses canonical path identity and ignores preview URLs supplied by a client.
