# HORMAT V4 — Permissions Management UI

## Scope and review access

Implemented the requested UI-first Permissions module. Open **`/cpanel/permissions`** directly as Super User. Both new GET routes require existing CPanel authentication and exact boolean Super User authority, as explicitly chosen by the owner during this task. The sidebar roadmap entry stays **disabled**.

### 1. Main page

Real user cards show avatar/initials, name, job, email, actual active/inactive status and permission summary. Live search covers name/email/phone/job, with Active as default and All/Inactive options. Reuses existing Users repository search and card styling, with nine results per page; no copied Users management dialogs. GET search has a 300 ms debounce, stale-response cancellation, reset, loading/empty/error states and pagination. Search also works as an ordinary GET form without JavaScript.

### 2. Detail page

`GET /cpanel/permissions/:userId` shows the selected normal user's safe identity and vertically grouped permission switches. There is a Back link, Cancel and Save Changes. No matrix or modal-based permission editor.

### 3. Real data and protection

Identity/status comes from existing profile/auth tables. Existing assignments are read from `cpanel_user_permissions`. Safe prepared presentation values reach EJS; no hashes, sessions, raw permission JSON or assignment maps are passed into the new content views. Existing shell authentication/logout remains unchanged.

Exact `superuser=true` shows the existing Super User badge plus localized Full access and an immutable-account explanation. No edit action exists. Direct detail access to any Super User target returns 403, even for itself. Invalid/missing targets return 404. Inactive normal users remain inspectable; their grants are not removed.

### 4. Central definition registry

`src/cpanel/permissions/definitions.ts` defines presentation metadata: module, key, expected value type and semantic name translation key. Current group **Users** contains:

| Internal key | English UI label |
| --- | --- |
| users.view | View users |
| users.create | Create users |
| users.update | Edit users |
| users.status | Activate / deactivate users |
| users.change_password | Change user password |

No hypothetical permissions are registered. `superuser` is a protected special status, not an assignable control. The metadata type can describe future boolean/integer/decimal/string/JSON definitions, but only current boolean switches are implemented. This is not assignment storage, not a DB registry, and does not replace the existing authorization service.

### 5. Assignment rendering and unsaved state

Exact JSON boolean true is ON; false, missing and invalid non-boolean values are OFF. Numeric summaries count only granted explicit known boolean permissions. Super User receives Full access rather than a number.

Save starts disabled, enables when a switch differs from its initial state and displays a localized preview/no-persistence notice. Save sends **no HTTP mutation request** and does not claim success. Reverting switches disables Save again. Cancel/Back returns to the list and discards changes; reopening reads authoritative values again. Browser test snapshots confirm assignments remain identical before/after opening, toggling, Save and Cancel.

## Localization

Migration `015_cpanel_permissions_ui_translations.sql` adds **13 semantic keys / 39 real tm/ru/en values**:

- cpanel.permissions.subtitle
- cpanel.permissions.fullAccess
- cpanel.permissions.protected
- cpanel.permissions.grantedCount
- cpanel.permissions.edit
- cpanel.permissions.back
- cpanel.permissions.unsaved
- cpanel.permissions.loadFailed
- cpanel.permissions.users.view
- cpanel.permissions.users.create
- cpanel.permissions.users.update
- cpanel.permissions.users.status
- cpanel.permissions.users.password

Reused existing navigation Users/Permissions/Search; Users search/status/pagination/Cancel/Super User; profile Save and preview-notice translations. No language dictionaries or visible hardcoded labels were added. Current canonical totals: **203 keys / 609 translations**; source inventory: **191 used UI keys**.

The development DB was migrated and the actual running dev-server translation cache reloaded. `localization:verify` confirmed actual tm/ru/en values on both new pages and preserved existing localization flows. The shared topbar language selector retains the detail route. No visible semantic keys were found.

## Files

### Created

