# HORMAT V4 — Current User Profile UI report

## Result

Implemented authenticated **GET /cpanel/profile**, accessed through **My Profile** in the existing topbar user dropdown. Logout remains a separate CSRF-protected action. The page uses the approved shell; the sidebar roadmap is unchanged and System → Access → Users remains disabled.

## Layout and provisional editability

One compact card contains exactly two Bootstrap tabs:

1. **Basic Information** (default): actual avatar/initials, name/job summary, name, phone, job and email inputs, Change Photo and Save Changes.
2. **Change Password**: Current Password, New Password, Confirm New Password, three independent visibility toggles and Change Password.

Name, phone and email appear editable. Job is read-only with muted styling. **This is provisional UI behavior, not a frozen business or authorization decision.** No new password policy is claimed.

Avatar display uses the existing sanitized shell URL and fallback initials. Existing/broken/missing image behavior is verified. Change Photo is an interface preview action only; no file picker, upload or Media records are created.

## Data and client behavior

The controller uses current authenticated profile data. The existing auth repository adds a parameterized read-only email query scoped to that current user. The view model contains name, phone, job and email; no password hash, session token or permission internals are added to profile data.

Profile-specific JS is isolated in `profile.js`. Bootstrap tab state supports `#basic` / `#password`, refresh and back navigation. The password visibility interaction was extracted from login into a shared client file, preserving its behavior and localized labels.

Save Changes, Change Password and Change Photo reveal a neutral localized notice: this is an interface preview and changes are not saved. No fake success, fetch or mutation is performed. Accessible form groups use buttons of type button and no actual submission forms or field names. Without JavaScript actions stay disabled. No profile/password values are put into browser storage or URLs; refresh restores the database values.

The existing language handler adds only `/cpanel/profile` to its explicit safe redirect destinations. Switching language stays on the profile and uses the same cookie/cache system. No special profile language state exists.

## Localization

Migration **007_cpanel_profile_translations.sql** adds **15 keys / 45 real tm/ru/en values**:

- `cpanel.profile.title`, `.subtitle`
- `cpanel.profile.tabs.basic`, `.tabs.password`
- `cpanel.profile.fields.name`, `.phone`, `.job`, `.email`
- `cpanel.profile.avatar.change`, `.actions.save`
- `cpanel.profile.password.current`, `.new`, `.confirm`
- `cpanel.profile.previewNotice`
- `cpanel.userMenu.profile`

Reused `cpanel.login.showPassword`, `cpanel.login.hidePassword` and existing shell labels. Canonical values are in migration 007 and listed in [INTERFACE_TRANSLATIONS.md](docs/INTERFACE_TRANSLATIONS.md#profile-ui-additions). The current development database was migrated and its running :3000 process cache refreshed. All **113 used UI keys** have actual required-language values; total seed inventory is **120 keys / 360 values**. No JSON/JS translation dictionary was created.

## Files created/modified

Created:

- `src/controllers/cpanel/profile.ts`
- `src/views/cpanel/pages/profile.ejs`, `profile-content.ejs`
- `src/public/cpanel/css/profile.css`
- `src/public/cpanel/js/profile.js`, `password-visibility.js`
- `src/database/migrations/007_cpanel_profile_translations.sql`
- `tests/profile.spec.ts`
- `docs/CPANEL_PROFILE.md`, this report

Modified:

- `src/routes/cpanel/index.ts`: authenticated GET route only.
- `src/cpanel/auth/repository.ts`: current-user email SELECT only.
- `src/cpanel/shell/context.ts`, `src/localization/http.ts`: safe profile language return destination.
- `src/views/cpanel/partials/shell/user-menu.ejs`: My Profile link.
- `src/views/cpanel/layouts/application.ejs`: profile-only asset inclusion.
- `src/views/cpanel/pages/login.ejs`, `src/public/cpanel/js/login.js`: shared password visibility reuse.
- `scripts/verify-localization.ts`, `tests/unit/database.test.ts`: live profile verification and fresh-migration inventory.
- `docs/ARCHITECTURE.md` section 28, `docs/LOCALIZATION.md`, `docs/INTERFACE_TRANSLATIONS.md`, `README.md`.

No dependency, business schema, profile-update route or password-update route was added. Navigation configuration was not changed.

## Verification results

- `npm run db:migrate`: migration 007 applied successfully.
- `npm run typecheck`: passed, exit 0.
- `npm run build`: passed, exit 0; production TypeScript/assets/views/migrations generated.
- `npm run localization:check`: passed, all 113 used keys have real tm/ru/en values.
- `CHROME_PATH=/usr/bin/google-chrome npm run localization:verify`: passed on actual :3000 server, including all profile labels and current-user email in tm/ru/en, existing login/shell/Frontend and language/authentication checks.
- `CHROME_PATH=/usr/bin/google-chrome npm test`: **22/22 unit/server + 34/34 browser tests passed**, including all pre-existing regression tests.
- `TEST_PRODUCTION=1 CHROME_PATH=/usr/bin/google-chrome npm test`: **22/22 unit/server + 34/34 browser tests passed**, with the compiled application launched through `npm start`.
- Profile tests passed: auth protection; menu link; actual current values; two tabs; read-only job; every password show/hide toggle; hash refresh/back behavior; light/dark in all three languages; 375/768px layouts without horizontal overflow; no-JS actions disabled; absent POST/PATCH route returns 404; ordinary user with no permissions can view their own profile; valid/broken avatar handling; logout.
- Database safety: exact before/after comparison of the temporary user's full profile and authentication rows passed. Profile fields, authentication email and password hash were unchanged by UI interactions and attempted requests. Network monitoring observed no profile mutation request from UI actions. Test setup only changes random temporary fixture accounts; the harness deletes those accounts afterward.
- Visually reviewed English light Basic Information, Russian dark Change Password and mobile dark screenshots. Forms, active tabs, avatar fallback and controls were readable; no observed horizontal overflow.

Screenshots: `artifacts/profile-{tm,ru,en}-{light,dark}-{basic,password}.png`, `artifacts/profile-mobile-{375,768}.png`.

## Architecture and scope answers

Section 28 records account-menu access and exactly two tabs, with UI-only scope and explicitly unfrozen editability. Backend update authorization and persistence remain a separate task after UI approval.

**Did this task implement profile or password database mutation? No.**

**Was System → Access → Users enabled because of this page? No.**

Unresolved UI issues: none observed. Documentation links passed validation. The UI is ready for review; work stops here. No backend stage has been started.
