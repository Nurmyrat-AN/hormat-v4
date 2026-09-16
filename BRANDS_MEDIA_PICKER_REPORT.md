# Brands revision — Main Image, ordered Gallery and Media Picker

Historical implementation report. Current acceptance is consolidated in [the final report](BRANDS_FINAL_ACCEPTANCE_REPORT.md) and [test ownership](docs/BRANDS_ACCEPTANCE.md); do not rerun overlapping historical scenarios.

Date: 2026-09-16. Stage: UI-only Brand relationships, existing real Media integration.

## Delivered design

The approved inline Name translations remain unchanged. The dialog has Basic Information and Gallery tabs.

**Basic Information** now owns Name, a dedicated nullable Main Image reference and visibility. Main Image has an empty placeholder, actual image/file preview, relative Media identity, Select/Change Media and Remove Main Image. Changing or clearing it dirties only Basic. Saving Basic updates the mock Brand and card/list visual. Missing/broken/non-image preview uses a clean icon rather than a broken image. Cards/list never derive their image from Gallery order.

**Gallery** is an independently saved ordered collection of additional references. It has no `primary`/`is_primary` flag, Primary badge or Set as Primary action. Each item shows its preview and filename with a top-right three-dot menu: Move earlier, Move later, Remove from Gallery. Boundary moves are disabled. Adding/removing/reordering dirties Gallery only.

Main Image can also appear intentionally in Gallery. Replacing/clearing Main Image does not change Gallery. Removing a Gallery reference never deletes the physical file. Duplicate paths within one Gallery are disabled in the Picker and deduplicated on return.

Create still requires only base Name, starts Hidden and keeps translations, Main Image and Gallery locked until the mock ID exists. The same dialog remains open and becomes Edit; controls then unlock subject to existing separate capabilities.

## Reusable Picker

Both Select Media and Gallery Add Media open the same HORMAT Media Picker in image-only selection mode. Main Image uses single selection; Gallery uses multiple selection, returned in selection order. Non-image files stay visible but cannot be selected; eligibility is rechecked against the current Media Details response. Neither action directly invokes local OS file selection.

The Picker uses existing File Manager architecture:

- Real filesystem folders and bounded current-folder/all-Media search through `GET /cpanel/media?partial=1`.
- Grid/List, image/file previews, folder breadcrumbs and keyboard-operable file/folder buttons.
- Abort/generation protection prevents stale search responses from replacing current results.
- Existing Details reads revalidate selected files and permission before returning `{path,url,name,image,type}` references.
- Candidate selection belongs to the Picker; Cancel/Escape does not change the Brand draft.
- It temporarily occupies the current Bootstrap dialog surface, preserving the existing focus trap/backdrop. The Brand surface becomes inert/hidden, and cancellation restores it plus focus to its trigger. Closing Picker never closes Brand.

**Upload is real:** an actor with `media.upload` may intentionally click Upload inside Picker. Only then does native local selection open. The Picker calls existing CSRF-protected direct permanent Media upload, with any file format up to the existing 10 MB/file cap. Uploaded files appear in the current folder; eligible images can then be selected. Non-image uploads remain valid Media files but cannot be attached to these image fields. They remain in Media if selection or Brand edits are cancelled; a localized notice explains this. No domain cacheToken upload, new storage subsystem or new upload backend exists.

`brands.update` never grants Media permissions. Without `media.view`, Brand editing can continue but selection controls are unavailable. Without `media.upload`, Picker upload is absent. Existing backend checks remain authoritative, including revocation during an open Picker.

The eight Brand fixtures start with no media references rather than advertising nonexistent files. Reviewers populate them from actual Media; automated tests use disposable isolated `.test-media` files.

## Scope and architecture

- No new HTTP routes, permission definitions, Brands CRUD service, repository or domain tables.
- No Brand/content translation/Gallery persistence. Their changes still reset on reload.
- No Media catalog/index/database; filesystem remains authoritative.
- No physical deletion, rename or move action in Picker/Gallery/Main Image controls.
- Brands navigation remains disabled; direct authenticated `/cpanel/brands` is the review entry point.
- Source Products and Categories were not started.

Approved future concept, **not a frozen schema**:

```text
brands                → one dedicated nullable Main Image/media reference
brand_translations    → language-specific text overrides
brand_media           → ordered Gallery relationships, no is_primary
```

Exact physical column types, reference/FK representation, temporary/cache-file linking and backend validation rules remain for backend design. The main Brand owns base `name`, a nullable main media reference and `is_visible`; translations own `brand_id/language_code/name`; ordered Gallery conceptually owns `brand_id/media_reference/sort_order`. The existing Media cache warning/lifetime rules are preserved; this stage does not silently turn temporary files into permanent domain references.

## Localization

Migration `032_brand_main_media_picker.sql` adds 10 keys / 30 actual tm/ru/en values:

- `cpanel.brands.mainImage`, `emptyMain`, `removeMain`, `mainLocked`.
- `cpanel.media.selectMedia`, `changeMedia`, `pickerTitle`, `pickerUploadNotice`, `pickerSelected`, `pickerAlreadyAdded`.

