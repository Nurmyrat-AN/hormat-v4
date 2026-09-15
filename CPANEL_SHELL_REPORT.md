# HORMAT V4 — Main CPanel shell foundation report

## Scope and result

Implemented the reusable authenticated CPanel application shell only. The approved login/authentication layout remains separate. No Users, Permissions, Products, dashboard analytics, notifications, settings or other business module was created. No new routes, dependencies or business-schema changes were introduced.

## Layout architecture and files

The authenticated `/cpanel` pipeline now includes `src/cpanel/shell/context.ts`. This middleware reuses the existing authenticated user and localization locals to prepare safe profile display data, navigation and current-route context. There is no repeated user lookup in page controllers or credential query for the topbar.

New EJS files:

- `src/views/cpanel/layouts/application.ejs`: sidebar + topbar + page header/actions + content + footer, skip link, common assets.
- `src/views/cpanel/pages/home-content.ejs`: localized welcome and a foundation-ready placeholder; no invented marketplace statistics.
- `src/views/cpanel/partials/shell/sidebar.ejs`.
- `src/views/cpanel/partials/shell/navigation-item.ejs` (recursive).
- `src/views/cpanel/partials/shell/topbar.ejs`.
- `src/views/cpanel/partials/shell/theme-switcher.ejs`.
- `src/views/cpanel/partials/shell/language-selector.ejs`.
- `src/views/cpanel/partials/shell/user-menu.ejs`.
- `src/views/cpanel/partials/shell/icon.ejs`.

`pages/index.ejs` now composes the application layout with prepared title/subtitle and a trusted content partial. Optional actions are supported without requiring them on every page. `partials/head.ejs` includes early preferences only when the application layout explicitly requests it. The login page does not load shell CSS/JS.

New browser assets:

- `src/public/cpanel/css/shell.css`: application-scoped surfaces, navigation, controls, responsive behavior and light/dark variables.
- `src/public/cpanel/js/shell/preferences.js`: validated initial state before styles load, guarded localStorage access.
- `src/public/cpanel/js/shell/theme.js`: theme action/accessibility label synchronization.
- `src/public/cpanel/js/shell/sidebar.js`: sidebar/pin/preview state, generic Bootstrap submenu integration, mobile behavior, language form enhancement and avatar-error fallback.
- `src/public/cpanel/images/shell-icons.svg`: local SVG symbols using the established icon approach.

## Sidebar, navigation and persistence

Desktop >= 992 px uses a fixed 264 px expanded sidebar or 80 px collapsed icon rail. Main content resizes accordingly; no expanded-width blank gap remains when collapsed. Icon-only entries retain translated title tooltips and accessible names.

Pinned holds the selected state. Unpinned collapsed navigation temporarily expands on pointer hover or keyboard focus, overlaying content without moving its 80 px base margin. Leaving pointer/focus or pressing Escape closes the preview. Pinning a visible preview retains it as expanded. Unpinning an expanded sidebar does not unexpectedly collapse it.

Navigation is a small presentation configuration of groups/items with IDs, prepared translated labels, icons, hrefs, children and active state. A regular Overview anchor and one explicitly labelled interface example demonstrate normal navigation, groups, nested active child/parent and a disabled example with no route. No future marketplace navigation is invented. Route context opens/highlights the active child and parent centrally.

Generic submenu controls use Bootstrap Collapse with synchronized `aria-expanded`/`aria-controls`. Clicking a submenu in a pinned icon rail first expands the sidebar. No per-module submenu scripts exist.

Preferences use only:

- `hormat.cpanel.theme`: light/dark.
- `hormat.cpanel.sidebar`: expanded/collapsed.
- `hormat.cpanel.pinned`: true/false.

Temporary previews are not saved. Storage-disabled environments keep working with defaults and in-page controls. No PostgreSQL preference fields or APIs were added.

## Topbar, themes, language and user

The topbar contains sidebar control, workspace context, theme toggle, dynamic language selector and authenticated user dropdown. Theme is applied by a blocking head script before stylesheets; tests verify the saved dark mode is already active when the first stylesheet is present. Custom CSS variables design the light/dark backgrounds, borders, text, active navigation, hover states and dropdowns; Bootstrap color modes support standard future surfaces and controls. Theme never changes the login layout.

Language options reuse the active-language registry and existing cookie-based `POST /language`, returning to `/cpanel`. The user menu renders actual authenticated name and optional job; it uses a safe avatar URL/path or initials. Invalid/broken avatars fall back without exposing credentials. No avatar upload/profile editing/Media integration was introduced.

Logout remains the existing CSRF-protected `POST /cpanel/logout`; no second session mechanism exists. `/cpanel` stays protected and the Socket.IO connection remains unchanged with no invented events or notifications.

## Responsive behavior

