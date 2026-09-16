# Currency Configuration

## Current UI and behavior

Marketplace → Currencies contains Frontend Currencies and Vendor Currencies. Both remain Grid/List with persistent browser view preferences and search/filter preservation. Data comes from PostgreSQL; page-memory fixtures and preview success states have been removed.

Frontend has base Name with inline registry-language overrides, Code, Symbol, nullable Rate, Sort Order and independent Visibility. Create starts Hidden, keeps the dialog open and returns the real ID into Edit. Blank rate stores NULL; other values are positive decimal strings. Basic and translations save independently. Blank overrides are removed and fall back to base Name. Close/Save Basic Information share the footer.

Vendor Currencies lists all synchronized currencies through paginated LEFT JOIN, 50 rows/page; query searches the literal composed `VendorName.CurrencyName`. No Vendor selector, Add, visibility, translations or Delete. The normal Edit dialog shows read-only identity and edits only Rate. Clearing Rate deletes its configuration, not the source currency. Close/Save Rate share the footer. New data is loaded on Edit; successful saves refresh lists, failures preserve drafts.

## Exact schema — migration 049

- `frontend_currencies`: id bigint GENERATED ALWAYS AS IDENTITY PK; name/code/symbol text NOT NULL, trimmed nonempty 1–200 characters; rate NUMERIC NULL (no default), CHECK >0 and finite; is_visible BOOLEAN NOT NULL DEFAULT false; sort_order INTEGER NOT NULL DEFAULT 0; created_by/updated_by nullable bigint FK cpanel_users(id) ON DELETE SET NULL; created_at/updated_at timestamptz NOT NULL DEFAULT now(). Existing cpanel_touch_updated_at trigger. Index(sort_order,id). Names/codes are not globally unique: no such business rule was approved.
- `frontend_currency_translations`: frontend_currency_id bigint NOT NULL FK frontend_currencies(id) ON DELETE RESTRICT; language_code text NOT NULL FK languages(code); trimmed name text NOT NULL 1–200 characters; composite PK(frontend_currency_id,language_code); created_at/updated_at timestamptz NOT NULL DEFAULT now(); standard update trigger. Service accepts active registry languages only; omitted language values are retained.
- `vendor_currency_rates`: vendor_id bigint NOT NULL; currency_id bigint PK; rate NUMERIC NOT NULL CHECK >0 and finite; updated_by nullable bigint FK cpanel_users(id) ON DELETE SET NULL; created_at/updated_at timestamptz NOT NULL DEFAULT now(); standard update trigger. Composite FK(vendor_id,currency_id) references existing currencies(vendor_id,id) ON DELETE RESTRICT. One explicit rate per source currency. Clearing removes the row. No extra source catalog or source schema change.

## API and authorization

Base `/cpanel/api/currencies`, authenticated; mutations require existing CSRF and bounded JSON. Existing Super User bypass applies. Service rechecks current authority/session inside transaction; permission revocations apply on the next request. Unknown fields are rejected and actor IDs come from session.

| Method/path | Contract | Permission |
| --- | --- | --- |
| GET /frontend | query, visibility(all/visible/hidden), page; 50 rows/page | currencies.frontend.view |
| GET /frontend/:id | current fields and active name overrides | currencies.frontend.view |
| POST /frontend | name, code, symbol; optional rate (null default), sort_order (0 default); Hidden | currencies.frontend.create |
| PATCH /frontend/:id | changed name/code/symbol/rate/sort_order and/or is_visible only | update for content; visibility independently for is_visible |
| PUT /frontend/:id/translations | `{translations:{languageCode:name}}`; whitespace removes override | currencies.frontend.update |
| GET /vendors | query and page; all-source LEFT JOIN | currencies.vendor_rates.view |
| GET /vendors/:vendor/:id | current composed identity/source id/rate | currencies.vendor_rates.view |
| PUT /vendors/:vendor/:id | `{rate:decimalStringOrNull}` only | currencies.vendor_rates.update |

Successful responses contain `{success:true,row}` or list data and pagination. Create returns 201. Stable CURRENCY_* failures expose no SQL/internal details. Ownership is enforced by fresh DB lookup and composite FK, even for crafted requests. No Delete endpoint. Current source IDs/name/data are never updated.

## Central conversion contract

`convertPrice(sourcePrice, vendorRate, frontendRate)` in `src/currencies/conversion.ts` performs PostgreSQL NUMERIC multiplication/division and returns a decimal string. Missing/null rates have effective value 1 **only inside this calculation**. It does not read Product data, write any settings or create configuration rows.

`12 * 20 / 15 = 16`.

Stored NULL → Not configured → effective 1. Stored 1 → visibly configured 1 → effective 1. No JavaScript Number monetary math. PostgreSQL determines numeric division scale; repeating fractions are finite decimal approximations under that policy. No rounding to currency minor units or Product price integration is introduced.

## Localization, scope and verification

Migration 050 adds saved/fallback-help in tm/ru/en; other labels reuse existing PostgreSQL keys. Migration 049 creates only the three approved tables. Catalog, durable Vendor Sync, stock, Users and Profile internals are untouched. No audit domain is invented; comparable content-module attribution is used.

Targeted checks: currency service/schema/conversion tests, production Currency browser persistence/permissions/CSRF tests, relevant fresh migration/localization integrity, permission registry/navigation, live tm/ru/en verification and build. Full historical domain suites are intentionally excluded under risk-based scope.

Deferred: Product pricing integration, storefront currency selector, Product UI and Delete.

### Activation verification results

- **27/27 tests PASS**: six `tests/unit/currencies.test.ts` tests; nineteen existing tests across `tests/unit/database.test.ts`, `tests/unit/permission-registry.test.ts`, `tests/unit/navigation.test.ts`; two production-browser scenarios in `tests/currencies.spec.ts`.
- Browser scenarios verify real Create → Edit, independent Name translations/Basic saves, persistent rate/visibility after reload, Grid/List/search/filter, Vendor composed search/rate save/clear, untouched synchronized fixture records, ownership rejection, CSRF, independent permission boundaries and retry after failed authorization. Light/Dark and mobile screenshots reviewed.
- `npm run localization:check`: PASS, 517 used keys. Fresh migrations: 550 canonical keys / 1,650 tm/ru/en values / 50 migrations. Migrations 049–050 applied to development DB; running localization cache refreshed. Scoped live verification passed both pages and language-return routes in tm/ru/en.
- `npm run build`: PASS. `git diff --check`: PASS. No Catalog/Vendor Sync/Stock/Users/Profile full regression: their code/schema and shared infrastructure were unchanged. Disposable test data was cleaned up.
- No known outstanding activation issues. Product integration, storefront selector and Product UI remain deferred.
