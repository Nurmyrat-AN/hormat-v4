# Product Create/Edit activation

The owner approved persistence for the seven-tab dialog and a temporary, unfiltered list of existing Products. The final Product browser, storefront, pricing/Discount engine, Orders and Delete remain deferred.

## Identity and schema

Migration 074 extends the existing `products`; it does not replace IDs or relationships. Existing rows receive their Source's trimmed name (an ID-based fallback only for an empty source name). Required `name` and required, non-unique `source_product_id` allow many Products per Source. A database trigger rejects Source changes. Existing nullable Brand/Category FKs are reused.

New columns: `name text NOT NULL`; `is_visible`, `is_placement_product`, `show_as_in_stock`, `hide_when_out_of_stock` boolean NOT NULL DEFAULT false; nullable `price_action text`, `price_value numeric`, `slug text`, `seo_title text`, `seo_description text`, `short_description text`, `description_html text`; nullable `created_by`/`updated_by bigint` FKs to staff with ON DELETE SET NULL. Existing identity/timestamptz columns and update trigger remain. Slug is nullable, unique when present, uses Brand/Category lowercase ASCII/hyphen normalization and a 120-character limit. No automatic Main Image, calculated-price or effective-visibility column.

`product_translations`: `(product_id bigint, language_code text)` primary key, conservative Product FK and existing language-code FK; nullable Name, Short Description, HTML Description, SEO Title/Description; timestamptz creation/update and shared update trigger. Active registry languages only. Per-field blank overrides become NULL; entirely empty rows are removed. Omitted/inactive overrides remain untouched. Base values are independent fallbacks.

`product_media`: `(product_id bigint, media_reference text)` primary key; nonnegative integer sort_order, boolean is_primary default false, timestamptz creation/update and shared trigger. Deferred unique Product/order and partial unique Product WHERE is_primary enforce independent ordering and zero-or-one Primary. Canonical root-relative Media references have no fabricated asset-table FK. Missing files retain relationships/placeholders. Remove never deletes a physical file and removing Primary never elects another.

Existing `product_discounts` is reused, with no Discount definition changes. Attachments display priority DESC, ID ASC for ties. No manual ordering.

## Service and HTTP contract

`ProductsService` validates operation-specific allowlists; `ProductsRepository` owns parameterized SQL and transactional actor/session/exact-permission checks, following existing auth-row/session lock order. Product mutations lock the Product. No audit subsystem exists in comparable content modules; only staff attribution is recorded.

Base `/cpanel/api/products`:

- GET `/`: temporary list; products.view.
- GET `/:id`: complete safe editor read; products.view.
- GET `/source/:id`: safe fixed-Source context for Create; products.create.
- GET `/discounts?product_id=&query=&page=&selected=`: bounded 20-row autocomplete search/hydration, excluding this Product’s existing attachments in SQL; products.update AND discounts.view.
- POST `/`: `{source_product_id,name,brand_id?,category_id?}`; products.create. Initial visibility is always false. Returns the real ID and full editor state; same modal becomes Edit.
- POST `/:id/basic`: changed subset `{name,brand_id,category_id,is_visible}`. Content needs products.update; visibility needs products.visibility independently.
- POST `/:id/seo`: `{slug,seo_title,seo_description}`; products.update.
- POST `/:id/description`: `{short_description,description_html}`; products.update. Reuses the centralized HTML sanitizer, including safe manual HTML styles/images.
- POST `/:id/visibility`: `{is_placement_product,show_as_in_stock,hide_when_out_of_stock}`; products.visibility.
- POST `/:id/priceRules`: `{price_action,price_value}`; products.update. Both NULL clears. Five approved actions; nonnegative decimal-string value (up to 128 transport characters), PostgreSQL NUMERIC. No invented storefront rounding/clamping or Discount calculation.
- POST `/:id/translations`: `{field,translations:{language:value}}`; products.update. Field allowlist maps directly to five translatable columns, without changing other scopes.
- POST `/:id/gallery`: `{original:[{path,primary}],items:[{path,primary}]}`; products.update, plus media.view for new references. Full ordered Gallery save matches its original baseline under lock; conflicts return 409. New paths use existing Media resolver/actual-image eligibility. Reorder/remove need no upload right.
- POST `/:id/discounts`: `{original:[id],items:[id]}`; products.update, plus discounts.view for new attachments. Unique IDs, authoritative lookup and original-set conflict detection; no definition mutation.
- POST `/:id/preview`: same rule body, read-only price calculation under products.view OR products.update. CSRF applies despite no persistence. Uses the current Source and centrally normalized currency value.

All POSTs use existing authentication/CSRF and bounded JSON. Unexpected keys, source replacement, staff identity overrides, invalid references/languages/values are rejected. Exceptions are stable safe errors; no DB internals enter the browser.

## Price and visibility boundaries