Existing Media search, folders, errors, upload-policy, Gallery ordering/unlink and permission labels are reused. Old Primary seed values remain historical localization data, but no current Brands UI renders them.

Migration 033 additionally adds `cpanel.media.pickerImagesOnly` with three actual tm/ru/en values. Both migrations applied to the development database; the running server cache was refreshed. Focused live verification passed in tm/ru/en, including Picker opening/cancellation and language switching. No exposed semantic keys were observed.

## Files

Created:

- `src/public/cpanel/js/media/picker.js`
- `src/public/cpanel/js/media/preview.js`
- `src/public/cpanel/css/media-picker.css`
- `src/views/cpanel/partials/media/picker.ejs`
- `src/database/migrations/032_brand_main_media_picker.sql`
- `src/database/migrations/033_media_picker_image_selection.sql`
- `docs/MEDIA_PICKER.md`
- This report.

Updated:

- Brands controller: existing Media capability projection.
- Brands mock data: nullable Basic Main Image and plain ordered Gallery refs.
- Brands page, Gallery partial, page JS/CSS and conditional layout assets.
- Brands/browser/unit/live-localization verification and migration inventory expectations.
- Architecture section 48 updated, section 50 added; current Brands contract, README and historical inline report cross-reference updated.

No existing Media backend/storage/mutation implementation was modified. Other pre-existing workspace changes were preserved.

## Verification

- Production build/TypeScript — PASS.
- Migrations 032–033 — PASS.
- `localization:check` — PASS: 397 UI keys covered in tm/ru/en.
- Targeted content editor, Media browser, database/fresh migration, localization and translation-integrity tests — **26/26 PASS**. Fresh database totals: 33 migrations, 422 keys, 1,266 required-language values.
- Related production browser regression: Media browser **8/8**, Media mutations **3/3**, shell **5/5** passed.
- Before the continuation, production Brands browser checks passed **10/10**. The continuation expands coverage to **12 cases, all passing across the final applicable runs**; details below.
- Live development-server verification in tm/ru/en — PASS, read-only selection checks; no live development upload/delete performed.

The first browser run exposed test selectors that matched both Brand and Picker Close controls; those selectors were scoped to Brand dismissal. The permission test was corrected to use browser fetch with the actual production secure cookie rather than a request client that followed the unauthenticated login redirect. Assertions still require forbidden access and unchanged selection on revocation.

Selected coverage includes same-dialog Create/Edit; approved inline translation regression; main selection/replace/clear; Gallery ordering/unlink/duplicates; same file in both relationships; independent dirty/save states; no immediate local chooser; real direct upload and preserved bytes after cancellation/unlink; Media permissions and CSRF; current/all search, Grid/List and stale-response rejection; focus restoration; light/dark and desktop/tablet/mobile.

**Intentionally not rerun:** full historical suite, deep Vendor/Sync/Stock/Source, Users/Profile, Media Move and standalone Permissions suites. Their implementations were not changed. The realistic affected surface is Brands, existing Media reads/direct upload, shell, localization and build; those received targeted checks. No full-regression claim is made.

## Review checklist

- [x] Main Image is a dedicated Basic field and nullable relationship.
- [x] Gallery Primary concept removed.
- [x] Both selection buttons open reusable filesystem Media Picker.
- [x] Only Picker Upload invokes local file selection.
- [x] Upload uses existing Media permissions/CSRF/direct permanent contract.
- [x] Single Main Image / multiple Gallery selection.
- [x] Picker cancellation preserves Brand drafts and restores focus.
- [x] Main Image and Gallery may share a file.
- [x] Duplicate Gallery paths prevented.
- [x] Gallery actions reside in top-right three-dot menus.
- [x] Explicit ordering, boundary states and unlink behavior.
- [x] Basic/Gallery independent save and dirty state preserved.
- [x] Cards/List derive imagery only from Main Image.
- [x] Create locks dependencies; same-dialog Edit unlocks them.
- [x] No Brand persistence/schema or Media storage redesign.
- [x] tm/ru/en values applied and live cache verified.
- [x] Light/dark, desktop (1440), tablet (768), narrow/mobile (375) verified with no horizontal overflow.
- [x] Picker, populated Main Image and Gallery menu screenshots visually reviewed.
- [x] Targeted regression and production build passed.

No known unresolved architecture blocker within this UI scope. Real Brand persistence and exact future schema are intentionally deferred. Ready for UI review; stop here.

## Continuation received: acceptance points 56–100 and supplied part of 101

The continuation was read and incorporated. It introduced image-only eligibility for Brand selections; this was added to the shared Picker contract without changing universal upload. Dedicated acceptance coverage was added for this and the combined three-scope workflow.

The received file ends with a standalone `*` after “Move right implemented” in checklist 101. All supplied requirements are covered; no unseen continuation is claimed verified.

### Final acceptance confirmations