Below 992 px the sidebar is Bootstrap offcanvas with backdrop and focus trap. The content occupies the full viewport when closed. Menu control, outside click, Escape and navigation dismissal work without hover. Dismissal returns focus to the menu control. Desktop preferences do not impose a mobile margin. Mobile topbar hides secondary name/context text while retaining theme/language/user controls.

Screenshots were generated and visually inspected for desktop light/dark and mobile overlay. The test suite also captures tablet/content variants and tm/ru/en dark-mode pages under `artifacts/`:

- [Desktop light](artifacts/shell-desktop-light.png)
- [Desktop dark with user dropdown](artifacts/shell-desktop-dark-user.png)
- [Mobile menu](artifacts/shell-375-menu.png)
- [Mobile content](artifacts/shell-375-content.png)
- [Tablet menu](artifacts/shell-768-menu.png)
- [Tablet content](artifacts/shell-768-content.png)

These contain temporary test-profile display data only.

## Localization and database changes

Applied `005_cpanel_shell_translations.sql`: **22 keys / 66 real tm/ru/en values**, all under `cpanel.shell`:

`mainGroup`, `overview`, `demoGroup`, `layoutPreview`, `foundation`, `demoUnavailable`, `skipContent`, `workspace`, `ready`, `subtitle`, `welcome`, `welcomeDescription`, `foundationNote`, `closeMenu`, `navigation`, `pin`, `unpin`, `personalWorkspace`, `toggleMenu`, `darkMode`, `lightMode`, `userMenu`.

Existing brand, language-selector and logout keys are reused. Total canonical seeds: 62 keys / 186 values; 60 keys currently used. The actual development server cache was refreshed after migration. The live verifier now checks every shell translation, including hidden dropdown text, title tooltips and accessible/data attributes.

Only seed data and the migration ledger changed. No profile/auth/permission/session schema or business rules changed.

## Other updated files

`src/routes/cpanel/index.ts`; existing `tests/auth.spec.ts`, `tests/localization.spec.ts`, `tests/unit/database.test.ts`; new `tests/shell.spec.ts`; `scripts/verify-localization.ts`; `README.md`, `AGENTS.md`, `docs/ARCHITECTURE.md` (new section 26), `docs/CPANEL_SHELL.md`, `docs/LOCALIZATION.md`, `docs/INTERFACE_TRANSLATIONS.md`; this report.

The existing tests were adapted only for intentional shell behavior: logout is in the user dropdown, title assertions target the level-one heading, and seed totals include the new migration. Authentication, permissions, login visuals, Frontend and Socket.IO checks remain.

## Verification results

| Command/check actually executed | Exact result |
| --- | --- |
| Baseline `CHROME_PATH=/usr/bin/google-chrome npm test` before shell changes | 20 Node + 26 browser tests passed |
| `npm run typecheck` | Exit 0 |
| `npm run build` after final implementation | Exit 0; compiled code, EJS, migration and assets copied |
| `npm run db:migrate` | Applied 005 successfully |
| `npm run localization:check` | Passed: all 60 used keys have real tm/ru/en database values |
| `CHROME_PATH=/usr/bin/google-chrome npm test -- tests/shell.spec.ts` | 20 Node + 5 focused shell browser tests passed |
| Final `CHROME_PATH=/usr/bin/google-chrome npm test` | 20/20 Node + 31/31 browser tests passed (browser suite 58.1 s) |
| `TEST_PRODUCTION=1 CHROME_PATH=/usr/bin/google-chrome npm test` | 20/20 Node + 31/31 browser tests passed (browser suite 54.9 s); compiled production server started successfully |
| `CHROME_PATH=/usr/bin/google-chrome npm run localization:verify` | Passed against actual :3000 server: 9 route/language checks, language switching, authenticated shell values/attributes, invalid login, CSRF rejection and logout in tm/ru/en |
| Documentation link check | Passed |
| Screenshot review | Desktop light/dark user menu and mobile offcanvas visually inspected |

No known failures remain. Expected oversized-request tests log sanitized error names; the existing test-runner color-environment warning remains harmless.

An early shell test found duplicate submenu toggling caused by combining Bootstrap's delegated toggle with rail expansion; the final code uses one generic handler and Bootstrap's API. Mobile tests now wait for the completed offcanvas state before testing Escape, and focus restoration is explicit. Focused shell checks passed after these fixes.

## Review readiness / unresolved issues

Ready for review. No unresolved implementation issues, new business modules or deferred translation work. The disabled interface example is intentional and temporary, for shell review only. The shell uses only the existing three language-return destinations; new real pages must deliberately extend that allowlist. All extension conventions and permanent decisions are recorded in [CPANEL_SHELL.md](docs/CPANEL_SHELL.md) and architecture section 26.

Stop after shell review; do not start another module automatically.
