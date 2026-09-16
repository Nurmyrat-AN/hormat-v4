# HORMAT V4 — Brands activation report

## Result

Brands is activated as a real PostgreSQL-backed module at `/cpanel/brands`. Catalog → Brands is enabled and requires effective `brands.view`; Super User uses the existing bypass. The approved UI is preserved: Grid/List, base-name live search, visibility filter, same-dialog Create → Edit, inline Name translations, dedicated Main Image, ordered Gallery, and independent saves.

No Delete, Gallery Primary, automatic publication, Source Products UI, Categories UI, new Media storage or synchronization functionality was introduced.

## Implemented workflow

1. Create accepts trimmed base Name only (1–200 characters), persists a real Brand and returns its bigint ID as a string. The open dialog becomes Edit; Name remains selected, dependent controls unlock. PostgreSQL guarantees Hidden, null Main Image and no automatic translations/Gallery.
2. Basic saves only changed Name/Main Image/visibility fields. Each field's permission is checked server-side. Visibility cannot be changed with brands.update alone, and a visibility-only request cannot overwrite stale Name/Main data.
3. Inline translations use the active language registry. Every requested nonempty override UPSERTs; trimmed empty values DELETE. The separate base Name remains fallback. Inactive/unsubmitted language rows are preserved. A fourth language was added and exercised in tests.
4. Main Image persists a nullable canonical Media reference separately from Gallery. Gallery supports multiple ordered references and no Primary. Add/reorder/unlink are committed atomically through one independent full-form endpoint. Duplicate links are rejected; stale ordered baselines fail safely with 409.
5. Successful backend responses update only the saved scope. Errors keep the dialog and editable draft, retain dirty state, and leave other saved scopes intact. Create failure never invents an ID or unlocks controls. Tab switches/collapsed translations preserve drafts; closing warns before discarding.
6. Grid/List use the same real dataset. Search uses parameterized PostgreSQL ILIKE on base Name only, escaped literal wildcards, 300 ms debounce and stale-response protection. Visibility defaults All. Results use descending ID, nine per page; presentation changes preserve filters.
7. Reload/reopen tests verify base Name, translations, Main Image, visibility and Gallery order. Two isolated compiled-server starts with a shutdown/restart between them verify all these values are durable and do not depend on process memory.

## Exact final PostgreSQL schema


Migration: `src/database/migrations/034_brands.sql`. IDs use existing bigint identity conventions and are serialized as strings.

| Table | Column | PostgreSQL type | Null/default/integrity |
| --- | --- | --- | --- |
| brands | id | bigint | GENERATED ALWAYS AS IDENTITY, PK, not null |
| brands | name | text | not null; trimmed; 1–200 characters |
| brands | main_media_reference | text | nullable; default NULL |
| brands | is_visible | boolean | not null; DEFAULT false |
| brands | created_by | bigint | nullable FK cpanel_users(id), ON DELETE SET NULL |
| brands | updated_by | bigint | nullable FK cpanel_users(id), ON DELETE SET NULL |
| brands | created_at | timestamptz | not null; DEFAULT now() |
| brands | updated_at | timestamptz | not null; DEFAULT now() |
| brand_translations | brand_id | bigint | not null; FK brands(id), ON DELETE RESTRICT |
| brand_translations | language_code | text | not null; FK languages(code), ON DELETE NO ACTION |
| brand_translations | name | text | not null; trimmed; 1–200 characters |
| brand_translations | created_at | timestamptz | not null; DEFAULT now() |
| brand_translations | updated_at | timestamptz | not null; DEFAULT now() |
| brand_media | brand_id | bigint | not null; FK brands(id), ON DELETE RESTRICT |
| brand_media | media_reference | text | not null; nonempty |
| brand_media | sort_order | integer | not null; >= 0, supplied by service |
| brand_media | created_at | timestamptz | not null; DEFAULT now() |
| brand_media | updated_at | timestamptz | not null; DEFAULT now() |

