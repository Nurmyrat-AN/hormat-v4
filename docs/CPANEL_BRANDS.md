# Brands — persistent module

**Current extension:** SEO/Product count rules below and architecture section 53 supersede the initial two-tab/Name-only translation schema described in the activation report.

`GET /cpanel/brands` uses the existing authenticated shell and `brands.view`. Catalog → Brands is enabled with the same effective permission. PostgreSQL is the production source of truth. Previous preview-stage restrictions are superseded by architecture section 52.

## Approved authoring workflow

Grid/List use one real filtered dataset. Search matches **base Name only**, case-insensitively; SQL wildcard characters are treated literally. Default visibility is All. Results are ordered by descending ID, nine per page. Search is debounced 300 ms, aborts outdated requests and rejects late responses. Switching Grid/List preserves filters and stores only the view preference locally.

Create accepts only base Name. PostgreSQL supplies a real ID and Hidden default; Main Image is null, translations and Gallery empty. Only successful Create transforms the same open dialog into Edit and unlocks dependent controls. Failure keeps entered Name and Create mode.

The approved dialog still has exactly Basic Information and Gallery tabs. Name's inline globe/count control expands all active registry languages. Explicit nonblank overrides count toward completeness; missing overrides fall back to the separate base Name. Unsaved base edits are clearly marked in fallback previews. No translation-language selector or separate Translations tab was added.

Basic Information, Name translations and Gallery have independent drafts, saved baselines and save/error state. Basic changes send only changed fields. Translation Save sends only language/name values. Gallery Save sends only ordered references plus its original ordered baseline. Tab switching and collapsing translations preserve drafts. Closing warns about any unsaved scope. Failed saves leave the relevant draft dirty and preserve other saved scopes. Duplicate submissions are prevented during save.

Main Image is nullable and belongs to Basic Information. It supplies Grid/List imagery independently of Gallery order. Gallery supports multiple images, ordered with earlier/later controls and unlink through each three-dot menu. Main Image may also occur once in Gallery. There is no Primary flag and no physical Media deletion.

## Exact schema

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

Both `brands.main_media_reference` and `brand_media.media_reference` store **canonical permanent root-relative paths**, e.g. `catalog/example.png`. They never contain a public URL, cacheToken, absolute path or nonexistent Media ID. There is no Media FK because the existing subsystem is filesystem-backed.

The shared Picker returns `{path, name, url, image, type}`. `path` is persistence identity; `url` is preview only. Brands submits only canonical path strings. The server uses existing `validateMediaPath` and `MediaBrowser.inspect`, including root containment, symlink rejection and actual image metadata. New references additionally require `media.view`. The Picker and service reject temporary `cache/` files. Syntactically safe manually submitted paths must pass exactly the same existence/image validation as selections.

Public URLs are derived by the existing Media service (encoded segments under `/media/`); the browser does not construct storage paths. Missing/unavailable files return a safe descriptor with null preview URL and preserve the stored relationship. Removing/reordering an existing missing Gallery relationship remains possible. File moves/deletion are not repaired automatically; filesystem changes can race with DB validation, and later reads use placeholders safely.

No physical copy, finalize, upload backend or deletion is performed by Brands. Optional Picker Upload reuses existing permanent folder upload (any file type, 10 MB/file); only eligible images can then be linked. Cancelling selection does not undo a real upload. Gallery full-form payloads are limited to 200 unique references; JSON body limit is 512 KB. These are current request/resource bounds, not a second Media architecture.

## Translation contract

`brands.name` is the required default. `brand_translations.name` is an optional explicit override keyed by active language code. Requested usable override → override; otherwise → base. Interface translations remain separately PostgreSQL-backed through the existing localization cache.

The active language registry drives UI and validation dynamically. Trimmed empty overrides DELETE the requested row; nonempty overrides UPSERT. Unsubmitted languages are preserved. Inactive language rows remain stored but are excluded from current UI/read overrides; an explicit mutation of an inactive/unknown language is rejected. Reactivating a language makes its existing override available again. Duplicate names across Brands/languages are permitted.

## HTTP and authorization

All endpoints require existing CPanel authentication. Mutations require existing CSRF (`X-CSRF-Token`) and JSON. No automatic permission implication or new roles are introduced.

| Method/path | Body/query | Authorization |
| --- | --- | --- |
| GET /cpanel/brands | page shell | brands.view |
| GET /cpanel/api/brands | query, visibility=all/visible/hidden, page | brands.view |
| GET /cpanel/api/brands/:id | none | brands.view |
| POST /cpanel/api/brands | `{name}` | brands.create |
| PATCH /cpanel/api/brands/:id | changed subset of `{name, main_media_reference, is_visible}` | brands.update for Name/Main; brands.visibility for visibility |
| PUT /cpanel/api/brands/:id/translations | `{translations:{languageCode:name}}` | brands.update |
| PUT /cpanel/api/brands/:id/gallery | `{items:[paths],original:[previous ordered paths]}` | brands.update; media.view for newly added paths |

