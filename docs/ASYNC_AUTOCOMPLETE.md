# Shared AsyncAutocomplete

CPanel server entity selectors should use the shared asynchronous single-select component, rather than downloading entire tables into native selects. Static enums remain native selects. Existing modules migrate when next touched; no mass migration. Upcoming Product Source Product/Brand/Category/Discount selectors must reuse this foundation.

## Component

`src/public/cpanel/js/content/async-autocomplete.js`, shared EJS partial `partials/content/async-autocomplete.ejs`, and `async-autocomplete.css` provide:

- Small first page on open, 300 ms debounced server search, explicit Load more.
- AbortController plus generation checks, including selected-ID hydration, to ignore stale responses.
- Text-only generic option rendering: `{value: string, label: string, secondaryText?: string, metadata?: unknown}`. IDs never come from parsing labels or preview URLs.
- `fetchPage({query,page,signal}) -> {options,hasMore,nextPage}` and `hydrate(value,signal) -> option|null` callbacks. `onChange` commits a selection/clear; `onHydrate` reports its restored display identity without changing form state.
- Required, clearable, disabled, readOnly and placeholder options. Required selections cannot be cleared by the clear button. Consuming forms must validate committed `value`, not typed search text, before submission; server validation remains mandatory.
- Localized loading/search/empty/error/retry/clear/more; failed hydration remains explicit and retryable rather than displaying a raw ID.
- Combobox/listbox semantics, arrows, Enter, Escape, focus/outside close. Escape/uncommitted search restores the last committed label.

All labels come from PostgreSQL-backed EJS `t()`. Include the shared stylesheet when using the component. `destroy()` cancels outstanding work when disposing its DOM.

## Source Products integration

Vendor, Currency and Measure reuse the component. Static status/stock/connection selectors remain native. Vendor changes clear dependent Currency/Measure IDs. URL restoration hydrates each selection, including back/forward navigation.

GET `/cpanel/api/source-products/options` is an explicit, read-only workflow endpoint requiring `source_products.view`. It allows only `kind=vendor|currency|measure`, `query`, `page`, optional `vendor`, and optional `selected`. It uses fixed table mappings, parameterized literal substring search, deterministic name/ID ordering and 20 rows plus a lookahead. `hasMore`/`nextPage` drive paging. `selected` performs an exact ID lookup (zero/one result), respecting the reference Vendor scope. No credential fields are selected. No unrestricted table API exists.

The Vendor bug was in client selection: native datalist display text was parsed for a `(#ID)` suffix; ordinary name input only fetched suggestions and left the previous or empty filter committed. Explicit option selection now sends its stable ID. Existing query validation and SQL `source_products.vendor_id` filtering remain authoritative, combined with name/stock/other filters using AND.

Grid/List share restrained active/inactive, stock and storefront-connection badges. Real negative stock remains displayed; no source values or Product relationships change.

Migration 070 adds six autocomplete interface keys, each with tm/ru/en values. Existing status translations are reused. No business schema or mutation route changes.

## Targeted verification

- Five PostgreSQL Source Products/lookup tests: Vendor A/B/clear, name/stock/advanced AND combinations, actual negative stock, lookup pages/hydration/allowlist/authorization.
- Two fresh-migration localization checks: 70 migrations, 753 canonical keys / 2259 required-language values; 710 current UI keys covered.
- Four production-browser cases: source browsing regression, permission boundaries, actual Vendor selection/filter/status/hydration/clear and light/dark presentation, generic autocomplete debounce/stale/paging/keyboard/error/retry/required/read-only behavior.
- Live development tm/ru/en values and existing topbar language switching checked; migration applied and localization cache refreshed. TypeScript/production build checked.

Unrelated Catalog, Vendor Sync, Stock, Users, Profile and historical domain suites intentionally not run: changes are confined to read-only Source Products lookups/presentation, an opt-in component and localization seed additions.