- `brand_translations` PK `(brand_id, language_code)` prevents duplicate overrides.
- `brand_media` PK `(brand_id, media_reference)` prevents duplicate links within one Brand. Unique `(brand_id, sort_order)` is DEFERRABLE INITIALLY DEFERRED, allowing atomic swaps.
- These PK/unique constraints create their PostgreSQL B-tree indexes. Explicit index `brands_visibility_id (is_visible, id DESC)` supports filtering/order. No speculative trigram/search indexes or global Name uniqueness.
- All FK updates use PostgreSQL's default NO ACTION. Brand children use RESTRICT rather than cascaded deletion. No Brand Delete workflow exists.
- All three tables use the existing `cpanel_touch_updated_at()` BEFORE UPDATE trigger. Creation timestamps survive updates/reorders. Translation/Gallery mutations also touch the Brand's updated_at/updated_by. Actor IDs come only from authenticated staff; attribution becomes NULL if staff are later deleted.
- Migrations follow the existing forward-only, transaction-per-migration framework. No new down-migration framework was introduced.

## Media contract

- Main Image DB representation: nullable `brands.main_media_reference text`.
- Gallery DB representation: `brand_media.media_reference text` plus integer `sort_order`, scoped to Brand.
- Canonical identity: permanent Media-root-relative path such as `catalog/logo.png`; never DOM image src, public URL, absolute filesystem path, cacheToken or fabricated media_id.
- Selection response: safe `{path,name,url,image,type}` descriptor. The domain sends path strings back. Server independently applies existing Media path/root/symlink safety and `MediaBrowser.inspect` image eligibility/existence checks. Manually forged but plausible paths receive the same validation as Picker selections.
- New references require media.view. Main clear and Gallery reorder/unlink require brands.update but no upload permission. Picker upload separately requires media.upload and existing CSRF.
- Preview URLs come from existing Media services under `/media/`, with encoded path segments. Missing files preserve DB references and use placeholders; one missing item does not break the remaining Gallery.
- Brands copies/deletes no physical Media. Picker Upload reuses the existing endpoint, any type up to 10 MB/file. Uploaded non-images cannot be selected for Brand image fields. Cancel does not undo real upload.
- Picker stays reusable: mediaType, single/multiple mode, permanentOnly, initialSelection, excluded paths, callback. Brands uses image + permanentOnly. Cache files cannot become durable references.
- Current bounds: up to 200 unique Gallery references per full-form save; 512 KB JSON body. File moves/deletes are not automatically repaired; missing-reference presentation is intentional.

## Translation contract

Base/default text is stored in `brands.name`; optional overrides are stored in `brand_translations.name`, keyed by Brand and existing language code. Requested usable override wins; otherwise base Name is displayed. Clearing/whitespace removes the override. Translation completeness counts only explicit nonblank active-language overrides, never fallback. Brands can exist with zero translations. Backend logic contains no fixed tm/ru/en list.

Interface messages remain in PostgreSQL's separate interface localization system. Migration 035 adds ten keys with all 30 real required-language values:

- cpanel.brands.persistedCreated / persistedSaved
- cpanel.brands.notFound / invalidRequest / invalidName / invalidLanguage
- cpanel.brands.invalidMedia / duplicateMedia / galleryConflict
- cpanel.media.pickerPermanentOnly

Existing navigation, four Brand permission definitions, shared content labels, denial, loading and safe Save-failure messages are reused. Canonical totals: 432 keys, 1,296 required-language values; current source inventory: 405 UI keys. Migrations 034–035 were applied to the development database. The running localization cache was refreshed and both focused Brands and global live-browser checks passed in tm/ru/en. No known new key lacks a real required-language value.

## HTTP contracts

All routes use existing CPanel authentication. Mutations require CSRF and allowlisted JSON.

