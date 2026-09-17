# Categories

**Current:** PostgreSQL-backed Categories is activated and enabled under Catalog with `categories.view`. The [activated contract](#activated-contract-supersedes-ui-preview-sections-above) below supersedes the historical preview section.

## Historical UI review

Open `/cpanel/categories` with `categories.view` (or Super User). Roadmap navigation remains disabled until the real module is approved and activated.

- Folder browser, root/ancestor breadcrumbs and recursive Name search; Grid/List share visibility filtering.
- Fifteen fictional content records include Electronics → Phones → Smartphones → Android/iPhone. Product counts are page-memory examples; the main count includes descendants, Products separates direct/total.
- Click a category to enter it; menu Open/Edit/Change Visibility is explicit. No Delete.
- Create requires Name and Parent, defaulting to the current folder (Root at root). A mock ID unlocks SEO, Main Image, inline translations, Gallery and Products in the same dialog. Starts Hidden.
- Searchable nested parent picker excludes self/descendants. No fixed nesting depth. Backend cycle validation is deferred.
- Basic / SEO / Gallery / Products reuse the approved shared Brands editor. Each save/translation scope is independent. Closing with unsaved changes warns. Products is informational.
- Main Image/Gallery use the existing real Media Picker, including real permission-controlled uploads. Mock category references are not saved in PostgreSQL; unlinking never deletes files. Upload notice explains files survive cancelling the picker.
- Changes last only for this page load; preview/save notices make this explicit. No Category APIs, repositories, services, tables or Products FK changes.
- Interface translations and permission metadata are real DB-backed infrastructure (migration 039); mock English sample names are content fixtures, not interface dictionaries.

## Verification

Targeted commands and exact results are recorded at task completion below. Full Brands, Media, Vendor Sync, Stock, Users and Profile suites are intentionally excluded: their business code was not changed. The extracted editor receives a focused Brands SEO/Create/save-isolation browser smoke.

Completed checks:

- `node --import tsx --test tests/unit/category-tree.test.ts tests/unit/content-editor.test.ts tests/unit/permission-registry.test.ts tests/unit/database.test.ts`: **18/18 PASS**, including a 40-level hierarchy and fresh migration/localization integrity.
- Production `tests/categories.spec.ts`: **2/2 PASS**. Recursive navigation/breadcrumbs/search, Grid/List/filter, parent exclusion/reparenting, Create unlock, Hidden default, independent saves, inline translations, real Media selection, Main Image, Gallery reorder/unlink, Products counts, read-only/403, reload reset and no Category mutation requests.
- Production `tests/brand-seo.spec.ts`: **2/2 PASS** after extracting the shared editor; no full Brands regression.
- Focused Categories live verification against port 3000: **1/1 PASS**, tm/ru/en DB values, topbar language switch returns to Categories, permissions. Dev cache refreshed via SIGUSR2 without stopping synchronization.
- `npm run localization:check`: **PASS**, 440 used UI keys; 467 canonical keys / 1401 tm/ru/en values. Migration 039 applied to current development database.
- Light/Dark dialog and mobile browser screenshots reviewed; no horizontal overflow in representative 1280/390 viewport checks.
- `npm run build`, browser JS syntax checks and `git diff --check`: **PASS**.

Initial test-only failures (Socket.IO polling classified as a domain write, placeholder text omitted from the localization corpus, and closing during Bootstrap opening animation) were corrected before final passing runs. No unresolved functional issue identified. Only relevant shared-editor/registry/localization smoke ran; unrelated historical domains were intentionally not rerun. Ready for UI review; no Categories persistence is implemented.

## Activated contract (supersedes UI-preview sections above)

PostgreSQL is now authoritative. Catalog → Categories uses categories.view and the approved editor uses real independent HTTP saves. No normal production mock data/save remains.

### Exact schema

[Migration 040](../src/database/migrations/040_categories.sql) defines:

- `categories`: `id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY`; nullable `parent_id bigint REFERENCES categories(id) ON DELETE RESTRICT`, CHECK parent_id<>id; `name text NOT NULL` trimmed length1–200; unique required `slug text` <=120 lowercase ASCII alphanumeric segments separated by single hyphens; nullable `seo_title text` <=200, `seo_description text` <=2000, `main_media_reference text`; `is_visible boolean NOT NULL DEFAULT false`; nullable bigint `created_by/updated_by` referencing cpanel_users ON DELETE SET NULL; required timestamptz created_at/updated_at DEFAULT now(). Updated trigger uses existing cpanel_touch_updated_at(). Indexes: PK, unique slug, `(is_visible,id DESC)`, `(parent_id,id)`.
- `category_translations`: required bigint category_id FK RESTRICT and text language_code FK languages(code), composite PK; nullable name/seo_title/seo_description text overrides, trimmed nonempty values within200/200/2000 limits; required timestamptz timestamps DEFAULT now(), updated trigger. Base fallback, active-language service validation, field-scoped UPSERT/clear; no global Name uniqueness.
- `category_media`: required bigint category_id FK RESTRICT, required nonempty text media_reference, required nonnegative integer sort_order, composite PK(category_id,media_reference), deferred UNIQUE(category_id,sort_order), required timestamptz timestamps DEFAULT now()/updated trigger. Canonical references are filesystem-root-relative paths, not image src or absolute paths. No Media FK/copies/deletion.
- `products.category_id`: nullable bigint FK categories(id) ON DELETE RESTRICT, indexed. Existing source_product_id and brand_id remain intact. No Product-management endpoint.

Base empty SEO is SQL NULL; inputs get empty strings. Create generates category-UUID slug independently of Name. Changing Name does not rewrite slug. Visibility affects only the target row. Counts derive from products/category closure; no count/health columns.

### HTTP contracts

All URLs below are under `/cpanel/api/categories`, separate from EJS GET `/cpanel/categories`.

| Operation | Contract | Permission |
| --- | --- | --- |
| GET `/` | parent (empty/root), query (base Name), visibility all/visible/hidden, page, optional exclude target for picker; 50/page, rows/counts/breadcrumbs | categories.view |
| GET `/:id` | safe full authoring model, authoritative ancestry and derived counts | categories.view |
| POST `/` | `{name,parent_id}` only; hidden base entity, real ID, no dependent records | categories.create |
| PATCH `/:id` | changed name/parent_id/main_media_reference/is_visible only | update for first three; visibility independently |
| PATCH `/:id/seo` | changed slug/seo_title/seo_description only | categories.update |
| PUT `/:id/translations` | `{field,translations:{language_code:value}}`, field name/seo_title/seo_description | categories.update |
| PUT `/:id/gallery` | `{items:[canonical refs],original:[previous ordered refs]}` | categories.update; media.view for new links |

Mutations require existing header CSRF and session, reject extra query/body fields, and return `{success,row,code}` or safe failure code/status. No Delete or Product Attach/Detach. Mutations are transactional and recheck authority; latest scoped save is authoritative except Gallery's explicit conflict check. Read models expose no server paths or auth data.

### Hierarchy/concurrency

Transactions acquire hierarchy advisory lock before reading parent relationships or locking the target. The subsequent READ COMMITTED statements see prior hierarchy commits; concurrent opposing moves cannot both pass. Descendants retain their original parent IDs on subtree movement. Imports/manual SQL must use the same contract. Recursive ancestry carries visited IDs and fails safely for pre-existing malformed cycles. Counts use UNION closure to prevent cyclic recursion and aggregate all page IDs together. Parent picker recursively loads branches instead of shipping the complete tree.

### Activation verification

Results recorded after final targeted execution below. Earlier UI-stage numbers describe historical preview checks only.

Final activation results:

| Check | Result |
| --- | --- |
| `tests/unit/categories.test.ts` | 8/8 PASS |
| `tests/unit/database.test.ts` (fresh migrations/localization) | 8/8 PASS |
| `tests/unit/navigation.test.ts` | 7/7 PASS |
| Production `tests/categories.spec.ts` (three targeted scenarios, executed in scoped runs) | 3/3 PASS |
| Same affected localization/navigation scenario against current dev server | 1/1 PASS |
| `npm run localization:check` | PASS: 441 used keys, all tm/ru/en values |
| `npm run build` / `git diff --check` | PASS |

27 passing targeted checks across the final runs. Service tests cover concurrent inverse moves, defensive malformed ancestry, A/B/C/D cycle rejection and subtree moves, 2/3/4 → 9/7/4 Product counts, scoped SEO/translation saves, Main/Gallery safety, independent permissions and rollback. Browser tests cover persisted authoring/reload, real parent picker/search, Media selection, ordering/unlink, CSRF/permissions, navigation and actual DB translations. Migration 040–041 is applied to the current dev DB and its localization cache was refreshed with SIGUSR2.

A missing URL-hash navigation handler found by the browser scenario was fixed. The live verifier now waits for Bootstrap's modal readiness before testing Close. Final scoped reruns passed; no known task issue remains. No shared editor/Media business code changed in activation, so no full Brands/Media or unrelated Vendor Sync/Stock/Users/Profile suite was rerun. Temporary tests cleaned their own rows/files; no real Vendor/source/stock data was modified.

Deferred: Category Delete; Product Attach/Detach and full Products domain; Source Products UI. No next module started.

## Move Category

Menu Move requires categories.update. The confirmation dialog reuses the exact Parent picker element/handlers from Edit, accepts Root, disables current parent and server-reported self/descendants, and displays current/new locations before Save. Cancel restores the picker to Edit and writes nothing. In-flight saves prevent duplicates/dismissal; failures retain the destination and show a localized error.

PATCH `/:id` with **only** `{parent_id}` selects narrow repository Move SQL. Existing auth, CSRF, hierarchy lock and cycle validation apply. Only parent_id and normal modification metadata change; ID, created metadata, content, translations, Gallery, child links and products.category_id stay intact. There is no categories.move permission or new endpoint/table. Success refreshes current children/breadcrumbs/derived counts.

Focused Move verification: **5/5 PASS** — one consolidated service/persistence scenario, two fresh-migration/localization checks, one production browser scenario and the same browser scenario against the current development server. These cover destination/Root moves, subtree and Product-link preservation, content/media/translation preservation, ancestor counts, cycle rejection, categories.update, CSRF, picker restoration and actual tm/ru/en labels. Migration 042 is applied; the development localization cache was refreshed. `npm run localization:check` passes (444 used keys); `npm run build` and `git diff --check` pass. The confirmation layout was visually reviewed. No broad Categories/Brands/Media/Vendor/Stock regression was run: this change reuses existing category mutation, authorization and picker infrastructure and its affected paths are covered by the focused checks.


## Attached Products activation

The formerly informational Products tab now uses the shared [Attached Products contract](ATTACHED_PRODUCTS.md). Existing foreign keys/relationship rows remain authoritative. Search and attached lists are paginated; Attach/Detach persist immediately, and Brand/Category reassignment requires confirmation. This supersedes the earlier attachment-deferred statements only.
