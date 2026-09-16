# Marketplace Settings

## Source of truth

- Default Language: `languages.is_default`.
- Default Payment Type: `payment_types.is_default`.
- Default Delivery Type: `delivery_types.is_default`.
- Default Order Status: `order_statuses.is_default`.
- Default Frontend Currency: `settings["marketplace.default_frontend_currency_id"]`.

Only the currency default is a Settings key. No mirrored language/payment/delivery/order-status settings, new currency columns or duplicate domain records exist.

## Schema and typed service

Migration 060 creates one `settings` table: `key text PRIMARY KEY`, `value jsonb NOT NULL`, `type text NOT NULL`, `updated_by bigint NULL REFERENCES cpanel_users(id) ON DELETE SET NULL`, and `created_at`/`updated_at timestamptz NOT NULL DEFAULT now()`. The existing timestamp trigger maintains updated_at. Type checks support string/integer/decimal/boolean/json and reject mismatched JSON shapes.

`src/settings/typed.ts` exposes server-only get/set and typed getters. Definitions are development-owned; the only production definition currently registered is the currency ID (integer). Unknown keys/types and invalid values are rejected. Integer and decimal values are represented as exact JSON strings; integer getters return bigint, decimal getters return strings. Safe integer numbers or canonical integer strings/bigints may be supplied; decimals require plain decimal strings. Boolean conversion is strict. JSON requires JSON-compatible values; no undefined/nonfinite values. No browser interface for adding/deleting/renaming keys exists.

Settings are read directly from PostgreSQL without an application cache. Missing currency returns null, displayed as Not configured. No automatic currency selection or rate fallback is introduced. Once configured, currency cannot be cleared through this page; choose another visible currency instead. Future storefront consumers must explicitly handle null; Product behavior is not implemented here.

## Atomic defaults

`MarketplaceDefaultsService` authorizes the authenticated session under settings.update inside one transaction. It composes the existing transaction-aware Language service and Payment/Delivery/Order Status service defaults logic, plus typed currency validation. Stable transaction locks serialize composite saves with domain writes. Invalid selections or database failures roll back all five scopes.

The active Language selection retains exactly-one/default-active and full-interface-translation completeness rules. Payment/Delivery selects visible records with base names, or No default; Order Status selects visible records with a current-interface-language Name override or base Name fallback, or No default; each remains independently optional. Currency selects existing visible frontend currencies. Domain selection lists are not constrained by separate domain-view permissions: settings.view grants access to these approved reference options. settings.update authorizes these default changes without requiring domain mutation permissions; all domain safety invariants still apply.

Currency management takes the same currency-default lock before its row lock and rejects hiding the configured currency with a localized explanation. Select a replacement in Settings first. This is the explicit owner-authorized addition to the completed currency module; no other currency business rule changes.

Language cache invalidation/reload happens only after successful commit using the existing mechanism. Cache refresh failure is reported as pending, never as a false rollback; invalidation allows the next request to retry. Currency values have no stale cache and require no restart.

## UI and HTTP

- GET `/cpanel/settings`: settings.view, existing shell, one Marketplace Defaults card.
- PUT `/cpanel/api/settings/defaults`: settings.update, CSRF, bounded JSON; exact fields `{language, currency, payment, delivery, orderStatus}`. IDs are strings; optional unset selections are null.
- System → Settings is enabled independently of authorization and exposed only with effective settings.view.
- Save is dirty-state aware, prevents duplicates, retains selections after failure and warns before leaving unsaved changes. Read-only users can inspect disabled controls.

Normal staff require exact boolean grants; Super User retains the existing bypass. New definitions are assignable settings.view/settings.update; no create/delete definitions.

Comparable configuration modules have no approved audit-event infrastructure. This stage records existing staff attribution (`settings.updated_by`, option-type attribution) without inventing an audit domain. Before/after default history remains future audit work.

Migration 061 adds 16 keys/48 real tm/ru/en values; canonical total 642 keys/1,926 values/61 migrations, with 601 current UI keys. Applied to development DB and live cache refreshed. UI language switching preserves Settings route.

## Targeted verification

17 tests pass: 7 isolated Settings/schema/type/default/security tests; 9 selected fresh migration, localization registry, Language-default, permission-registry and navigation checks; 1 production browser workflow on a separate PostgreSQL schema. Tests cover failed-save rollback, optional set/change/clear, hidden/missing currency rejection, concurrent hide/save protection, cache refresh, independent permissions, CSRF, persistence reload, themes and mobile overflow. Live tm/ru/en verification and build also pass.

No full historical Languages/Payments/Delivery/Currencies/Catalog regression was run: only the reused defaults and directly changed safety/localization/navigation integrations were exercised.

Additional Settings sections, Products and checkout remain deferred.

## Default Order Status extension

Order Status now participates in the same transaction through the existing OptionTypesService.applyDefault and module lock. Hidden/nonexistent statuses reject the whole save; clearing is allowed. No Order Status Settings key exists. Migration 064 adds only the tm/ru/en label. Other defaults are preserved when only this selector changes.