| Operation | Route | Permission/body |
| --- | --- | --- |
| Page | GET /cpanel/brands | brands.view |
| List/search | GET /cpanel/api/brands | brands.view; query, visibility, page |
| Detail | GET /cpanel/api/brands/:id | brands.view |
| Create | POST /cpanel/api/brands | brands.create; `{name}` |
| Basic / visibility | PATCH /cpanel/api/brands/:id | changed subset `{name,main_media_reference,is_visible}`; brands.update and/or brands.visibility per submitted field |
| Translations | PUT /cpanel/api/brands/:id/translations | brands.update; `{translations:{languageCode:name}}` |
| Gallery add/order/unlink | PUT /cpanel/api/brands/:id/gallery | brands.update; `{items:[paths],original:[previous ordered paths]}`; media.view for new paths |

No duplicate reorder/remove/visibility endpoint is needed: narrow approved request bodies express these operations safely. Mutation success is `{success,row,code}`, HTTP 201 for Create and 200 for updates. Safe row: `{id,basic:{name,is_visible,mainMedia},translations,gallery}`. The real ID is available immediately; no reload is required. Counts/completeness are derived from safe collections. Actor IDs, raw DB rows and server filesystem paths are not returned.

Stable errors distinguish invalid input, missing Brand, denial, invalid language/Media, duplicates, stale Gallery, and generic read/save failure. PostgreSQL internals are not exposed.

## Security, integrity and audit

The service rechecks active authentication, unexpired current session and exact JSON-boolean grants transactionally. Super User needs no individual Brand rows. Unknown payload fields and forged server metadata are rejected. Gallery operations are scoped to the locked Brand and cannot mutate another Brand's rows. Registry language FK/PK prevents arbitrary codes/duplicate translation rows. Transaction-fault tests prove Basic, Translation and Gallery writes roll back.

There is no approved audit event infrastructure used by comparable modules. None was invented. `created_by`, `updated_by` and timestamps use authoritative authenticated identity; immutable mutation history remains future work.

## Files changed for this activation

New:

- src/brands/repository.ts
- src/brands/service.ts
- src/controllers/cpanel/brands-api.ts
- src/routes/cpanel/brands-api.ts
- src/database/migrations/034_brands.sql
- src/database/migrations/035_brands_activation_translations.sql
- tests/unit/brands.test.ts
- tests/fixtures/brand-previews.ts (moved out of production)
- BRANDS_ACTIVATION_REPORT.md

Updated:

- src/controllers/cpanel/brands.ts
- src/routes/cpanel/index.ts
- src/cpanel/shell/navigation.ts and context.ts
- src/public/cpanel/js/brands.js
- src/public/cpanel/js/media/picker.js
- src/views/cpanel/pages/brands-content.ejs
- src/views/cpanel/partials/media/picker.ejs
- tests/brands.spec.ts
- tests/unit/database.test.ts, navigation.test.ts, content-editor.test.ts
- scripts/verify-brands-ui.ts and verify-localization.ts
- README.md
- docs/ARCHITECTURE.md (section 52; historical-stage annotations)
- docs/CPANEL_BRANDS.md, BRANDS_ACCEPTANCE.md, MEDIA_PICKER.md, TRANSLATABLE_FIELD.md
- docs/CPANEL_NAVIGATION.md, LOCALIZATION.md, INTERFACE_TRANSLATIONS.md

Removed production fixture source: src/cpanel/brands/preview.ts. Historical UI reports remain historical evidence; this report supersedes their mock-only/navigation-disabled status. Other pre-existing working-tree changes belong to earlier tasks.

## Checks actually executed

