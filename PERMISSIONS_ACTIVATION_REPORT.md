# HORMAT V4 — Permissions Management activation

## Result and scope

The approved Permissions UI now saves real assignments. After a successful full activation regression, **System → Access → Permissions** was enabled. Visibility requires effective `permissions.view`; availability remains separate from authorization.

This report covers the activation request and its continuation, sections 1–77. The continuation adds registry validation, strict payload checks and complete real administrator lifecycle coverage while preserving the approved UI and assignment schema.

## Routes and independent authorization

| Route | Requirement |
| --- | --- |
| GET /cpanel/permissions | Existing authentication + permissions.view |
| GET /cpanel/permissions/:userId | Existing authentication + permissions.view |
| POST /cpanel/api/permissions/:userId | Existing authentication + permissions.update + X-CSRF-Token |

The separate JSON API follows the existing Users convention. Existing GET pages retain the approved shell/UI. Authenticated permission denials return 403, not login redirects. Missing/invalid target IDs return 404.

| Actor | View list/detail | Update another normal user |
| --- | --- | --- |
| Exact Super User | Yes | Yes |
| permissions.view only | Yes, read-only | No |
| permissions.update only | No | Yes via API |
| Both grants | Yes | Yes |
| Neither / false / invalid values | No | No |

No implication from update to view. No extra individual permission rows were added to Super Users. `permissions.update` means managing assignable registered permissions for **other normal users**; it never grants Super User and does not override target/self protection.

## Target protection

- Exact `superuser=true` is protected, irrespective of name/job/ID or actor authority.
- The list retains Super User / Full access, without an edit action. Editable detail and mutation requests against Super User return 403, including from another Super User.
- `superuser` is registered as a **non-assignable system definition**, never a switch.
- Normal administrators may view themselves with permissions.view, but their form is read-only and self-update is denied server-side.
- A different authorized administrator can manage that normal user.
- Inactive normal targets can retain and receive permissions; saving does not change their account status.

## Registry and persistence

One centralized definition source drives grouping, names, value types, assignability, allowed payload keys and boolean grant counts.

| Key | Group | Type | Assignable |
| --- | --- | --- | --- |
| users.view | Users | boolean | Yes |
| users.create | Users | boolean | Yes |
| users.update | Users | boolean | Yes |
| users.status | Users | boolean | Yes |
| users.change_password | Users | boolean | Yes |
| permissions.view | Permissions | boolean | Yes |
| permissions.update | Permissions | boolean | Yes |
| superuser | System | boolean | **No** |

Registry startup validation rejects duplicate permission keys/groups and invalid/missing module, type, assignability or localization metadata. Authorization inventory tests cover current semantic literals and dynamic Users operation dispatch.

The API accepts exactly `{permissions: {...}}`, containing all seven assignable keys with actual JSON boolean values. Missing keys, arbitrary/unknown/system keys, unexpected structures or body/query fields, target overrides and non-boolean values are rejected. Target identity comes from the validated route parameter and authoritative lookup. Payloads must be UTF-8 JSON within 16 KB. Duplicate object keys, including Unicode-escaped aliases, are rejected before parsing can overwrite them; malformed/unexpected bodies return localized 400, oversized bodies 413.

- **ON:** upsert JSONB true.
- **OFF:** delete that managed row; missing means deny.
- Legacy false/invalid values normalize to true or absence on successful Save.
- Non-managed/unknown/system rows are preserved, including a non-true superuser row. A true Super User target rejects the whole operation.
- Existing true rows need not be rewritten; existing timestamp triggers apply to changed rows.

`cpanel_user_permissions` remains unchanged structurally. No roles or permission-registry DB table was created.

## Atomicity and concurrency

The service validates the complete desired state. The repository begins a transaction, locks actor/target auth rows in ascending ID order, revalidates actor active status and current unexpired session, re-reads permissions, verifies target protection and denies self-edit. It then deletes OFF rows and upserts ON rows, committing them together.

This follows the existing Users/login/profile auth-before-session lock protocol. Concurrent saves serialize; latest successful Save wins. Future trusted system permission writers must coordinate using the same target auth-row lock. There is no speculative optimistic-locking subsystem.

Database errors roll back the whole synchronization. Tests forced a failure after OFF deletions, both in an isolated schema and through the real HTTP/browser UI. No partial changes remained. The browser fault trigger was uniquely named, limited to a disposable target and removed in finally cleanup.

A lost COMMIT acknowledgement yields an error rather than an unverified success; an idempotent full-state retry reconciles the desired state. No claim of guaranteed rollback is made for an unknown commit outcome.

## UI behavior

The existing cards/search/filter/pagination and separate detail page remain. Detail now naturally shows Users and Permissions groups from the registry. Read-only/self-edit explanations are localized; switches and Save are disabled where appropriate.

