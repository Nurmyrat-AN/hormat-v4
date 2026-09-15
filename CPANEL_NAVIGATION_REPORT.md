# HORMAT V4 — Permanent CPanel navigation roadmap report

## Result and hierarchy

Configured the approved roadmap in the existing shell. There are **nine groups, 30 disabled planned pages, three structural submenu controls and one enabled foundation page**. `/cpanel` remains the foundation/home and is not presented as a completed Dashboard.

| Group | Entries |
| --- | --- |
| Overview | Panel foundation (**enabled**, `/cpanel`); Dashboard (disabled) |
| Catalog | Products; Categories; Brands; Media; Discounts |
| Vendors | Vendors; Source Products |
| Sales | Orders; Customers; Shopping → Carts, Favorites; Reviews |
| Communication | Live Chat; Notifications |
| Content | Custom Pages; Groups |
| Marketplace | Delivery Types; Payment Types; Order Statuses; Restrictions |
| Search & Analytics | Search; Search Synonyms; Analytics |
| System | Access → Users, Permissions; Localization → Languages, Interface Translations; Settings; System Events |

Every planned page in this table is disabled. Shopping, Access and Localization are expandable containers only, without page links. The former temporary demo menu was replaced.

## Configuration and disabled behavior

New `src/cpanel/shell/navigation.ts` stores key-only navigation metadata: stable `id`, `translationKey`, SVG `icon`, page `status` and optional `href`, or structural submenu `children`. Groups have IDs/translation keys/items. `context.ts` prepares labels from the existing request-bound localization translator and route context.

Availability (`enabled` / `disabled`) means implemented and ready, not permission. It is not stored in `cpanel_user_permissions`. Existing authentication and permission logic is unchanged. Super Users do not make unfinished features available.

The preparation function suppresses a disabled href even if a future URL is configured. EJS only emits anchors for enabled pages. Disabled entries are readable, muted, focusable non-anchor spans with `role=link`, `aria-disabled=true`, no href and no navigation handler. Click/Enter/Space cannot open a business page. Their native translated tooltip and accessible label include “Not available yet”; no large badges or `href="#"` are used.

## Shell behavior and icons

The existing recursive component and generic Bootstrap Collapse handling serve Shopping, Access and Localization. Parent controls are available to inspect planned children, not to open unimplemented modules. Active state applies only to enabled matching pages and propagates through nested parents; a synthetic unit fixture verifies this without adding any route.

Expanded/collapsed widths and pin/unpin remain unchanged. The icon rail retains labels through translated tooltips and accessible names. The larger menu uses an independently scrolling navigation region; brand and pin areas do not shrink. Mobile keeps offcanvas/backdrop/Escape behavior and can scroll to System Events at the bottom. Dark/light disabled text remains readable; disabled icons are subdued and do not acquire an enabled hover highlight.

The existing SVG symbol system was extended, without another icon framework. Assignments include dashboard/grid, product box, category grid, brand tag, image, discount percent, vendor store, source import, orders receipt, users, cart, heart, star, chat, bell, page/file, layers, truck, payment card, checklist, restriction shield, search, synonym arrows, chart, access lock, permission key, globe, translate, settings and system activity. The precise entry-to-symbol mapping is in [CPANEL_NAVIGATION.md](docs/CPANEL_NAVIGATION.md).

## Localization and database

Applied `006_cpanel_navigation_translations.sql`: **43 new semantic keys and 129 actual Turkmen/Russian/English values**. Nine keys are group headings, 33 are page/container labels, one is `cpanel.navigation.notAvailable`. Multiword segments follow existing camelCase conventions. Existing `cpanel.shell.foundation` is reused.