| Command/scope | Result |
| --- | --- |
| npm run db:migrate | PASS: 034 Brands and 035 interface values applied |
| node --import tsx --test tests/unit/brands.test.ts tests/unit/content-editor.test.ts tests/unit/permission-registry.test.ts tests/unit/media-browser.test.ts | 23/23 PASS (includes 10 Brands schema/service/security tests) |
| node --import tsx --test tests/unit/database.test.ts | 8/8 PASS: fresh migrations, canonical values, cache integrity/startup |
| node --import tsx --test tests/unit/navigation.test.ts tests/unit/permission-registry.test.ts tests/unit/translation-integrity.test.ts tests/unit/localization.test.ts | 17/17 PASS |
| Compiled production Playwright: tests/brands.spec.ts, tests/navigation.spec.ts, tests/shell.spec.ts | 15/15 PASS: all 9 Brands scenarios, full roadmap and 5 shell tests |
| Selected existing Media browser/mutation scenarios + isolated Brands restart | 6/6 PASS: restart; live search; folder/history/details; permissions; HTTP mutation/CSRF/upload; real upload retry UI |
| npm run localization:check | PASS: all 405 used keys have real tm/ru/en values |
| CHROME_PATH=/usr/bin/google-chrome node --import tsx scripts/verify-brands-ui.ts | PASS on actual port 3000: tm, ru, en; real Create/Edit/translation/reload, language switch and cleanup |
| CHROME_PATH=/usr/bin/google-chrome npm run localization:verify | PASS on actual port 3000: tm, ru, en global interface checks |
| npm run build | PASS: TypeScript and production assets |
| Production npm start | PASS through Playwright; isolated compiled restart separately passed |
| git diff --check | PASS |

Counts describe individual executions; overlapping registry/restart checks are not summed as distinct tests. Earlier failures found and fixed: missing brands.view mapping in shell context; stale asynchronous test opening expectation; an incorrect fallback expectation after a translation was already saved; shared-Media localization verification omitted the Brands Picker host. Final relevant runs pass.

The regression scope covers the changed Brand persistence/UI and its actual integrations: Media safety/browse/upload, permissions/registry, CSRF, localization and shell/navigation. No shared Auth/Media/domain architecture was redesigned. Unrelated deep Vendor durable sync, stock, Profile and Users suites were intentionally not run. The existing mandatory global localization verifier does perform their established localization smoke flows on disposable fixtures; that is not full historical regression. No claim that the complete HORMAT suite was run is made.

## Visual and responsive verification

Representative production matrix: tm at 1440 px, ru at 768 px, en at 375 px; each Light and Dark. Basic/inline translations, Picker, Gallery/action menu have 18 screenshots under `artifacts/brands-active-*`. Representative desktop Light, tablet Light and mobile Dark images were visually inspected; controls stack/scroll without horizontal overflow. Automated assertions check actual database labels and absence of semantic keys. Shared shell tests also cover pin/unpin, collapse, themes, language switching, mobile/offcanvas, blocked browser storage and logout.

## Explicit confirmations / remaining boundaries

- Is Brands backed by real PostgreSQL persistence and activated in navigation? **Yes.**
- Does successful Create return a real ID and keep the same dialog open in Edit mode? **Yes.**
- Do Basic, inline translations and Gallery save independently? **Yes.**
- Does Name fallback use the separate base field? **Yes.**
- Are new Brands hidden with no automatic translations/Main/Gallery? **Yes.**
- Does brands.update alone allow changing visibility? **No.**
- Are Main Image and Gallery independent, with no Gallery Primary? **Yes.**
- Does Brands copy or physically delete Media files? **No.**
- Are temporary cache tokens/paths stored as Brand Media identity? **No.**
- Was a nonexistent Media table/FK or new upload system introduced? **No.**
- Are real tm/ru/en interface values present and the development DB/cache updated? **Yes.**
- Was Brand Delete, Source Products or Categories implemented/enabled? **No.**
- Does mock state remain the production data source? **No.**
- Are there known failing task checks or blocking implementation issues? **No.**

Intentional limitations: no immutable audit-history module, no physical-file reference auto-repair, no Brand Delete, no collaborative editing beyond scoped writes and Gallery stale-baseline protection. Missing files retain references and placeholders. Current Gallery/request size bounds are documented above. The final continuation through section 154 has now been incorporated.

## Verification after receiving the final continuation

This follow-up changed the report, architecture documentation and `tests/unit/brands.test.ts` only; production code/schema/UI stayed unchanged. Added one real-PostgreSQL populated-scope isolation/fallback test. Reran `node --import tsx --test tests/unit/brands.test.ts`: **11/11 PASS** (including the new test). Reran `npm run build`: **PASS**, exit 0; no TypeScript/build correction was needed. Production-source inspection and documentation link/diff checks passed.

