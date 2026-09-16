# HORMAT V4 — Vendors / CouchDB Suppliers UI

## Scope and access

Implemented UI-first `GET /cpanel/vendors` in the existing authenticated CPanel shell. Open this route directly with `vendors.view` or Super User. **Vendors → Vendors remains disabled** in navigation; Source Products remains disabled and unimplemented.

No Vendor table/schema, CRUD endpoint, repository, supplier API connection or synchronization worker was created. Migration 023 contains only mandatory interface translations.

## Page design

- Search toolbar: Name (default), All Fields, CouchDB URL, Username. Local live search is debounced 300 ms and never includes password/configuration state.
- Separate Active (default), Inactive and All filter.
- Grid and List use one safe dataset. View switching preserves query/field/status; only the Grid/List preference is stored in localStorage.
- Cards show supplier name, ellipsized URL, separate account status and synchronization health, last sync, last operation, lag and secondary sequence.
- Desktop List combines Name/URL and adds Health, Last Sync, Last Operation, Lag, Sequence, Status and Actions. Tablet/mobile use compact cards instead of a wide horizontal table.
- URLs are plain text with full-value tooltips and Details. Presentation strips embedded userinfo/query/fragment. No supplier URL is requested.

## Dialogs

- **Add Vendor:** name, CouchDB URL, username, empty password and initial Active selection.
- **Edit Vendor:** name, URL and username; Configured/Not configured password indicator; empty replacement field with leave-empty guidance. No stored password prefill. Existing password visibility component is reused.
- **Change Status:** current and proposed Active/Inactive with Activate/Deactivate action. Preview does not mutate fixture state.
- **Details:** Supplier, CouchDB connection and Synchronization sections. Full URL, username and opaque sequence remain readable. Mobile labels/values stack to accommodate long translated text.
- Save/status actions show the existing localized preview notice. They send no Vendor request and do not create fake successful persistence. Password input clears on preview/close; it never enters fixture state or browser storage. Input controls have no names that could submit credentials as URL parameters without JavaScript.
- Synchronization fields are read-only presentation, never Add/Edit inputs. No Sync Now or Source Products action.

## Mock suppliers and health

Eight fictional `.example.invalid` suppliers, six active and two inactive:

| Supplier | Account | Mock health | Lag |
| --- | --- | --- | --- |
| Atlas Supply | Active | Up to date | 2 sec |
| Meridian Home | Active | Up to date | 15 sec |
| Balkan Textiles | Active | Behind | 13 min |
| Orbit Electronics | Active | Error | 25 min |
| Nova Foods | Active | Not synced | Unavailable |
| Summit Tools | Active | Behind | 3 min |
| Coast Living | Inactive | Up to date | 0 sec |
| Cedar Office | Inactive | Not synced | Unavailable |

Last Sync and Last Operation use existing Intl date/time presentation, not raw ISO strings or a new Vendor timezone. Lag is derived from fixture timestamps. Health values are explicit mock examples: **no production thresholds are frozen**. Sequence is opaque text; long checkpoint strings remain unchanged and are fully visible in Details/tooltips.

## Credentials and proposed model

Read fixtures/presentation contain **no password value**, only `passwordConfigured`. No real credentials are used. Username and URL are separate. No CouchDB request, `_changes`, `_all_docs`, queue or worker exists. Typed preview passwords remain only in the password control until cleared; no request/log/persistent storage receives them.

Proposed concepts are name; CouchDB URL/username/password; runtime status/last_sequence/date_last_sync/date_last_operation. **Exact database schema, types, health thresholds and timestamp semantics remain NOT FROZEN.** Runtime fields are system-managed. Account status and synchronization health are distinct concepts. Future normal GET reads must never return passwords; credential logging/URL embedding is prohibited.

## Permissions and localization

Registered four unique assignable boolean definitions in the existing Vendors group:

- `vendors.view`
- `vendors.create`
- `vendors.update`
- `vendors.status`

