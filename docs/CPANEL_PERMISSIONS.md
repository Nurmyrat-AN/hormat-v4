# Permissions Management

## Authorization and navigation

- `GET /cpanel/permissions`: existing authentication + `permissions.view`.
- `GET /cpanel/permissions/:userId`: same view permission; protected Super User targets return 403.
- `POST /cpanel/api/permissions/:userId`: existing authentication + **independent** `permissions.update`, `X-CSRF-Token`, bounded JSON and account-based save rate limiting.

Exact boolean `superuser=true` grants both action permissions without individual rows. A normal update-only actor can use the update endpoint but cannot view pages. A view-only actor may inspect normal-user details with disabled switches/Save. Normal users may view their own assignments but cannot edit them. Super User targets cannot be edited even by a Super User actor. Authenticated denial is 403; missing/invalid target is 404.

The Permissions roadmap item is now enabled after the activation regression passed, and is filtered by effective permissions.view. An empty Access submenu is omitted when neither Users nor Permissions is allowed. Users visibility remains independently users.view. A committed grant/revocation affects the target's next request using the same session; no logout/login or cross-request permission cache invalidation is needed.

## Approved UI

Real cards show avatar fallback/name/job/email/auth status and known boolean grant count. Search covers name/email/phone/job, defaults Active and supports All/Inactive. Existing Users query and card styling are reused: escaped parameterized ILIKE, nine results/page, bounded input, deterministic ID order. Live GET search uses a 300 ms debounce and ignores stale responses. Errors preserve current results and give a localized retry instruction.

Normal-user detail shows vertical groups **Users**, **Permissions** and **Media** with twelve switches. Super User stays Full access with no edit action. Inactive normal users remain inspectable/manageable; status never removes grants. Internal keys are form metadata, not administrator-facing labels.

Save becomes available when a permitted actor changes a switch. During Save all switches and the button are disabled, a saving label is shown and duplicate submissions are blocked. Success refreshes the form's original state, clears dirty state and shows translated confirmation without reloading the shell. Failure preserves selections for retry. A 403/404 freezes editing until a fresh page load. Cancel/Back discards local changes. No preview/no-persistence message remains.

## Registry and full-form synchronization

[definitions.ts](../src/cpanel/permissions/definitions.ts) is the single metadata and management allowlist, not assignment storage:

| Definition | Group | Type | Assignable |
| --- | --- | --- | --- |
| users.view | Users | boolean | Yes |
| users.create | Users | boolean | Yes |
| users.update | Users | boolean | Yes |
| users.status | Users | boolean | Yes |
| users.change_password | Users | boolean | Yes |
| permissions.view | Permissions | boolean | Yes |
| permissions.update | Permissions | boolean | Yes |
| media.view | Media | boolean | Yes |
| media.upload | Media | boolean | Yes |
| media.create_folder | Media | boolean | Yes |
| media.rename | Media | boolean | Yes |
| media.delete | Media | boolean | Yes |
| superuser | System | boolean | **No** |

Startup validation rejects duplicate keys/groups and invalid or missing definition metadata. Tests check authorization key consistency, including dynamic Users operation dispatch.

The system definition is excluded from editor groups/counts. Missing/false/non-boolean values display OFF; only exact JSON true displays ON. The universal JSONB assignment store is unchanged.

The API accepts bounded UTF-8 JSON only and rejects duplicate object keys, including Unicode-escaped aliases, before parsing. Invalid bodies return localized 400 responses; oversized bodies return 413.

The API expects exactly `permissions`, an object containing **every currently assignable boolean key** with an actual JSON true/false value. A stale form missing newly introduced keys is rejected, rather than silently deleting new grants. Extra/system/unknown keys, wrong types, arrays, body target IDs and extra query parameters are rejected.

ON upserts true. OFF deletes that managed row, normalizing legacy false/invalid values. Full synchronization never deletes unknown/non-managed rows, including a false/non-boolean system row. `permissions.update` never allows assignment/removal of superuser. Root's bootstrap/system authority remains separate.

## Transaction and immediate effect

[service.ts](../src/cpanel/permissions/service.ts) validates the full form. [repository.ts](../src/cpanel/permissions/repository.ts) locks actor/target auth rows in ID order, validates actor active status/session and current permission, checks target protection/self-edit, then deletes OFF rows and upserts ON rows in one transaction. It shares the lock protocol already used by Users/login/profile. Concurrent valid saves serialize; latest successful state wins.

Failures roll back every statement. If COMMIT acknowledgement is lost, the client sees failure rather than an unverified success; retrying the full form is idempotent. No filesystem or profile/auth mutations participate. Existing row timestamp triggers remain in use; unchanged true rows avoid unnecessary updates.

PermissionContext is recreated for each HTTP request. Removing users.view or permissions.view denies the corresponding page and hides its usable navigation on subsequent requests. Granting it again restores access using the same session.

## Frozen extension rule and audit scope

A future module's task must register key/module/type/assignability, provide all tm/ru/en translations, enforce authorization and add permission tests at introduction time. No later manual reconstruction of the catalog. Future non-boolean editors/validators require their actual module's approved implementation; no hypothetical editors are included now.

No audit/system-event infrastructure currently exists. Permission-change history remains a future requirement. No roles, permission registry table, templates, copying or bulk assignment was added.

## Localization and verification

Migration 016 adds seven keys / 21 real tm/ru/en values. Current totals after Media activation migration 019: 284 keys / 852 translations; 268 used UI keys. Database seed and running-server cache must be updated together. `localization:verify` exercises real saves and self/read-only messages on the actual server.

Tests include isolated-schema service/transaction checks, registry validation, the strict boolean matrix for every current definition, real administrator grant/revocation lifecycle, inactive-user preservation, effective grant counts, malformed/deleted-target checks and browser coverage for all languages, saved rows, readonly/self/target protection, CSRF, unknown/system injections, immediate grant/revoke behavior, failure/retry, duplicate prevention, search, themes and mobile. Run the full [README verification workflow](../README.md) and existing Users authorization suite.

Media UI adds five registered assignable booleans. Only media.view currently protects read-only manager access; its four mutation definitions do not activate endpoints. The registry-driven complete Save contract now contains twelve assignable keys. See [Media UI](CPANEL_MEDIA.md).