Save is disabled when clean; changing switches enables it for permitted actors. During Save, controls are disabled and a localized saving label appears. Duplicate submissions are blocked. Success displays a real localized confirmation, updates original state and clears dirty state without reloading the shell. Failure retains selections and dirty state; ordinary failures permit retry. Authorization/protection/not-found responses disable further editing until refresh. Cancel discards unsaved local changes.

Mock preview text was removed from this page. No raw keys are primary UI labels; key metadata is used only to construct the registry-defined request.

## Immediate permission refresh and navigation

PermissionContext is request-local; the next request reloads assignments from PostgreSQL. No session deletion or logout/login is needed for permission changes.

Tests used the same logged-in target session to revoke and restore users.view and permissions.view. The corresponding routes immediately denied/restored access, and navigation reflected the changed grants.

Permissions is now enabled at `/cpanel/permissions`, filtered by permissions.view (with the existing Super User bypass). The item remains active on its detail pages. An empty Access submenu is omitted when neither child is permitted. Other roadmap items and shell collapse/pin/mobile behavior are preserved.

## Localization

Migration **016_cpanel_permissions_activation_translations.sql** adds seven keys with **21 real tm/ru/en values**:

- cpanel.permissions.access.view
- cpanel.permissions.access.update
- cpanel.permissions.selfEdit
- cpanel.permissions.readOnly
- cpanel.permissions.saving
- cpanel.permissions.saveFailed
- cpanel.permissions.saved

Existing forbidden/invalid/not-found/protected/Save/Cancel/search strings were reused. Canonical totals: **210 keys / 630 translations**; source inventory: **197 used UI keys**.

The development database was migrated and its running localization cache refreshed. Live verification exercises real persisted grants and translated self/read-only screens on the actual dev server. No JSON/JavaScript language dictionaries or visible semantic keys were introduced.

## Frozen future-module rule and audit

Architecture section 36 freezes the requirement that every module task introducing a permission must add its key/module/type/assignability/translation metadata, actual tm/ru/en values, backend authorization and tests in the same task. The existing application registry is authoritative for management definitions; no future catalog reconstruction is needed.

No audit/system-event infrastructure exists. Permission-change audit history remains a documented future requirement. No Audit module/table, roles, templates, copying, bulk assignment or hypothetical business permissions were added.

## Files changed

### Created

- src/cpanel/permissions/validate-definitions.ts
- src/cpanel/permissions/json.ts
- tests/unit/permission-registry.test.ts
- tests/permission-lifecycle.spec.ts
- src/cpanel/permissions/errors.ts
- src/cpanel/permissions/repository.ts
- src/cpanel/permissions/service.ts
- src/controllers/cpanel/permissions-api.ts
- src/routes/cpanel/permissions-api.ts
- src/database/migrations/016_cpanel_permissions_activation_translations.sql
- tests/unit/permissions.test.ts
- PERMISSIONS_ACTIVATION_REPORT.md

### Updated

- src/cpanel/permissions/definitions.ts
- src/controllers/cpanel/permissions.ts
- src/routes/cpanel/index.ts
- src/cpanel/shell/context.ts
- src/cpanel/shell/navigation.ts
- src/views/cpanel/pages/permission-detail-content.ejs
- src/public/cpanel/js/permissions.js
- src/public/cpanel/css/permissions.css
- scripts/verify-localization.ts
- tests/permissions.spec.ts
- tests/navigation.spec.ts
- tests/users.spec.ts (enabled-navigation expectation only)
- tests/unit/navigation.test.ts
- tests/unit/database.test.ts
- docs/ARCHITECTURE.md
- docs/CPANEL_PERMISSIONS.md
- docs/CPANEL_NAVIGATION.md
- docs/LOCALIZATION.md
- docs/INTERFACE_TRANSLATIONS.md
- README.md

The existing permission service, Users enforcement, authentication/session implementation and assignment schema were preserved.

## Initial activation verification (before the continuation)

