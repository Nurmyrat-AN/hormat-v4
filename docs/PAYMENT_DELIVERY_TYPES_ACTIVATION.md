# Payment Types and Delivery Types activation

Supersedes the UI-only stage. PostgreSQL is authoritative; Create returns a real ID and retains the dialog. Grid/List use the same parameterized Name/Description search, visibility filter, pagination and sort_order/id ordering. There is no Delete.

## Persistence and API

Migration 057 creates only payment_types, payment_type_translations, delivery_types and delivery_type_translations. Main records use bigint identity IDs, text name/description, nullable text icon_media_reference, integer sort_order default 0, booleans is_visible/is_default default false, nullable created_by/updated_by staff FKs and timestamptz creation/update timestamps. Delivery adds is_free default true and nonnegative finite NUMERIC price default 0; free requires zero. Translation rows have a composite entity/language-code PK, actual language FK, nullable name/description overrides, timestamps and at least one non-null override. Entity deletion is restricted by translation FKs. No globally unique names or currency fields.

Page routes remain /cpanel/payment-types and /cpanel/delivery-types. Separate authenticated /cpanel/api/payment-types and /cpanel/api/delivery-types routers provide GET list/detail, POST create, PATCH /:id basic and PUT /:id/translations with {field, values}. Mutations require CSRF and authoritative transaction-time permissions. Browser-controlled unknown/server-managed fields are rejected. Services validate; repositories own parameterized SQL and transactions. Staff attribution follows comparable modules; no new audit domain is introduced.

Base Name/Description are independent fallbacks. Per-field translation saves trim empty values to absent overrides and preserve the other field and omitted/inactive languages. Basic saves never overwrite translation drafts. Media references reuse canonical root-relative paths and existing Media safety/image validation; selecting new files requires media.view. Missing images have safe placeholders. Clearing never deletes files.

## Default and visibility

Each module independently permits zero or one Default, enforced by partial unique index. A check constraint prevents hidden Defaults. Transaction-scoped per-module advisory locks serialize writes: choosing a Default clears its predecessor and makes the selected record visible atomically. Ordinary update permission authorizes this complete Default operation, including implicit visibility. Explicit visibility changes separately require visibility permission. Clearing Default is allowed; hiding a remaining Default is rejected. Create is always hidden and nondefault, independent of sort order.

Free Delivery normalizes price to 0; paid Delivery accepts nonnegative exact decimal strings persisted as NUMERIC. Units are internal main-currency units. No exchange conversion, fees engine or checkout is implemented.

Future checkout must select visible records, order by sort_order then id, and preselect the independently configured Default when one exists. It must tolerate no Default. This is a future integration contract only.

## Verification

13 isolated server tests cover both domains, persistence, translations, Media safety, independent permissions, defaults/concurrency/rollback, malicious payloads and decimal prices. Two production browser scenarios cover real Create/Edit, reload, translations, Icon, Default, paid/free delivery, CSRF and read-only behavior. Two fresh-migration/localization tests and two targeted navigation tests cover integration. Unrelated historical suites were intentionally not rerun: no Vendor/Stock/Users/Profile/Media-core behavior changed.

Migration 058 adds five keys with real tm/ru/en values. Development migrations applied; live localization cache refreshed and all three languages checked. Canonical source: 624 keys, 1,872 values, 58 migrations; 583 current UI keys pass integrity. Build passes.

Deferred: Delete, checkout/payment execution, Settings and Products.
