# Activated Discounts — current contract

The approved UI now uses PostgreSQL exclusively. This section supersedes the historical preview notes below. Catalog → Discounts is enabled under discounts.view; Source Products stays disabled. No Product Attach/Detach, pricing, priority winner rule or Delete is implemented.

## Schema (migration 045)

- **discounts**: id bigint GENERATED ALWAYS AS IDENTITY PK; name text NOT NULL (trimmed, 1–200 characters, not unique); priority integer NOT NULL DEFAULT 0; starts_at/ends_at nullable timestamptz; before_action/after_action text NOT NULL DEFAULT removePercent/removeAmount; before_value/after_value nullable NUMERIC; is_visible/is_visible_on_product boolean NOT NULL DEFAULT false; created_by/updated_by nullable bigint FK to cpanel_users(id) ON DELETE SET NULL; created_at/updated_at timestamptz NOT NULL DEFAULT now(). Updated timestamp uses cpanel_touch_updated_at(). Index (is_visible,id DESC). Date finite/order constraints, exact five-action CHECKs, finite nonnegative numeric CHECKs, percentage 0–100 CHECKs.
- **discount_translations**: discount_id bigint NOT NULL FK discounts(id) ON DELETE RESTRICT; language_code text NOT NULL FK languages(code); name text NOT NULL trimmed 1–200 characters; created_at/updated_at timestamptz NOT NULL DEFAULT now(); PK(discount_id,language_code), updated timestamp trigger. Blank submitted override deletes only that language row; omitted languages remain. Only active languages may be submitted. The separate base Name remains fallback.
- **product_discounts**: product_id bigint NOT NULL FK products(id) ON DELETE RESTRICT; discount_id bigint NOT NULL FK discounts(id) ON DELETE RESTRICT; created_at timestamptz NOT NULL DEFAULT now(); PK(product_id,discount_id); index(discount_id). Both sides support many relationships. No products.discount_id or persisted count column exists.

## HTTP contracts

All routes use existing authentication; mutations use existing header CSRF, bounded 32 KB JSON and transactional authority rechecks. Mutation errors return safe codes; client maps to PostgreSQL-backed messages. No raw database error reaches the browser.

| Method/path | Contract / authority |
| --- | --- |
| GET /cpanel/discounts | Shell + initial persisted list, discounts.view |
| GET /cpanel/api/discounts | query/visibility/page; defaults empty/All/1, nine rows/page, discounts.view |
| GET /cpanel/api/discounts/:id | Safe Basic/Rules/translations/count, discounts.view |
| POST /cpanel/api/discounts | Exactly name, priority; discounts.create; returns real ID, both flags false, no translation/product rows |
| PATCH /cpanel/api/discounts/:id | Changed name/priority/starts_at/ends_at/is_visible_on_product under discounts.update; is_visible separately requires discounts.visibility |
| PATCH /cpanel/api/discounts/:id/rules | Exactly before_action/before_value/after_action/after_value, discounts.update |
| PUT /cpanel/api/discounts/:id/translations | {translations:{activeLanguage: nameOverride}}; discounts.update |

Unknown fields, bad IDs, noninteger/out-of-int32 priorities, nonboolean flags, unknown/inactive languages, invalid dates/actions/decimals fail safely. Dates are null or explicit UTC ISO instants (seconds plus optional millisecond fraction); local browser controls convert to/from UTC. Both boundaries must be ordered. Rules use null or nonnegative plain decimal strings (maximum 128 characters); no floating-point persistence/conversion, exponent or currency conversion. Percent values are 0–100 inclusive by explicit owner decision. Priority may be signed; its winner direction is intentionally undefined.

## UI and consistency

The original three tabs and footer are retained. Create uses minimum Name/Priority; name-display switch is disabled until the real ID exists, ensuring false on creation. Basic/Rules/Name overrides save independently and keep unrelated local drafts intact. Failures keep the affected draft dirty; duplicate submissions/modal dismissal are blocked while saving. Narrow SQL and fresh row locks preserve other scopes. Grid/List use the same bounded real search result and count. Stale search responses are ignored. Existing nullable rules show a neutral missing value; no applicability/pricing claim is made.

is_visible_on_product is name-presentation metadata only, never an input to applicability/priority/calculation. It requires discounts.update; is_visible independently requires discounts.visibility. Exact Super User bypass is unchanged; no individual grants are inserted. Committed permission revocation applies on subsequent requests. No new audit domain is introduced; created/updated staff attribution follows Brands/Categories.

Migration 046 adds four activation messages with real tm/ru/en values. Migrations 045–046 have been applied to the development DB; live localization cache is refreshed. The canonical module files are src/discounts/{repository,service}.ts, controllers/cpanel/discounts{-api}.ts, routes/cpanel/discounts-api.ts and the existing Discounts EJS/JS. The reusable inline field accepts an optional host save label to report real persistence; its default behavior for other hosts is unchanged.

## Activation verification

**15/15 targeted tests PASS** in their final scoped runs:

- 6 Discounts service/schema cases: defaults, strict validation, independent persistence/rollback/fallback, all actions/decimal bounds, permissions, many-to-many/count/search.
- 4 selected fresh-migration/localization and permission-registry checks.
- 2 navigation configuration checks.
- 3 production browser scenarios: persisted authoring/reload/independent saves/count/CSRF; HTTP permissions/revocation/invalid payload; enabled permission-aware navigation.

