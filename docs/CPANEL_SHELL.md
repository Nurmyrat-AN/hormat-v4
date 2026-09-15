# CPanel application shell

> The initial demonstration navigation described below has been replaced by the explicitly approved [navigation roadmap](CPANEL_NAVIGATION.md). Shell behavior remains the same; the roadmap document governs current entries and key-only configuration.

The approved authentication layout remains separate. Authenticated application pages use one sidebar/topbar/content layout, with no new business module or authentication change.

## Server and EJS composition

`src/cpanel/shell/context.ts` prepares common shell display data after `requireCpanelAuth`. It reuses the authenticated profile and localization locals; it does not query credentials or permissions. Current route context marks the active child and parent. Navigation data is presentation configuration, not authorization.

`pages/index.ejs` includes `layouts/application.ejs` with a localized `pageTitle`, optional `pageSubtitle`, and an internal `contentPartial` path. The layout also supports optional `pageActions` (`href`, prepared translated `label`). All paths/action URLs are trusted application configuration, never request-supplied include paths. The main region has a skip link and focus target. `pages/home-content.ejs` supplies only a welcome/foundation placeholder, without fake statistics or analytics.

Reusable partials under `partials/shell/`:

- `sidebar.ejs`: brand, menu groups, pin control.
- `navigation-item.ejs`: recursive item/submenu renderer.
- `topbar.ejs`: sidebar control, page context, shared controls.
- `theme-switcher.ejs`, `language-selector.ejs`, `user-menu.ejs`.
- `icon.ejs`: SVG symbol reference, following the existing local SVG approach.

The login page continues to use its existing markup, head/scripts and `login.css`; it never loads shell CSS, preferences or shell interaction scripts. `head.ejs` only inserts the early preferences script when the application layout explicitly supplies `shellMode: true`.

For future pages: apply the existing authentication middleware and `shellContext`, use the application layout, and provide a page content partial. Add actual navigation entries only when the corresponding module is introduced. Extend the language return allowlist deliberately when adding a real route; currently the shell returns to `/cpanel`.

## Navigation

The small configuration supports groups and items with `id`, translated `label`, `icon`, optional `href`, `active`, and `children`. Labels are prepared using literal semantic `t()` calls, so the existing translation scanner can audit all of them.

Only `/cpanel` exists. The regular Overview entry points to `/cpanel#overview`. A clearly labelled interface/menu example demonstrates a parent, active Panel foundation child (`/cpanel`), and a disabled example without an href. No speculative Users/Products/Orders/Settings entries or routes exist. The parent starts expanded and highlighted for the active child; `aria-current="page"` identifies the child.

Generic submenu handlers invoke Bootstrap Collapse. Buttons expose `aria-expanded` and `aria-controls`; Collapse events keep them synchronized. The renderer is recursive and all submenu IDs must be unique. There is no per-module JavaScript.

## Sidebar states

Desktop starts at 992 px:

- Expanded: 264 px with brand, group labels and item text.
- Collapsed: 80 px icon rail; content margin shrinks to 80 px. Native translated title tooltips and accessible names identify items.
- A collapsed submenu click expands the rail and reveals its submenu.
- Pinned retains the chosen expanded/collapsed state.
- Unpinned + collapsed temporarily expands on pointer hover or keyboard focus. This preview overlays the content, keeping its 80 px layout margin stable. It closes after pointer/focus leave, or Escape. Pinning a visible preview makes the expanded state permanent.
- Unpinning an expanded sidebar does not abruptly collapse it; use the main toggle to select the collapsed base state.

Below 992 px, Bootstrap offcanvas provides the overlay/backdrop, focus trap, Escape and outside-click dismissal. Navigation closes the overlay; the menu control regains focus on dismissal. Desktop preferences do not force a permanent mobile gap. Mobile does not depend on hover. Reduced-motion preferences disable transitions.

## Theme and preference persistence

`js/shell/preferences.js` is a blocking head script before any stylesheet, so persisted theme/state are applied before styled content paints. Defaults are light, expanded, pinned. Only valid values are accepted. Storage failures fall back safely; interaction still works without persistence.

Namespaced localStorage keys:

- `hormat.cpanel.theme`: `light` / `dark`.
- `hormat.cpanel.sidebar`: `expanded` / `collapsed`.
- `hormat.cpanel.pinned`: `true` / `false`.

Temporary hover/focus preview is not persisted. No database preference columns or endpoints were added. `theme.js` uses Bootstrap `data-bs-theme` plus custom scoped shell variables for backgrounds, surfaces, borders, muted text, brand accents, active/hover states, controls and dropdowns. Standard Bootstrap card/table/input color modes remain available for future modules. Login is independent of these preferences.

## Language, user and security

The topbar language options come from the existing active-language registry. The current language is selected. Changing it posts to the existing `/language` route and sets the existing shared cookie; no language list or translation dictionary is duplicated. A submit-button fallback remains when JavaScript is unavailable.

The user button shows the authenticated name and initials/avatar. The dropdown shows name, optional job and existing logout. Email is deliberately omitted because the profile already supplies enough display information; credentials are not loaded for layout rendering. Avatar URLs accept local absolute paths or HTTP(S), reject dangerous/control/backslash forms, are escaped by EJS and request no referrer. Null/invalid/broken avatars fall back to initials. No upload, profile editing or Media integration exists.

Logout uses the existing CSRF-protected `POST /cpanel/logout` form and session invalidation. The shell exposes no password/hash/bearer-token information. The existing CSRF token is rendered only for its intended logout form. Menu visibility is not permission enforcement; future modules must continue to authorize server-side.

Existing Socket.IO setup is unchanged: one CPanel connection, no notification UI or business events, and no inference of authentication from socket presence.

## Localization

Migration `005_cpanel_shell_translations.sql` adds 22 keys (66 tm/ru/en rows) under `cpanel.shell`:

`mainGroup`, `overview`, `demoGroup`, `layoutPreview`, `foundation`, `demoUnavailable`, `skipContent`, `workspace`, `ready`, `subtitle`, `welcome`, `welcomeDescription`, `foundationNote`, `closeMenu`, `navigation`, `pin`, `unpin`, `personalWorkspace`, `toggleMenu`, `darkMode`, `lightMode`, `userMenu`.

The canonical inventory now has 62 seeded keys / 186 translations, with 60 keys currently used. Existing brand, language and logout keys are reused. No database schema changes were needed.

## Verification

Use the normal full development and production regression suites. Shell tests cover desktop state/width, submenu active/open state, collapsed submenu handling, pin/preview/focus, reload persistence, first-stylesheet theme state, light/dark, three actual language switches, real name/job/initials, secure logout, tablet/mobile offcanvas/backdrop/Escape/navigation and storage/unsafe-avatar fallback. Existing login/auth/permissions/Frontend/Socket.IO checks remain.

`npm run localization:verify` checks the actual running server, including every shell translation value (text, titles and accessible/data labels) in tm/ru/en. It creates and deletes a temporary test account without touching owner credentials. Screenshots are generated in ignored `artifacts/shell-*.png` by browser tests.

No unresolved product decision or next business stage is implied by this shell. The disabled demo entry is intentionally temporary and can be replaced when a real module is introduced.