The earlier 15/15 production-browser and related regression results above remain evidence for the unchanged implementation; those suites were **not rerun in this reporting follow-up**. No new interface keys or migrations were added. Deep unrelated historical suites remain intentionally omitted under the documented risk-based strategy.

## Completion requirements 127–154

### Exact inline translation read/write behavior

**`brands.name` is the base/default/fallback Name.** Language-specific values are independent overrides, not replacements for that column. The exact table/FK/PK/types are listed in the schema section above.

The page and `GET /cpanel/api/brands/:id` prepare `row.basic.name`, `row.translations` (a `{language_code: name}` map of active explicit overrides) and the active `languages` registry. Codes are text from `languages.code`, not numeric IDs. Languages are queried in registry sort order. EJS renders every active language together inside the field's collapsible editor. There is a base input, globe end-adornment, X/Y count and inline editor; no separate Translations tab or content-language switching workflow.

The production fallback helper resolves a usable trimmed string override to that override; otherwise it returns base Name. This was tested with real PostgreSQL rows, including clearing an override after changing the base Name. Empty or whitespace-only submitted translations DELETE the specific row. No base text is silently copied into an override.

Completeness is **X = active languages with an explicit nonblank override; Y = active registry languages**. Cards use committed response values. The inline count previews current editable drafts; it becomes committed only after successful Save Translations. Fallback never increments X. Real tm+ru overrides with en absent yield 2/3; clearing ru yields 1/3. No requirement to complete every language before creating/publishing exists.

`PUT /cpanel/api/brands/:id/translations` accepts only `{translations:{code:name}}`. It checks authenticated session, `brands.update`, existing CSRF and active-language membership. Nonblank values are trimmed and UPSERTed on `(brand_id, language_code)`; blank values DELETE. Unsubmitted/inactive rows are preserved. Failed validation or SQL rolls back the transaction. UI maps stable safe errors to PostgreSQL-backed interface messages and retains dirty input. Success accepts normalized overrides into that field's own baseline. A new active language appears after a fresh page load without Brand schema/code changes; no live registry-push mechanism is claimed.

### Proven save-scope isolation

The additional PostgreSQL test `all populated persistence scopes remain isolated; real overrides and cleared values resolve to base` starts with nonempty translations/Gallery, a Main Image and visible Brand. It checks:

- Translation Save leaves `brands.name`, `main_media_reference`, `is_visible` and all Gallery rows/timestamps unchanged.
- Basic Save changes Name/Main/visibility but leaves full translation and Gallery rows/timestamps unchanged.
- Gallery reorder leaves Basic values and full translation rows/timestamps unchanged.
- Clearing a translation removes its row, restores real base fallback and reduces explicit completeness.

Brand `updated_by`/`updated_at` attribution is intentionally touched by successful translation/Gallery operations; isolation refers to the listed content fields/relationships, not those audit metadata fields. The previously executed browser scenario separately proves unsaved drafts in other scopes remain unsaved.

### Gallery, Main Image and Picker details

Gallery uses `(brand_id, media_reference)` identity, unique nonnegative integer order and the exact schema above. Add Media opens multiple selection; duplicates already in that Gallery are disabled. Selected paths enter a draft. Save Gallery atomically applies add/unlink/order against the original ordered baseline. Earlier/later controls change order; Remove unlinks only at Save. Missing physical files remain represented safely. `brands.update` plus CSRF protects all Gallery saves; new links additionally require media.view. **`brand_media` has no Primary/Main semantics.**

Main Image is nullable `brands.main_media_reference`. Selection/replacement checks safe permanent canonical path, existing file and actual image metadata through shared Media; Basic Save persists it. Clear sends null; replacement does not delete the old file. Missing files keep the reference and show a placeholder. **Main Image != Gallery[0]**: changing Gallery order never derives or changes Main Image.