`npm run localization:check` passes with 483 used keys; canonical totals are 512 keys / 1,536 real required-language values / 46 migrations. `npm run localization:verify -- --scope=discounts` passes actual running-server tm/ru/en values and topbar language return routing. Final `npm run build` and `git diff --check` pass. A JSONB literal in a test fixture and an empty-list template-attribute inventory in the live verifier were corrected; affected checks were rerun successfully.

No full Brands/Categories/Media/Vendor Sync/Stock/Users/Profile suite ran: their business implementations and schemas were not changed. The only shared field change is an optional persisted-save label; existing default remains unchanged. Test accounts, isolated-schema records and controlled inactive Vendor/Product count fixtures were cleaned up. No real Vendor/source/stock records were modified. No known activation blocker remains.

---

## Historical UI review record


Route: `/cpanel/discounts` (authentication + discounts.view; Super User bypass). Navigation roadmap stays disabled while backend is unapproved.

- Search uses base Name, visibility defaults All, Grid/List retains filters.
- Five fictional page-memory records illustrate Hidden/Visible, different priorities, all five Before/After actions, missing start/end dates, future/expired-looking dates and 0–1,284 Products.
- Create contains Name/Priority only. New records stay Hidden. Same-dialog Create → Edit retains a mock ID and unlocks inline Name overrides, Rules and Products.
- Basic Information, Rules and Products are the only tabs. Name reuses the shared inline translation component and active DB language registry. No SEO/Gallery.
- Basic, Name translations and Rules have separate draft baselines/save controls. Closing dirty state asks for discard; switching tabs retains changes. Successful saves explicitly say Saved in preview. Reload resets all fixtures; no browser storage is used for business data.
- Dates may be absent via explicit checkboxes. Basic validates nonblank Name, integer priority and a coherent selected range for UI review. Rules previews adapt amount/percent/fixed labels; Before never edits After. Backend timezone and final pricing validation remain unapproved.
- Product counts are illustrative; Products has no Attach/Detach operations. Future relationship is product_discounts(product_id,discount_id), unique per pair, many-to-many. No products.discount_id, count column or domain table is created.
- Priority winner direction/ties, actual applicability and price calculation remain outside the implementation. The supplied future concept keeps Before/After independent and uses the higher resulting discount; multiple attached Discounts do not imply stacking.
- Existing discounts.create/update/visibility capabilities independently control the preview. No update permission bypasses Visibility. The central registry adds those definitions plus discounts.view with real translations; no automatic grants.

## Files

Controller `src/controllers/cpanel/discounts.ts`, route registration in `src/routes/cpanel/index.ts`, EJS Discounts page/content, module `src/public/cpanel/js/discounts.js`, scoped `discounts.css`. Shared layout only loads these assets for this page. Shell language return mapping/localization allowlist include the route. Existing editor-state and TranslatableField are reused without modifications. Migration 043 contains UI/permission translations only.

## Verification

Targeted browser scenario `tests/discounts.spec.ts` covers search/filter/Grid/List, Create → Edit, locked/unlocked sections, inline translations, priority, nullable dates, five actions, Before/After independence, scope-isolated saves, visibility, Product counts/placeholder, dirty-close warning, reset on reload, read-only and forbidden access, Light/Dark and mobile overflow. It checks no CPanel mutation request is sent.

Fresh-migration integrity and registry checks are selected from existing tests; unrelated Brands/Categories/Media/Vendor/Stock/Users workflows are intentionally not executed. Live localization command: `CHROME_PATH=/usr/bin/google-chrome npm run localization:verify -- --scope=discounts`.

Final results: **6/6 targeted automated tests PASS** (4 selected fresh migration/registry tests, 1 production browser scenario, 1 identical scenario against the running development server). Live scoped localization verifier passes all tm/ru/en database values and language-return behavior. `localization:check`: 478 used UI keys valid; migration 043 applied (506 canonical keys / 1,518 values overall), running cache refreshed. Light/Dark desktop and narrow Rules screenshots reviewed. Final production build and whitespace check pass. No Discount business persistence or mutation request was introduced. No known UI blocker remains; ready for owner review, backend remains deferred.

### Footer placement correction

Basic and Rules Save buttons now share the right-aligned modal footer with Close, following Categories. Each button targets its original form using the HTML `form` attribute; tab switching shows only its corresponding Save. Products shows Close only. Inline translation saves remain unchanged. No duplicate Basic/Rules Save remains in tab content, and validation/drafts/save handlers are unchanged. Focused live-browser verification passed for Basic/Rules/Products, unique buttons, same-row Light/Dark alignment and independent save scopes. Production build and whitespace check passed; no unrelated regression executed.

### Show discount name on product

Basic Information includes optional `isVisibleOnProduct` (false by default in new previews and fixtures), with localized label/help. Basic dirty/save/reopen retain its page-memory value. This is presentation metadata only, independent of availability, priority, dates and Before/After rules. Future persistence: `discounts.is_visible_on_product BOOLEAN NOT NULL DEFAULT FALSE`; not implemented now. Migration 044 supplies two keys/six real tm/ru/en values and is applied to development. The approved footer remains unchanged.

Focused browser check passed: default false, toggle/revert dirty state, Basic Save/reopen, Rules/priority/date values unchanged. No unrelated regression was run.
