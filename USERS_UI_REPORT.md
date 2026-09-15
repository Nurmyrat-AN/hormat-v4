# HORMAT V4 — Users Management UI report

## Implemented scope

**GET /cpanel/users** is authenticated and read-only. **System → Access → Users is enabled** and propagates its active state to Access. Permissions and every other planned module remain disabled. No user-management mutation route or status schema was added.

### Toolbar, search and views

- Page header: localized Users title/subtitle, primary Add User button with the existing SVG icon system; opens a modal.
- Combined field selector + search icon + input + clear button. Default **Name**; options **Name / Email / Phone / Job / All fields**.
- **300 ms debounce**, inline loading/aria-busy state, re-filter on field change, no-users and no-results states.
- **Grid** default and **List** switcher; same data and item template, search remains unchanged when switching.
- Browser preference `hormat.cpanel.users.view` survives reload and handles unavailable localStorage. No preference writes to PostgreSQL.
- Read-only initial sample capped at **60 actual users**; only safe profile data and authentication email selected. Local preview pagination shows nine records per page. Final search/list pagination remains a separately approved server-driven/AJAX backend task.
- Development-only opt-in sample records are explicitly labeled and exist only in browser memory, allowing Grid/List/pagination/inactive-state review with a small real database. Production exposes no sample toggle.

### User items and dialogs

Cards/list rows show avatar/initials, name, email, phone, job, illustrative status and three-dot menu. Desktop list uses User / Email / Phone / Job / Status / Actions columns. Narrow layouts stack without horizontal overflow.

Real rows use an illustrative Active presentation. A localized caption and tooltip explicitly explain that status is an interface example, not actual account access. No status database field or permanent Super User deactivation policy is inferred.

Exactly **four Bootstrap modal instances**, built through one reusable dialog partial:

1. **Add User:** avatar, name, phone, job, email, new password, confirmation, status default Active.
2. **Edit User:** selected user's avatar/name/phone/job/email. No permissions.
3. **Change Status:** selected avatar/name/email, current and proposed status, Activate/Deactivate and Cancel.
4. **Change Password:** selected avatar/name/email, new password and confirmation; no target current password. This is an inactive future administrator operation, separate from live My Profile password changing.

Menus work in both views. Bootstrap owns backdrop/Escape/focus/close behavior. Modal reopening resets form, password visibility, selected upload and notice. Password visibility reuses the established client module. No per-row modal duplication, roles, permission editor or new UI framework.

### Media and non-persistence

Add/Edit reuse the universal MediaUploader EJS/JS and its Save gate: immediate upload, actual progress, preview, retry, removal and waiting for upload. Temporary tokens belong to the authenticated uploader; this UI never finalizes them or writes avatar_url. Abandoned files use existing cache TTL cleanup.

All modal confirmation buttons prevent persistence and show the existing localized **interface preview / changes are not saved** notice. They never report fake successful saving. Passwords are never sent to mutation endpoints or included in GET query strings. No-JavaScript submit controls remain disabled.

## Localization

Migration **011_cpanel_users_ui_translations.sql** adds **32 keys / 96 real tm/ru/en values**. Existing profile field/save/password labels, login password visibility, media labels and previewNotice are reused. No JS/JSON translation dictionaries.

New cpanel.users keys: subtitle, add, edit, search, searchField, allFields, clear, view, grid, list, active, inactive, status, actions, changeStatus, activate, deactivate, currentStatus, newStatus, cancel, close, empty, noResults, loading, user, previewScope, statusPreview, samples, sample, previous, next, page.

Totals: **176 canonical keys / 528 required-language values / 168 used UI keys**. Migration applied to current development DB; running dev cache refreshed via SIGUSR2. Live verification checked actual database labels and Add dialog/cache upload in tm/ru/en. No known untranslated keys.

## Files created/modified

New:

- src/cpanel/users/repository.ts — bounded read-only data sample.
- src/controllers/cpanel/users.ts — safe view model and prepared dialog labels.
- src/views/cpanel/pages/users.ejs, users-content.ejs.
- src/views/cpanel/partials/users/dialog.ejs.
- src/public/cpanel/js/users.js, src/public/cpanel/css/users.css.
- src/database/migrations/011_cpanel_users_ui_translations.sql.
- tests/users.spec.ts, docs/CPANEL_USERS.md, this report.

Updated:

