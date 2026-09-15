**Current update:** Users is enabled at `/cpanel/users` for the explicitly authorized UI-review stage. Permissions remains disabled. See [Users UI](CPANEL_USERS.md). Earlier roadmap counts below describe the initial stage.

# CPanel navigation roadmap

The owner explicitly approved the permanent initial roadmap after approving the shell. This replaces the shell's temporary example menu and its earlier restriction against listing unimplemented modules.

## Current hierarchy

Panel foundation (`/cpanel`) is **enabled** under Overview, separate from Dashboard. All 30 planned page entries below are **disabled**. Shopping, Access and Localization are structural submenu controls, not implemented business pages; they expand to show their disabled children.

| Group | Planned pages / nested structure |
| --- | --- |
| Overview | Dashboard |
| Catalog | Products; Categories; Brands; Media; Discounts |
| Vendors | Vendors; Source Products |
| Sales | Orders; Customers; Shopping → Carts, Favorites; Reviews |
| Communication | Live Chat; Notifications |
| Content | Custom Pages; Groups |
| Marketplace | Delivery Types; Payment Types; Order Statuses; Restrictions |
| Search & Analytics | Search; Search Synonyms; Analytics |
| System | Access → Users, Permissions; Localization → Languages, Interface Translations; Settings; System Events |

## Availability and authorization

`status: enabled | disabled` answers whether a page is implemented and ready. It never answers whether a user may access it. It is not a permission and is never stored in `cpanel_user_permissions`. Existing server-side authentication/authorization remains authoritative. Super User status does not enable unimplemented pages.

`src/cpanel/shell/navigation.ts` is the single navigation configuration. Groups and items store literal `translationKey` metadata, stable IDs and SVG icon names. A typed union distinguishes page entries (status, optional href) from structural submenu containers (children). Containers remain interactive solely to disclose the roadmap, with no href or claim of page availability.

`prepareNavigation` resolves labels using the existing request-bound PostgreSQL-backed translator. It strips hrefs from disabled entries even if a future URL is present in configuration. Only an enabled matching route can become active; active descendants propagate up to parents. The generic EJS component continues to handle nested rendering, Bootstrap collapse, icon rail expansion and accessible state.

Disabled entries render as focusable non-anchor spans with `role=link`, `aria-disabled=true`, no href and no activation handler. Mouse, Enter and Space cannot navigate to a business page. Translated native title tooltips and accessible labels combine the page label with “Not available yet”, including in the icon rail. Styling uses readable muted text, subdued icons and a not-allowed cursor without large badges or hover highlights. No `href="#"` or fake placeholder routes exist.

The larger navigation region scrolls independently; brand/pin rows do not shrink and mobile offcanvas retains scrolling, backdrop, Escape and full-width content. Light/dark, pin/unpin and browser-local preferences remain the existing shell mechanisms.

## Enabling and evolving the roadmap

For every future page: requirements → UI-first implementation → review → required backend/schema only when approved → tests → regression → readiness decision → change navigation status to enabled. Starting development is not sufficient to enable a menu entry. Add the legitimate route/href and review permissions separately when enabling it.

Explicit development decisions may add/remove/rename/move/merge/split entries or change nesting. The roadmap is a visible development plan, not an irreversible domain or database design. A Delivery Types entry does not authorize a delivery_types table; design/approve schema when that module is reached.

## Localization

Migration `006_cpanel_navigation_translations.sql` adds 43 keys / 129 real tm/ru/en values: nine group headings, 33 item/container labels and the disabled hint. Multiword keys use the established camelCase segments (for example `sourceProducts`, `searchAnalytics`, `notAvailable`). `cpanel.shell.foundation` is reused for the existing root page.

The source scanner inventories literal `translationKey` metadata as well as literal `t()` calls. The sole navigation preparation step uses that metadata with the existing translator; it is not a JS translation dictionary. Other UI `t()` call sites remain literal. Fresh-migration tests and live database checks cover metadata keys, and the live browser verifier checks every navigation value and hint.

Current totals: 105 seeded keys / 315 values; 98 currently used keys. Retired demonstration keys remain in already-applied historical seed migrations but are not rendered.

Every future menu item, submenu, button, heading, label, tooltip, modal, validation message, toast or other UI string must receive real translations for **all required interface languages in the same task**, followed by migration/cache refresh and actual browser verification. Keys without values and exposed semantic keys both mean unfinished work.

## Icons

Existing local SVG symbol infrastructure is retained; no framework was added. Assignments:

| Entry | Symbol |
| --- | --- |
| Foundation / Dashboard | grid / dashboard |
| Products / Categories / Brands / Media / Discounts | box / categories / tag / image / discount |
| Vendors / Source Products | store / source |
| Orders / Customers / Shopping / Carts / Favorites / Reviews | orders / users / cart / cart / heart / star |
| Live Chat / Notifications | chat / bell |
| Custom Pages / Groups | file / layers |
| Delivery Types / Payment Types / Order Statuses / Restrictions | truck / card / checklist / shield |
| Search / Search Synonyms / Analytics | search / synonyms / chart |
| Access / Users / Permissions | lock / users / key |
| Localization / Languages / Interface Translations | globe / globe / translate |
| Settings / System Events | settings / activity |

## Verification scope

Unit tests validate hierarchy/counts, unique IDs, source-key inventory, SVG symbols, disabled href suppression and active nested descendants. Browser tests compare every label/hint against actual database values in tm/ru/en; exercise all three submenus, disabled activation, themes, collapsed rail, mobile scrolling to the final item and absent business routes. Existing shell tests continue to check pin/focus/preview/persistence and mobile dismissal; all existing authentication/permission/login/Frontend/Socket.IO tests remain.

No future business page, route, table, service or repository is created by this roadmap. The only database mutation is localization seed data plus migration bookkeeping.

## Users authorization after backend activation

Users was enabled during its approved UI stage. The activated module now additionally requires effective `users.view` (or exact `superuser=true`). Navigation preparation omits its entry for actors without that permission, without changing roadmap availability or granting access. Direct page and JSON requests enforce authorization server-side. Permissions remains disabled. See architecture section 34.

## Permissions activation

Following the complete activation regression, `System → Access → Permissions` is enabled with `/cpanel/permissions` and the independent `permissions.view` visibility requirement. Exact Super User authority satisfies it without individual permission rows. Detail pages retain the parent Permissions active state. An Access submenu with no permitted children is omitted; other grouped/collapsed/pinned/mobile behavior remains shared. Navigation availability is never stored as an assignment.