They automatically appear in Permissions Management. View guards the preview route; the other grants control UI preview affordances only. There is no Vendor mutation backend. Existing Super User bypass works without individual rows. No Source Products permissions were added.

Migration `023_vendors_ui_translations.sql` adds **33 semantic keys / 99 actual tm/ru/en values** under `cpanel.vendors.*`, including definition metadata. Generic status/search/view/password/preview labels are reused. Applied to the current development DB; dev localization cache explicitly refreshed with SIGUSR2. Totals: **329 canonical keys / 987 values / 314 used UI keys**. No visible semantic keys are accepted.

## Changed files

- New preview data/presentation: `src/cpanel/vendors/preview.ts`.
- New controller: `src/controllers/cpanel/vendors.ts`; route integration in `src/routes/cpanel/index.ts`.
- Registry: `src/cpanel/permissions/definitions.ts`.
- Shell/localization return path: `src/cpanel/shell/context.ts`, `src/localization/http.ts`.
- Layout asset integration: `src/views/cpanel/layouts/application.ejs`.
- New templates: `src/views/cpanel/pages/vendors.ejs`, `vendors-content.ejs`, `src/views/cpanel/partials/vendors/dialog.ejs`.
- New page assets: `src/public/cpanel/css/vendors.css`, `src/public/cpanel/js/vendors.js`.
- Translation-only migration 023.
- New tests: `tests/vendors.spec.ts`, `tests/unit/vendors-preview.test.ts`.
- Updated registry/localization inventories: `tests/unit/database.test.ts`, `permission-registry.test.ts`, `permissions.test.ts`.
- Live verification: `scripts/verify-localization.ts`.
- Documentation: architecture section 40, `docs/CPANEL_VENDORS.md`, Permissions/localization/inventory docs, README and this report.

Existing uncommitted changes from earlier stages were preserved. No commit/reset or environment-secret changes were made.

## Verification

- `npm run typecheck` and `node --check src/public/cpanel/js/vendors.js`: passed.
- `npm run test:unit`: **68 passed**, including new safe Vendor projection/URL/opaque-sequence tests and definition metadata tests.
- `TEST_PRODUCTION=1 CHROME_PATH=/usr/bin/google-chrome npm test`: **141 passed** — 68 unit/database/service, 68 core browser/HTTP, 5 Users — exit 0. This covers Users, Permissions, Media/Move/cacheToken, Profile, authentication, localization, shell/navigation/theme/language, Frontend and Socket.IO.
- `npm run build`: passed again after the final responsive CSS refinement. Production startup is exercised by the browser runs.
- `npm run localization:check`: passed, 314 used keys have real tm/ru/en values. Fresh-migration integrity and exact seed totals pass in the database suite.
- `CHROME_PATH=/usr/bin/google-chrome npm run localization:verify`: passed against the actual running development server for tm/ru/en, including Vendors, exit 0. No visible keys or credential-bearing read data.
- Browser scenarios verify Name/URL/Username/All search, Active/Inactive/All, initial defaults, filters retained across Grid/List, all health examples, lag and long sequence, empty search, Add/Edit/Status/Details, empty password prefill, show/hide, clear-on-preview and no mutation/network requests.
- Read-only preview permissions, absent POST/API routes, automatic registry rendering, Super User without extra permission rows, disabled Vendors/Source Products and topbar language return route are checked.
- Desktop/tablet/mobile at 1440/768/375 pixels, light/dark, all three languages, both views, plus dialog screenshots are covered. Grid desktop light, List desktop dark and mobile Details were inspected visually; the long Russian Details labels prompted the final mobile stacked-label refinement.
- Final focused production rerun `playwright test tests/vendors.spec.ts --project=core`: **4 passed**, exit 0, on the rebuilt final CSS. Final mobile Edit was also visually inspected.
- `git diff --check`: passed.

The initial focused browser run failed only because its no-form-request assertion included the shell’s expected Socket.IO polling handshake. The assertion now excludes that existing transport while still rejecting supplier requests and form submissions. The complete regression subsequently passed.

## Review boundary