The Picker reuses File Manager listing/search (`GET /cpanel/media?partial=1`), fresh Details (`GET /cpanel/api/media/details`) and direct upload (`POST /cpanel/api/media/files?path=...`). Folder navigation, breadcrumbs, current/all search, previews and Grid/List use those existing services. Main uses single selection; Gallery uses multiple selection with excluded paths. Non-images remain visible but disabled; eligible descriptors are revalidated at confirmation and again by Brand mutation. Returned `{path,name,url,image,type}` distinguishes canonical identity from preview URL.

Both **Select Media** and **Add Media** open HORMAT Picker. Neither invokes OS file selection. Only the explicit Picker Upload action invokes the hidden local file input. Existing media.view/media.upload/CSRF checks remain authoritative. The Picker occupies the existing Bootstrap host modal, makes underlying controls inert and preserves its focus trap/backdrop. Cancel/Escape restores the same draft and trigger focus. These behaviors were exercised in production browser tests, including revoked permission and a changed type at confirmation.

### Permissions: UI, backend and evidence

- **brands.view — PASS:** page/list/details/navigation access. Missing/false/nonboolean values are denied; true allows access. Tested in service matrix, HTTP and navigation scenarios.
- **brands.create — PASS:** Add control and POST Create. Independently tested from update/view/visibility; creating does not grant later edit rights.
- **brands.update — PASS:** Name/Main, inline translation and Gallery controls and their backend mutations. Read-only controls and manual requests are tested. It cannot bypass visibility or Media permissions.
- **brands.visibility — PASS:** independent visibility control and field-level PATCH authorization. A crafted update-only request cannot change visibility; permission matrix and HTTP escalation tests passed.
- **media.view — PASS:** Picker reads/confirmation and new Main/Gallery references require it. Grant without upload permits selection; revocation blocks subsequent reads. Existing-link reorder/unlink and Main clearing need only the Brand update right.
- **media.upload — PASS:** explicit Upload control/endpoint; does not follow from any Brand grant. Existing direct upload/CSRF/revocation tests and Picker upload tests passed.

Super User uses its existing exact-boolean bypass; ordinary grants remain independent. Brand definitions appear through the centralized Permissions registry. No brands.delete definition was introduced.

### Security evidence actually exercised

- Forged `id`, created/updated actor/timestamps, translation/gallery counts, effective_name, cacheToken and URL fields: rejected across mutation scopes without writes.
- `brands.update` without `brands.visibility`, forged is_visible: denied; persisted visibility unchanged.
- IDs 0, negative, SQL-like and bigint-overflow strings: safe not-found rejection.
- Unknown/inactive language: rejected; duplicate language row blocked by PK; UPSERT does not duplicate.
- Cross-Brand/stale Gallery baseline: conflict rejection and the other Brand's Gallery unchanged. Canonical files may legitimately be shared across Brands; they are not private row IDs.
- `../`, external absolute path, file URL, encoded traversal, null byte, backslash, symlink escape, missing file, fake image and cache path: rejected for new Main/Gallery references.
- Duplicate Gallery paths: rejected by service/DB integrity. Concurrent saves: one succeeds, stale competitor fails atomically.
- Missing/invalid CSRF: Create, Basic, visibility, translations, Gallery and Picker upload blocked; no corresponding mutation.
- Missing/false/string/number/null grants, revoked session/current permissions: denied. Only JSON boolean true grants ordinary permission.
- Missing physical Main/Gallery file: safe placeholder, retained DB link, continued Gallery operation.
- Forced transaction failures: Basic, translation and Gallery rollback; browser error/conflict scenarios retain unsaved selections and do not mark them saved.

### Executed shared Media groups and production evidence

The earlier six-test related browser execution comprised:

- `tests/brands.spec.ts`: compiled application restart persistence.
- `tests/media-browser.spec.ts`: “Media live search ignores stale results…”; “Media continuation: history, refresh…”; “Media individual capabilities and auto-registry integration…”.
- `tests/media-mutations.spec.ts`: “Media mutation HTTP: independent strict permissions, CSRF…”; “Media real UI: per-file success/error, retry…”.