- [x] Exactly Basic Information and Gallery tabs; no separate Translation tab.
- [x] Inline Name end-adornment, simultaneous language inputs, completeness and independent Save Translations retained.
- [x] Main Image is an explicit nullable Basic field, never derived from `Gallery[0]`.
- [x] Both Brand selection controls open shared real Media Picker, not a native chooser.
- [x] Single image Main selection; multiple Gallery images in selection order; already-added Gallery paths disabled.
- [x] Real dynamic folders, breadcrumbs, current/all search, Grid/List and explicit selection confirmation.
- [x] Selected candidates are visually indicated; Cancel never invokes the Brand selection callback.
- [x] `media.view` controls browse/select independently of `brands.update`; `media.upload` plus CSRF controls real upload.
- [x] Upload completion refreshes current folder without auto-attaching a file; uploaded files survive selection cancellation.
- [x] Create locks translations, Main Image and Gallery until mock identity exists, then unlocks without closing.
- [x] Top-right Gallery menu offers move earlier/later (left/right in row order) and unlink. Opening menus does not change state; only one is open.
- [x] Gallery order and removal never change Main Image, including when both reference the same physical file.
- [x] Main replacement and clear never change Gallery or delete either old/new physical file.
- [x] Gallery count excludes the independent Main relationship: Main A plus Gallery A/B/C has count 3.
- [x] Saved Main reference alone supplies Grid/List thumbnails; clearing it uses a placeholder even with nonempty Gallery.
- [x] Saving Gallery leaves dirty Basic/Main unchanged; saving Basic/Main leaves dirty Gallery and Name translations unchanged.
- [x] Picker cancellation preserves simultaneous Basic, translation and Gallery drafts.
- [x] Cancelled dialog-close keeps drafts; confirmed discard restores saved mock state on reopen.
- [x] Empty-state instructions use existing Media selection, never direct local-file upload as the primary Brand action.
- [x] No Gallery Primary state/actions, physical Delete/Rename/Move actions, extra permissions or native Brand file inputs.
- [x] Light/dark, desktop/tablet/mobile and nested surface scrolling/controls reviewed.
- [x] Future conceptual schema documented; no physical Brand schema created.

Gallery ordering uses the existing localized “Move earlier / Move later” labels: these work across wrapped rows as well as left/right within a row. No numbering is added; displayed order and explicit menu movement communicate the sequence.

The real Media filesystem remains authoritative. There is no temporary mock Media adapter or deferred multi-selection. Brand records and their relationships remain intentionally mock-backed.


## Continuation verification record

Commands executed after adding image eligibility and its translations:

```sh
npm run build
npm run db:migrate
npm run localization:check
node --import tsx --test tests/unit/content-editor.test.ts tests/unit/database.test.ts tests/unit/localization.test.ts tests/unit/translation-integrity.test.ts tests/unit/media-browser.test.ts
TEST_PRODUCTION=1 CHROME_PATH=/usr/bin/google-chrome node node_modules/@playwright/test/cli.js test tests/brands.spec.ts --project=core
CHROME_PATH=/usr/bin/google-chrome node --import tsx scripts/verify-brands-ui.ts
```

- Build: PASS, including production assets and TypeScript.
- Migration 033: applied to current development PostgreSQL. Verified running development process received its supported localization refresh signal; Vendor sync was not restarted or changed.
- Localization integrity: PASS, 397 UI keys with real tm/ru/en values.
- Fresh migration/content state/localization/Media read tests: 26/26 PASS.
- Focused live development-server verification: tm, ru, en PASS, actual database strings and language switching.
- First continuation browser run: 11 passed, 1 failed due to a test expecting the literal substring “failed” instead of the existing localized error “Could not load files. Please try again.” The test now compares the canonical rendered localization label and still requires unchanged Brand selection after revalidation failure.

The related Media browser (8), Media mutations (3) and shell (5) cases passed earlier in this same revision. They were not repeated for the final selection-eligibility-only continuation, which changes no Media backend or shell behavior. Historical domain suites and the comprehensive cross-module localization verifier were intentionally not rerun: focused Brands live verification plus canonical database integrity cover the new key. No full historical regression claim is made.

Final affected browser recheck:

```sh
TEST_PRODUCTION=1 CHROME_PATH=/usr/bin/google-chrome node node_modules/@playwright/test/cli.js test tests/brands.spec.ts --project=core --grep "Image Picker eligibility|Media Picker real search"
```

**2/2 PASS**. This reran the corrected eligibility test and strengthened the visual test with selected-state screenshots and viewport bounds assertions for Gallery menus. Combined with the 11 passing cases in the first continuation run, all 12 Brands cases now pass across their final applicable runs. No production behavior change was needed after the test-label correction.

Latest dark mobile selected-image Picker and light mobile open Gallery menu screenshots were visually inspected; confirmation and menu actions remain reachable. `git diff --check` passed. Obsolete Gallery Primary search found no implementation; the only relevant native file input is the explicit Picker Upload control.

**Brand backend/database persistence created? No.**
**Physical Media deletion from Brand actions? No.**
**Main Image automatically derived from Gallery? No.**
**Multiple image selection for Gallery implemented? Yes.**
**Current Media source real rather than mock? Yes.**
**Ready for UI review? Yes, for all supplied requirements.**