Ready for interface review. No known unresolved UI/test failures. Backend/schema and CouchDB synchronization require a separate task. No Vendor data/password was persisted; no Source Products work was started. Navigation is intentionally disabled. Mock health/lag semantics are presentation proposals only.

## Decisions still required before the backend stage

### Vendor UI review

No known rendering or test failures remain. The owner still needs to review the proposed card/list density, Add/Edit credential flow, separate status dialog and synchronization-health presentation. UI completion does not freeze these choices or authorize backend work.

### Vendor persistence

Freeze exact PostgreSQL structure, types, constraints and ownership for `name`, `url`, `username`, `password`, `is_active`, `last_sequence`, `date_last_sync`, `date_last_operation`. These are proposed concepts, not approved columns. No Vendor schema was created.

### Credential storage

Choose and explicitly approve a protected, reversible at-rest storage design for the supplier credential. Plaintext storage must not be assumed. One-way login-password hashing cannot supply the original credential for a future CouchDB connection. Application-level authenticated encryption with a server-held key is one candidate, not an approved implementation. Key management/rotation and credential access rules also need approval. No encryption or credential-storage backend was implemented here.

### Synchronization status and health

Decide whether synchronization `status` is persisted runtime state, derived state or a combination. Define the Up to date → Behind thresholds and which timestamp/runtime signals drive them. Freeze the meaning of last successful processing versus latest known source operation, including missing/error states. Current mock examples establish none of these backend rules.

### CouchDB sequence

Inspect the actual supplier CouchDB `_changes` behavior/data before choosing the storage type and checkpoint semantics for `last_sequence`. Keep it opaque meanwhile. No supplier connection or `_changes` request was performed in this task.

## Explicit final confirmations

| Question | Answer |
| --- | --- |
| Is the Vendors Management UI complete for review? | **YES** |
| Does it support both Grid and List views? | **YES** |
| Does switching Grid/List preserve current search/filter state? | **YES** |
| Is the default search field Name? | **YES** |
| Can UI search by Name, URL, Username and All Fields? | **YES** |
| Is password excluded from search? | **YES** |
| Are Vendor Active/Inactive status and synchronization health separate concepts? | **YES** |
| Is the default Vendor status filter Active? | **YES** |
| Does the UI display Last Sync? | **YES** |
| Does the UI display Last Operation? | **YES** |
| Does the UI display synchronization Lag? | **YES** |
| Does the UI display Last Sequence? | **YES** |
| Is last_sequence opaque rather than assumed to be a normal integer? | **YES** |
| Are Up to date, Behind, Not synced and Error supported in the UI? | **YES** |
| Were exact lag/health thresholds permanently frozen? | **NO** |
| Does any normal Vendor list/details response expose the actual CouchDB password? | **NO** |
| Does HTML/client JavaScript contain the existing Vendor password? | **NO** |
| Does Edit Vendor pre-fill the existing password? | **NO** |
| Can the UI represent password configuration without knowing the password? | **YES** |
| Was a Vendor PostgreSQL table created? | **NO** |
| Was a CouchDB synchronization worker implemented? | **NO** |
| Does this task connect to actual supplier CouchDB databases? | **NO** |
| Were Source Products implemented? | **NO** |
| Were vendors.view/create/update/status registered? | **YES** |
| Did they automatically appear in Permissions Management through the registry? | **YES** |
| Were Source Products permissions created? | **NO** |
| Does every new Vendor UI string have real tm/ru/en database translations? | **YES** |
| Are semantic translation keys visibly rendered in normal Vendor UI? | **NO** |
| Was Vendors → Vendors enabled during this UI-only stage? | **NO** |

## Reporting continuation

The continuation request adds reporting and preserves next-stage decisions only. No implementation, schema, encryption, CouchDB connection, synchronization, retry or Source Products work was started. Runtime results above are from the completed UI stage; runtime tests were not rerun for this documentation-only continuation. Documentation completeness and whitespace were checked.

**STOP: wait for explicit UI review and Vendor backend architecture approval.**