`tests/unit/media-browser.test.ts` covered reused Media path/read safety in the 23-test execution. Other executed suites/files and exact results are listed above. In the compiled production browser suite, list/search/filter/Grid/List, Create → Edit, Basic save, inline translations, Main selection, Picker upload, Gallery add/reorder/remove, visibility and reopen were all exercised against real PostgreSQL, not production fixtures. Save → close → reload → reopen retained **base Name, visibility, Main Image, translation overrides, Gallery membership and Gallery order: YES for all**. The isolated compiled restart additionally retained all six values.

### Obsolete implementation inspection

Searched the production Brand service/routes/controllers, page JS/EJS, content partials, Picker and migration 034. No separate Translations tab, content-language switch editor, Gallery Primary/isPrimary/is_primary, Set as Primary, Gallery-derived Main, Brand-owned local-file chooser, Brand physical Media deletion, Save All, Delete Brand, production mock source or fake Saved timeout remains. The `setTimeout` matches are search debounce only; the local-file `.click()` belongs solely to explicit reusable Picker Upload. Test-only mock fixtures remain under tests. PostgreSQL is the production source of truth.

## Final completion table

| Area | Result |
| --- | --- |
| Database schema | PASS |
| Create → Edit | PASS |
| Basic Information | PASS |
| Inline translations | PASS |
| Translation fallback | PASS |
| Independent save scopes | PASS |
| Main Image | PASS |
| Media Picker | PASS |
| Gallery | PASS |
| Gallery ordering | PASS |
| Main/Gallery separation | PASS |
| Visibility | PASS |
| Brands permissions | PASS |
| Media permissions | PASS |
| CSRF | PASS |
| Media reference security | PASS |
| Localization | PASS |
| Navigation | PASS |
| Persistence after reload | PASS |
| Targeted regression | PASS |
| Production build | PASS |
| Production verification | PASS |

Gallery multiple selection is implemented and tested, not deferred. Audit-event history was intentionally not introduced because comparable modules have no approved audit infrastructure; authenticated attribution/timestamps are the implemented preparation.

## Explicit confirmations (section 152)

* Is Brands now PostgreSQL-backed? **YES**
* Is the approved UI preserved? **YES**
* Does a new Brand default to `is_visible=false`? **YES**
* Does Create return the real Brand ID? **YES**
* Does Create keep the dialog open and transition to Edit? **YES**
* Is `brands.name` the default/fallback Name? **YES**
* Are translations stored independently by language? **YES**
* Are translations edited inline with all active languages visible together? **YES**
* Is there a separate Translations tab? **NO**
* Does clearing a translation restore fallback behavior? **YES**
* Does fallback count as an explicit completed translation? **NO**
* Is Main Image a dedicated Brand field/reference? **YES**
* Is Main Image nullable? **YES**
* Is Main Image independent from Gallery? **YES**
* Does Gallery have a Primary flag? **NO**
* Is Gallery ordered? **YES**
* Can Gallery reorder without changing Main Image? **YES**
* Does removing Gallery Media physically delete the file? **NO**
* Does clearing Main Image physically delete the file? **NO**
* Does normal `Select Media` open HORMAT Media Picker rather than local file picker? **YES**
* Does normal `Add Media` open HORMAT Media Picker rather than local file picker? **YES**
* Can local file selection occur only through explicit Media Upload workflow? **YES**
* Does `media.view` control Media browsing? **YES**
* Does `media.upload` control Media uploading? **YES**
* Can `brands.update` bypass Media permissions? **NO**
* Are Basic Information, Translations and Gallery independently persisted? **YES**
* Does `brands.visibility` independently protect visibility mutation? **YES**
* Is Brand Delete implemented? **NO**
* Is `Catalog → Brands` enabled after successful activation? **YES**
* Is Source Products UI still postponed/disabled? **YES**
* Is PostgreSQL the production source of truth for Brands? **YES**
* Did the targeted regression pass? **YES**
* Did `npm run build` pass? **YES**
* Was real persistence verified after reload/reopen? **YES**

Implementation stops here for owner review. Categories, Products, Source Products UI, Brand Delete and storefront Brand pages were not started.