Selecting a new Main Image additionally requires media.view; clearing it does not. Gallery reorder/unlink does not require media.upload or media.view. Actual Picker upload independently requires media.upload. A visibility-only PATCH updates only visibility and current actor/timestamp metadata, preserving current DB values of every other field. A mixed request without all field permissions is rejected atomically. Super User uses its existing exact-boolean bypass.

List returns `{success,rows,total,page,pageSize,languages}`. Read returns `{success,row,languages}`. Mutations return `{success,row,code}` (201 Create, 200 others). Safe row shape is `{id,basic:{name,is_visible,mainMedia},translations,gallery}`. Completeness and counts are derived from those returned collections, not writable browser counters. No staff IDs, absolute paths or raw DB rows are exposed.

Validation errors use stable safe codes: BRAND_INVALID_REQUEST/NAME/LANGUAGE/MEDIA, BRAND_DUPLICATE_MEDIA (400), BRAND_FORBIDDEN (403), BRAND_NOT_FOUND (404), BRAND_GALLERY_CONFLICT (409), BRAND_SAVE_FAILED/READ_FAILED (500). Client messages use real database translations. Unknown keys, forged audit fields and unexpected structures are rejected rather than persisted.

## Transactions and concurrent edits

Services own validation/business rules; repository owns SQL. Each operation rechecks active authentication, current unexpired session and exact-boolean grants in a transaction. Mutations lock the Brand. Basic applies its changed field set to the freshly locked row; translations never overwrite Basic/Gallery. Gallery compares the submitted original ordered set with the locked committed set, rejects stale saves with 409, then synchronizes links/order atomically. Cross-Brand requests cannot mutate another Brand's links. Any validation/DB failure rolls back the whole scope.

No comparable approved mutation-audit domain exists in this project. None was invented. Staff attribution/timestamps are recorded; immutable audit history remains future work.

## Verification and boundaries

See [activation report](../BRANDS_ACTIVATION_REPORT.md) and [acceptance ownership](BRANDS_ACCEPTANCE.md). Mock fixtures exist only under tests. No fake timer-based production Save remains. Source Products, Categories, Delete, Gallery Primary, automatic publication and automatic Media-reference repair remain outside scope.

## SEO and temporary Product relationship extension

Migrations 036–037 add `brands.slug text NOT NULL UNIQUE` with canonical lowercase ASCII/hyphen validation and maximum 120 characters, plus `seo_title text NOT NULL DEFAULT ''` (200 characters) and `seo_description text NOT NULL DEFAULT ''` (2000). Existing slugs are backfilled as brand-ID; Create generates brand-UUID, then administrators may edit it. No automatic slug change after renaming.

`brand_translations.name` is now nullable; seo_title/seo_description are nullable text overrides with the same field limits. No duplicate translation architecture: the existing endpoint accepts an optional allowlisted `field` (name by default). Clearing one field preserves other overrides; rows with all three null are deleted. The response keeps `translations` for Name and adds `seoTranslations: {seo_title: {code:value}, seo_description: {code:value}}`. Fallback and completeness are independent per field. Basic response includes slug and base SEO.

Basic PATCH allows slug/seo_title/seo_description under brands.update. Localized errors distinguish invalid slug, duplicate slug and SEO length/content validation. Base SEO is optional. The reusable inline component supports a textarea variant for SEO Description. All three fields have independent translations; no SEO tab is created. The dialog's third tab is Products, a read-only placeholder with no management actions.

Temporary `products.brand_id bigint NULL REFERENCES brands(id) ON DELETE RESTRICT` has a B-tree index. `source_product_id` is unchanged. `productCount` is calculated from actual products rows on each Brand read/list/mutation response. The same value appears beneath Grid/List identity and in the Products tab as a localized label plus number. No stored products_count, product mutation route or storefront route exists.

Focused tests: tests/unit/brand-seo.test.ts and tests/brand-seo.spec.ts. Historical tests are retained but not rerun for this explicitly small extension.

## Current amendment: independent SEO tab

This supersedes the SEO-in-Basic placement and Basic PATCH fields in the extension above. Final tabs: **Basic Information / SEO / Gallery / Products**. SEO's Save uses `PATCH /cpanel/api/brands/:id/seo` with changed slug/seo_title/seo_description only; existing brands.update and CSRF apply. Basic PATCH rejects SEO fields. Safe responses separate `row.seo` from `row.basic`. Each section keeps its own unsaved/saved baseline; Name/SEO Title/SEO Description translations remain independently inline. Create unlocks SEO after receiving a real ID. No schema change beyond migration 038's Save SEO interface translations.


## Attached Products activation

The formerly informational Products tab now uses the shared [Attached Products contract](ATTACHED_PRODUCTS.md). Existing foreign keys/relationship rows remain authoritative. Search and attached lists are paginated; Attach/Detach persist immediately, and Brand/Category reassignment requires confirmation. This supersedes the earlier attachment-deferred statements only.