All new keys live under `cpanel.navigation.*`, including `group.*`. The full key/value inventory is in [INTERFACE_TRANSLATIONS.md](docs/INTERFACE_TRANSLATIONS.md#navigation-roadmap-additions). Current totals: **105 seeded keys / 315 values; 98 used keys**. Retired demo keys remain in historical migrations but are not displayed.

Configuration contains translation keys only. PostgreSQL → localization cache → request cookie language → shared translator → prepared sidebar labels remains the data flow. The integrity scanner now also inventories literal `translationKey` metadata. Ordinary UI `t()` call sites remain literal, and the navigation unit check ensures every configured key is inventoried.

The current development database was updated, and the cache of the verified live :3000 development process was refreshed. The live verifier successfully compared all navigation values, tooltips and accessible labels with PostgreSQL values in tm/ru/en. There are no JSON language files or JS translation dictionaries.

## Files changed

- Added `src/cpanel/shell/navigation.ts`.
- Updated `src/cpanel/shell/context.ts` and `src/views/cpanel/partials/shell/navigation-item.ejs`; restored the required pin/unpin block in `sidebar.ejs`.
- Updated `src/public/cpanel/css/shell.css` and `src/public/cpanel/images/shell-icons.svg`.
- Added migration 006.
- Updated `scripts/localization-integrity.mjs`, `scripts/verify-localization.ts`.
- Added `tests/unit/navigation.test.ts`, `tests/navigation.spec.ts`.
- Updated existing shell tests for the real submenu IDs, current foundation link and completed language navigation; fresh-migration totals updated in `tests/unit/database.test.ts`. The foundation Bootstrap test now waits for the shown event before disposing its temporary component.
- Updated `AGENTS.md`, `README.md`, `docs/ARCHITECTURE.md`, `docs/CPANEL_SHELL.md`, `docs/LOCALIZATION.md`, `docs/INTERFACE_TRANSLATIONS.md`; added `docs/CPANEL_NAVIGATION.md` and this report.

No route/controller/authentication service/repository, package dependency or business schema was changed.

## Permanent decisions

Architecture section 27 records the complete hierarchy, availability/permission distinction, enabling workflow and scope. The owner-approved roadmap explicitly supersedes the earlier shell restriction on listing unimplemented pages. Future pages become enabled only after UI-first work, review, approved backend/schema where required, tests, regression and a readiness decision—not when development starts.

Explicit decisions can rename/reorder/add/remove/merge/split entries. Navigation does not define or authorize database architecture. Future UI strings must receive real database translations in every required language in the same task; missing values or exposed keys mean incomplete work.

## Verification results

- `npm run db:migrate`: migration 006 applied to the current development PostgreSQL database.
- `npm run typecheck`: passed (exit 0).
- `npm run build`: passed (exit 0), including TypeScript and production assets/views/migrations.
- `CHROME_PATH=/usr/bin/google-chrome npm test`: **22/22 unit/server tests + 32/32 browser tests passed**.
- `TEST_PRODUCTION=1 CHROME_PATH=/usr/bin/google-chrome npm test`: **22/22 unit/server tests + 32/32 browser tests passed**, with Playwright starting the compiled application via `npm start`.
- `npm run localization:check`: **98/98 used UI keys have actual tm/ru/en values**.
- `CHROME_PATH=/usr/bin/google-chrome npm run localization:verify`: passed against actual :3000 server, including Frontend, login, authenticated shell/navigation, selectors and authentication messages in all three languages.
- Fresh isolated migrations verified all 105 seeded keys / 315 values, migration idempotence and required-language completeness.
- Expanded sidebar: all nine groups and 30 planned leaves verified; all three reusable submenus open correctly; representative root/nested disabled entries do not navigate on click/Enter/Space.
- Collapsed sidebar: 80px workspace offset, translated native tooltip labels and submenu expansion passed.
- Pin/unpin: toggle, reload persistence, pointer/focus preview, Escape and re-pin passed.
- Themes/languages: complete label/attribute comparison against PostgreSQL for tm/ru/en and activation checks in both light/dark passed.
- Mobile: 375px roadmap scroll reaches System Events, no horizontal overflow, Escape closes; existing 375/768px offcanvas/backdrop tests passed.
- Regression includes login, real authentication, Super User/bootstrap, typed/default-deny permissions, sessions, localization, shell/theme/language switching, Frontend, Bootstrap/jQuery and Socket.IO.
- Representative English light, Russian dark and mobile System screenshots were visually reviewed; no observed layout defects.

During verification, the current sidebar template was missing its pin block, causing JavaScript null-element errors and preventing later submenu/language initialization. Restoring the established block fixed this regression. Tests were also corrected to explicitly exercise aria-disabled items and wait for completed Bootstrap animations and language reloads. Disabled behavior was not weakened to accommodate tests.

Screenshots are generated in `artifacts/roadmap-{tm,ru,en}-{light,dark}.png` and `artifacts/roadmap-mobile-system.png`. Existing shell screenshots also cover pin/collapse/theme/mobile behavior.

## Explicit answers

**Did this task create any future business page, route, table, service, or repository merely because it appears in the navigation roadmap? No.**

**Are there any known navigation translation keys without real tm/ru/en database translations? No.**

Unresolved issues: **none known**. Documentation links were checked successfully. The roadmap is ready for review. No future module has been started.
