# Users management

The approved Users interface is backed by PostgreSQL. See architecture section 34 for the permanent contract; earlier UI reports are historical.

## Routes and authorization

| Route | Permission | Behavior |
| --- | --- | --- |
| GET /cpanel/users | users.view | EJS application page, initial nine real rows |
| GET /cpanel/api/users | users.view | JSON list/search/filter/pagination |
| POST /cpanel/api/users | users.create | Normal user creation |
| PATCH /cpanel/api/users/:id | users.update | Profile/email/avatar edit |
| POST /cpanel/api/users/:id/status | users.status | Activate/deactivate |
| POST /cpanel/api/users/:id/password | users.change_password | Administrator password change |

Every route requires existing CPanel authentication. Mutations require CSRF and JSON. A permitted mutation does not imply users.view or another permission. UI requires users.view to enter the page. Denied authenticated requests return 403; unauthenticated requests follow existing login redirects. Super User bypass grants actor permissions but never bypasses protected-target checks. Each service validates authoritative actor/session/permission/target data.

## Data, search and views

Status belongs only to `cpanel_user_auth.is_active`. List rows expose profile fields, email, active flag and derived protection boolean, never hashes/session/permission maps. Search parameters: query (≤200 chars), field (name/email/phone/job/all), status (active/inactive/all), page (positive bounded integer). Defaults empty query / Name / Active / page 1. ILIKE uses bound values and escapes percent/underscore/backslash as literal search text. Page size nine; deterministic ID order; server returns total/page/pageSize/rows.

Search uses 300 ms debounce and cancellation/sequence checks, with inline loading/failure states. Grid/List share real filtered rows and preserve filters; Grid is the default and localStorage stores presentation only. Reset returns empty/Name/Active. Inactive records retain the approved muted treatment. No mock users or sample toggle remain.

## Mutation rules

Add supports name/phone/job/email/password/confirmation/active choice/optional avatar token. Edit allows name/phone/job/email/optional avatar token only. Password and status are separate operations. Name ≤200 Unicode characters and required; phone ≤50; job ≤200; control characters rejected. Email and password use central rules. Unknown payload fields reject the entire operation, including permission-like fields. New users receive no permissions.

Any target with exact `superuser=true` is protected from Edit/Status/Password and future Delete, irrespective of actor identity. UI shows a protected explanation, never usable mutation controls. A normal user cannot deactivate themselves. Profile self-management remains separate.

Deactivation and admin password changes delete all target sessions atomically; reactivation requires a fresh login. Active auth is rechecked when validating and creating sessions. Permission changes affect the next request; no cross-request permission cache exists.

## Transactions and media

Repository locks actor/target auth rows in numeric ID order, then actor session and target profile. Permission values are checked in the transaction, existing permission rows are share-locked. Future permission-writing services must lock corresponding auth rows before changing authority. PostgreSQL rollback removes partial profile/auth changes.

Add/Edit reuse the Universal Media uploader and Save gate. Browser sends only avatarCacheToken; server finalizes to `users/avatars` with actor ownership. Known rollback removes new promoted file, preserving old media; successful replacement removes old managed file after commit. Lost commit acknowledgement retains potentially referenced files for reconciliation. No filesystem/DB cross-resource atomicity is claimed on process crashes or cleanup failures.

## Localization and tests

Migration 013 adds auth status; 014 adds 11 real tm/ru/en backend keys (33 values). Totals: 190 keys / 570 required-language values / 177 currently used UI keys. Obsolete translation history stays in canonical migrations but no mock data is used at runtime.

Tests cover strict permission independence, UI/direct HTTP/service authorization, target protection, session lifecycle, real search/pagination, mutation rollback, media, race-safe search, translations, themes and responsive behavior. See [activation report](../USERS_ACTIVATION_REPORT.md) for actual execution results.