- src/routes/cpanel/index.ts — authenticated Users GET.
- src/cpanel/shell/navigation.ts — Users availability/link.
- src/cpanel/shell/context.ts, src/localization/http.ts — keep language switching on Users.
- src/views/cpanel/layouts/application.ejs — reusable modal header actions and page asset wiring.
- src/public/cpanel/images/shell-icons.svg — plus/list/more symbols in existing framework.
- scripts/verify-localization.ts — live Users verification.
- tests/unit/navigation.test.ts, tests/unit/database.test.ts, tests/navigation.spec.ts, tests/profile.spec.ts, tests/profile-update.spec.ts — updated explicit navigation/localization expectations.
- docs/ARCHITECTURE.md section 32, docs/CPANEL_NAVIGATION.md, docs/LOCALIZATION.md, docs/INTERFACE_TRANSLATIONS.md, README.md.

No dependency changes, no owner .env changes and no new business columns/tables. Existing Profile and Change Password backends remain intact. This workspace has no Git repository metadata; no commit was created.

## Verification executed

- npm run typecheck — passed.
- npm run build — passed; latest EJS/CSS/JS copied into the production build.
- npm run db:migrate — migration 011 applied.
- npm run localization:check — passed; all 168 used keys have real tm/ru/en DB values.
- CHROME_PATH=/usr/bin/google-chrome npm run localization:verify — passed against the actual running port 3000 in tm/ru/en, including Users dialog/upload with no user mutation, previous profile/media lifecycle, password change, authentication and logout.
- `CHROME_PATH=/usr/bin/google-chrome npm test` — **34 unit/integration tests + 47 browser tests passed**.
- `TEST_PRODUCTION=1 CHROME_PATH=/usr/bin/google-chrome npm test` — **34 unit/integration tests + 47 browser tests passed**, exit 0; production build/start verified. The final run includes unique fixture names, dark dialog coverage and tablet checks.

Users tests compare entire cpanel_users, cpanel_user_auth and cpanel_user_permissions tables before/after UI interactions: no new user rows, profile/auth/password/permission changes. They inspect schema for absent status/active columns and confirm management mutation/new/edit routes do not exist. Temporary test accounts are created by the test harness and removed afterward, not by the UI. Temporary cache uploads are allowed.

Checks cover Name default/all selector options, debounce/loading/clear, Grid/List/search retention/preference, every actions dropdown/modal, password toggle/reset, Add/Edit uploader, activation preview, empty data, pagination, blocked storage, language return, light/dark, 768px tablet and 375px mobile.

Screenshots in artifacts/users-*.png and artifacts/users-add-*.png were visually inspected. Mobile field-label wrapping and dark Cancel-button contrast were polished after inspection. Full regressions cover login/logout, sessions/CSRF/Super User/permissions, profile/password, media/cache/finalization, navigation/shell/theme/language, Frontend and Socket.IO.

## Explicit answers

| Question | Answer |
| --- | --- |
| Is default search field Name? | **YES** |
| Can search field change to Email/Phone/Job/All fields? | **YES** |
| Can users switch Grid/List? | **YES** |
| Are all management mutations presented in dialogs? | **YES** |
| Was any user-management mutation backend implemented? | **NO** |
| Was a status database column added? | **NO** |
| Were real tm/ru/en translations added for every new UI string? | **YES** |
| Was System → Access → Users enabled? | **YES** |
| Was Permissions enabled? | **NO** |

- Documentation links — passed.

## Interrupted-run handling

One production runner received SIGTERM after 42 successful browser checks, leaving its test server and one generated Users fixture. The remaining test server was stopped. A subsequent run passed 46/47 browser checks and exposed the leftover fixture as a duplicate search match. Only the confirmed temporary fixture (ID 131, test-only name and UUID@example.invalid identity) was removed. Test display names now include a random suffix to isolate repeat runs. No owner record was changed by this cleanup. Final production results are recorded above.

## Scope limits

This stage intentionally uses bounded local search/pagination and illustrative statuses. Production account-management authorization, status representation, validation/protection rules and mutation workflows are not frozen. No email/job update, administrator password reset, permissions UI or other backend stage was started.

## Review readiness

No known unresolved UI issues. The Users interface is ready for UI review. Search/pagination and management confirmations retain the intentional UI-only limits above. Implementation stops here pending review; no subsequent backend stage was started.