- src/cpanel/permissions/definitions.ts
- src/cpanel/permissions/read.ts
- src/controllers/cpanel/permissions.ts
- src/views/cpanel/pages/permissions.ejs
- src/views/cpanel/pages/permissions-content.ejs
- src/views/cpanel/pages/permission-detail.ejs
- src/views/cpanel/pages/permission-detail-content.ejs
- src/views/cpanel/partials/permissions/identity.ejs
- src/public/cpanel/css/permissions.css
- src/public/cpanel/js/permissions.js
- src/database/migrations/015_cpanel_permissions_ui_translations.sql
- tests/permissions.spec.ts
- docs/CPANEL_PERMISSIONS.md
- PERMISSIONS_UI_REPORT.md

### Modified

- src/routes/cpanel/index.ts — two protected GET routes.
- src/cpanel/shell/context.ts and src/localization/http.ts — safe language return destinations for the new screens.
- src/views/cpanel/layouts/application.ejs — page-specific asset inclusion.
- scripts/verify-localization.ts — actual running-server Permissions checks and unchanged assignments.
- tests/unit/database.test.ts — current migration/translation inventory totals.
- tests/navigation.spec.ts — remove the obsolete expectation that the now-authorized Permissions UI route must return 404; preserve disabled navigation assertions.
- docs/ARCHITECTURE.md — section 35: access decision, UI-only boundaries and proposed metadata registry rule.
- docs/LOCALIZATION.md, docs/INTERFACE_TRANSLATIONS.md, README.md — current module and localization documentation.

Existing Users mutation code, permission service, assignment schema and navigation configuration were not changed.

## Verification

| Executed check | Final result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run db:migrate` | PASS; migration 015 applied to current development DB |
| `npm run localization:check` | PASS; 191 used keys have real tm/ru/en values |
| `CHROME_PATH=/usr/bin/google-chrome npm run localization:verify` | PASS against actual port 3000; all three languages and unchanged test assignments |
| Focused Permissions browser run | PASS; initial three language scenarios |
| Final `CHROME_PATH=/usr/bin/google-chrome npm test` | PASS; 40 unit/integration + 47 core browser + 5 Users browser tests; exit 0 |
| `npm run build` | PASS; final production assets and TypeScript compiled |
| Final `TEST_PRODUCTION=1 CHROME_PATH=/usr/bin/google-chrome npm test` | PASS; same 40 + 47 + 5 tests, with compiled server started by `npm start`; exit 0 |
| Documentation links | PASS |

The complete regression covers login, authentication/session security, Super User, existing permissions, localization/fresh migrations, shell/sidebar/pin/theme, roadmap, language switching, profile/password/media, Users, Frontend and Socket.IO. No final failures or skipped tests. Detailed final run logs: `/tmp/hormat-permissions-dev-tests.log` and `/tmp/hormat-permissions-production-tests.log`.

The new browser tests cover all three languages, strict boolean rendering, real search across identity fields, Active/All/Inactive, pagination, literal search characters, stale responses, error/retry, broken-avatar fallback, no persistence, Cancel/reopen, direct target protection, actor access/revocation, no mutation endpoint, theme and responsive checks. Screenshots were generated; representative desktop and mobile light/dark images were inspected. Widths checked: 375, 768 and 1440 px.

The first full development run found one obsolete navigation test expecting `/cpanel/permissions` to be 404. That expectation was updated for the explicitly requested GET route; sidebar-disabled checks remain intact.

## Architecture questions and scope

No known unresolved UI defect. The application metadata registry remains proposed and subject to review before backend activation/freezing. Permission mutation rules and any future non-Super-User management access await a separate task. No permission writes, roles, DB registry, templates, copying, bulk assignment or hypothetical modules were implemented.

### Required answers

- Is Super User editable from Permissions Management? **NO.**
- Are permissions grouped by module? **YES.**
- Are raw permission keys shown as the primary administrator UI? **NO.**
- Are existing assignments read from `cpanel_user_permissions`? **YES.**
- Does opening/changing the UI mutate permission rows? **NO.**
- Was a permission registry DATABASE table created? **NO.**
- Does the application now have a centralized permission-definition registry for UI metadata? **YES.**
- Does every new visible string have real tm/ru/en DB translations? **YES.**
- Was the Permissions roadmap item enabled? **NO.**

Stop at UI review. No permission mutation backend has been activated.