| Check actually executed | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run db:migrate` | PASS; migration 016 applied to current development DB |
| Focused `node --import tsx --test tests/unit/permissions.test.ts` | 7 passed |
| Initial Permissions browser run | 5 passed |
| `npm run localization:check` | PASS; 197 keys with real tm/ru/en values |
| Full development `CHROME_PATH=/usr/bin/google-chrome npm test` before enabling navigation | 47 unit/integration + 48 core browser + 5 Users browser passed; exit 0 |
| Focused enabled navigation + Permissions browser run | 6 passed, including actual DB failure/rollback through UI |
| Final `npm run build` | PASS |
| Full final `TEST_PRODUCTION=1 CHROME_PATH=/usr/bin/google-chrome npm test` | **48 unit/integration + 48 core browser + 5 Users browser passed; exit 0; no skips** |
| Final `localization:verify` on actual port 3000 | PASS in tm/ru/en, including saved rows and self/read-only messages |
| Documentation links | PASS |
| Cleanup verification | Zero remaining permission-test fault triggers |

The final production suite starts the compiled application through `npm start` and covers login, authentication, Super User, permissions, Users, profile/password/media, localization/fresh migrations, shell/sidebar/pin/theme, navigation, language switching, Frontend and Socket.IO.

Logs: `/tmp/permissions-activation-before-enable.log`, `/tmp/permissions-activation-enabled-browser.log`, `/tmp/permissions-activation-production.log`, `/tmp/permissions-activation-localization-final.log`.

Coverage includes strict independent permissions; bootstrap bypass without extra grants; view-only/update-only actors; read-only self display; self mutation denial; Super User target protection; system/unknown/target/type injections; ON/OFF and normalization; preservation of non-managed rows; complete rollback; concurrent revalidation; same-session grant/revocation; CSRF; duplicate prevention; save failure/retry; all three languages; both themes; desktop/mobile; navigation and existing Users operations.

Representative screenshots were inspected after resetting scroll/focus for stable captures. The approved layout remains readable at 375, 768 and 1440 px. Test fixtures and temporary fault-injection objects were cleaned up.

## Final continuation verification (sections 48–77)

| Check actually executed | Result |
| --- | --- |
| Focused lifecycle/count/inactive browser tests | 2 passed |
| `npm run typecheck` | PASS |
| `npm run localization:check` | PASS; 197 UI keys with real tm/ru/en values |
| `npm run build` | PASS |
| Full development `CHROME_PATH=/usr/bin/google-chrome npm test` | **52 unit/integration + 50 core browser + 5 Users browser = 107 passed; exit 0; no skips** |
| Full production `TEST_PRODUCTION=1 CHROME_PATH=/usr/bin/google-chrome npm test` | **52 unit/integration + 50 core browser + 5 Users browser = 107 passed; exit 0; no skips** |
| Live `localization:verify` on actual port 3000 | PASS tm/ru/en, including real Permissions saves and read-only/self-edit states |
| Documentation links | PASS |

Logs: `/tmp/permissions-continuation-development.log`, `/tmp/permissions-continuation-build.log`, `/tmp/permissions-continuation-localization.log`. Production log: `/tmp/permissions-continuation-production.log`. The production suite started the compiled application through `npm start` and verified authorized list/detail rendering, real database Save, assets, localization and navigation, together with the complete existing regression suite.


- Registry checks reject duplicate definitions, duplicate groups, missing or invalid metadata, and editable/missing Super User. All eight current definitions are boolean. Authorization inventory checks all current keys and Users operation dispatch.
- Every assignable key and Super User is tested against true, false, null, strings "true"/"false", numbers 1/0, objects, arrays and absence. Only JSON boolean true grants.
- Real UI/API lifecycle starts with an unprivileged administrator; Super User grants Users view/create; the administrator searches and creates a user while edit/status/password remain forbidden. Permissions view grants read-only inspection; update grants management of another normal user.
- Crafted self-edit, Super User, unknown-key, arbitrary-value and target-override attacks fail with assignment snapshots unchanged. Missing/invalid CSRF and anonymous requests cannot mutate assignments.
- Same-session revocation immediately removes both route access and usable navigation. Deleted targets return safe 404 without orphan rows.
- Counts exclude missing/false/null/string/number/object/array and unmanaged values. Super User displays Full access. Real deactivation/reactivation preserves assignments; inactive users remain inspectable, searchable with All/Inactive and visually muted.
- Malformed, duplicate (including escaped aliases), missing, array/object and oversized request bodies are rejected. Existing transaction-failure tests prove complete rollback and successful retry.
- No new continuation translation keys were needed: existing localized invalid-request responses are reused. The activation's seven new keys retain all 21 real tm/ru/en database values.

## Explicit confirmations

- Is `System → Access → Permissions` now enabled? **YES**
- Does navigation still require effective `permissions.view` for normal users? **YES**
- Can a normal user assign `superuser=true`? **NO**
- Can Super User be modified through Permissions Management? **NO**
- Can a normal administrator edit their own permissions? **NO**
- Can an authorized administrator edit another normal user's assignable permissions? **YES**
- Does ON store JSONB boolean `true`? **YES**
- Does OFF remove the boolean permission row? **YES**
- Does missing permission mean DENY? **YES**
- Are unknown permission keys rejected/not persisted? **YES**
- Are permission changes transactional? **YES**
- Do permission changes affect subsequent authorization without indefinite stale access? **YES**
- Was a permission-registry DB table created? **NO**
- Does the centralized application Permission Definition Registry remain authoritative for manageable permission definitions? **YES**
- Do all new visible strings have real tm/ru/en database translations? **YES**
- Did the full regression suite pass? **YES**

No known unresolved functional or UI issue. Audit history remains future work by explicit scope. No roles, templates, inheritance or additional business module was introduced. Stop after this activation stage.
