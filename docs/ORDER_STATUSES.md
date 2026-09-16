# Order Statuses

Order Statuses is a configuration reference module, using the shared Payment/Delivery Types repository, service, API factory, controller, EJS, CSS and browser module. Its fixed server-selected kind is `order-status`; browser input cannot select SQL tables. Existing Payment/Delivery schemas and behavior are unchanged.

## Schema and behavior

Migration 062 creates `order_statuses` and `order_status_translations` with the Payment Types conventions: bigint identity ID; required trimmed base name (1–200); description text default empty (max 4,000); nullable canonical text icon_media_reference; integer sort_order default 0; is_visible/is_default booleans default false; nullable created_by/updated_by staff FKs; standard created_at/updated_at timestamptz and update trigger.

Translations have order_status_id FK (delete restricted), language_code FK, nullable trimmed name/description overrides, composite primary key and timestamps. At least one override must exist. Empty overrides are removed; active languages come from the registry; base fields remain fallbacks.

Partial unique Default index allows zero or one. A CHECK prevents hidden Default. The shared transaction serializes module writers with advisory lock (4840,6), clears the preceding Default and sets the new one visible. Explicit clearing is allowed; Default is independent of sort_order. Normal update permission covers choosing Default and its implicit visibility; explicit visibility requires visibility permission, matching Payment Types.

Icon uses existing Media Picker, canonical relative reference validation and image eligibility. Selection requires media.view; clearing unlinks only. No Gallery, Media copy or physical deletion.

## Routes and UI

- `/cpanel/order-statuses`: authenticated view, shared Grid/List, base Name/Description search, visibility filtering, sort_order/id order.
- `/cpanel/api/order-statuses`: GET list, POST create.
- `/cpanel/api/order-statuses/:id`: GET detail, PATCH basic.
- `/cpanel/api/order-statuses/:id/translations`: PUT independent field overrides.

All writes require CSRF, current session and exact effective permissions. Registered assignable permissions: order_statuses.view/create/update/visibility. Existing Super User bypass applies. No delete permission/API.

Create returns real ID without closing the dialog, unlocks inline translations and Icon. Footer keeps Close and Save together. Menu enabled at the existing Marketplace → Order Statuses location under order_statuses.view. Orders itself stays disabled.

## Localization and verification

Migration 063 adds four semantic interface keys with 12 real tm/ru/en values, applied to development DB. Existing common labels are reused. Canonical totals: 646 keys / 1,938 values / 63 migrations; 605 used UI keys. Existing cache refreshed and all three shared pages verified live in tm/ru/en.

10 targeted tests passed: 3 isolated Order Statuses schema/service/security tests; 1 production browser Create/Edit/reload/Media/translations/Grid/List/default/CSRF scenario; 6 selected fresh-migration, permission registry and navigation checks. Light/Dark inspected. Build and localization integrity pass. No full Payment Types or unrelated historical domain suites were run; shared rendered pages received scoped localization smoke.

## Permanent boundary

Future Orders may use this optional Default as initial status_id. Order Statuses carries no operational meaning: no is_final/is_closed/is_error/is_cancelled, workflow, transitions, notification/payment/delivery rules or inferred behavior. Such operational state belongs to the future Order domain. No Delete, Orders or Products implemented here. Settings has not acquired another default selector in this task.