Central `convertPrice` supplies Source price × effective Vendor rate, with missing rate exactly 1 (without creating configuration). PostgreSQL NUMERIC applies the optional rule and returns decimal strings. Client preview is debounced and ignores stale replies; no JS money arithmetic or persisted derived price.

show_as_in_stock is presentation only; hide_when_out_of_stock is valid simultaneously and evaluates real stock <=0. Neither writes source stock. Placement grants no bypass or invented behavior. The diagnostic reports current Source/Vendor activity, Product visibility and stock condition. Selected Brand/Category visibility is informational pending final storefront semantics, not a persisted global decision.

## UI and scope isolation

Source-only selection performs no write. Entry A selects Vendor/Source then opens the full Create dialog. Entry B opens the same dialog directly. Only full Create inserts. Immutable Source remains in the header across tabs and Create→Edit. Brand/Category retain shared asynchronous search, path context, pagination and ID hydration.

Each tab/inline translation owns its draft, baseline and Save. Responses update only the saved client scope; errors retain drafts. Gallery draft changes persist using the approved footer Save. Discount selection and detachment persist immediately through narrow relationship operations; the Discounts tab has no Save button. Temporary Products list only identifies records and opens Edit; no search/filter/browser optimization was added. Translation migration 075 updates save/diagnostic copy and adds conflict text in tm/ru/en.

Verification is targeted Product schema/services, scope/security/Media/Discount integration, both browser entry points, persistence/reopen, inline HTML, translations, localization and production build. Unrelated historical domain suites remain deferred.

## Activation verification (2026-09-17)

- `node --import tsx --test tests/unit/products-activation.test.ts`: **8/8 PASS** (isolated schema and Media root).
- Production Playwright `tests/products.spec.ts`, `tests/product-create.spec.ts`, `tests/product-reference-ui.spec.ts`, project core: **8/8 PASS**. Covers both entry points, real Create→Edit, async references, all independent scopes, immutable header, real Picker/Gallery, permissions/CSRF, failure/retry, persisted reopen and light/dark/narrow smoke.
- Fresh migration/integrity tests selected from `tests/unit/database.test.ts`: **2/2 PASS**.
- `npm run localization:check`: **PASS**, 715 used keys with real tm/ru/en values.
- `scripts/verify-product-create-localization.ts` on the already-running development server: **tm/ru/en PASS**, language switching and real Create→Edit; disposable records cleaned up.
- `npm run build`: **PASS**. `git diff --check`: **PASS**.

Historical test Product inserts now supply the newly required Name; no historical assertion was weakened. Their syntax was checked, but unrelated deep Sync/Stock/Media/Users/Profile/Catalog regression was intentionally not executed. Only Product integrations and localization migration integrity were in scope. Sidebar availability is unchanged by this dialog-only task; the temporary list remains at `/cpanel/products`.


## Discount autocomplete amendment

The shared AsyncAutocomplete replaces the attachment overlay. It uses 300 ms debounce, stale guards and server pagination; options show Name, Priority and localized Visibility. No complete Discount preload. Selection POSTs `/:id/discounts/attach` with `{discount_id}`; success replaces only committed Discount state, clears the control and restores focus. Failure retains selection and never inserts a local fake relationship. The existing three-dot Detach action POSTs `/:id/discounts/detach` and removes only the relationship. The next search can offer that Discount again.

Both endpoints require products.update and CSRF, lock the Product and revalidate the actor/session. Attach additionally requires discounts.view and authoritative Discount existence. The database composite primary key rejects duplicate crafted/concurrent requests (409); no ON CONFLICT-success shortcut. Detach does not require browsing/upload rights. Responses return the committed attached list ordered priority DESC, ID ASC. Other tab drafts and Discount definitions are untouched. The older full-set synchronization service remains compatible for existing callers, but the dialog uses only incremental operations.

Migration 076 adds five interface keys with real tm/ru/en values; Attach/Detach labels, Priority, Visibility and common errors are reused. No business schema or new permission.

## Source Product details integration

Source details → Products reads `products.source_product_id` through `GET /cpanel/api/products/source/:id/products?page=1`, 20 rows/page ordered Name/ID with exact count. Both source_products.view and products.view are required. Safe Primary image previews reuse Media; missing images use placeholders. Source1→manyProducts remains immutable after creation.

Create New Product (products.create) skips Vendor/Source selection and uses the shared editor with fixed header Source, prefilled Name and locked dependent tabs until actual Create. Existing Product Edit requires UI update+view, with existing backend read/mutation authorization. A modal handoff avoids stacked backdrops; close/discard returns to refreshed Source Products tab and refreshes browser counts. No attach/detach/move/delete actions or source mutations exist.

Focused checks: `tests/source-storefront-products.spec.ts` (2 scenarios: real multiple/paginated rows, real Create/Edit/return refresh/no-write-on-open; permissions and source-scoped reads), fresh localization integrity, live tm/ru/en via `scripts/verify-source-storefront-localization.ts`, and normal production build. Unrelated historical suites are intentionally excluded.
