# HORMAT V4 — Users Management UI refinement

## Implementation

1. **Toolbar:** separate primary search input with subtle icon, adjacent field selector and status selector, compact Grid/List switch and Add User action. Controls share one row where width allows and wrap on smaller screens. The previous large input-group is removed.
2. **Search default:** empty query, **Name**. Selector order: Name / All fields / Email / Phone / Job.
3. **Status filter:** Active / All / Inactive, default **Active**. Inactive records are hidden on initial load.
4. **Live behavior:** existing 300 ms debounce; query and status combine against user name/email/phone/job values. Field/status changes re-filter, with local loading/empty states. Reset clears the query and restores Name / Active. Pagination uses the filtered collection. No final backend search or new result-count/pluralization architecture was added.
5. **Inactive appearance:** shared Grid/List class uses theme-aware muted text, grayscale avatars, softer background and dashed borders. Information and normal-user action menus remain readable and usable. Terminology stays active/inactive.
6. **Mock records:** replaced 12 generic numbered samples with **10 fictional users**, seven active and three inactive, including one protected active Super User. Varied names, jobs, invalid-example emails, deliberately invalid test phones, four local avatar illustrations and six initials fallbacks. Existing development-only Show sample users toggle remains opt-in; no mock records enter PostgreSQL or appear in production UI.
7. **Grid/List:** same filtered dataset and existing reusable item template. Switching preserves query, field and status. Grid remains default; browser-local view preference survives reload.
8. **Super User identification:** read-only SQL derives `protected` with EXISTS against `cpanel_user_permissions`, exact `key='superuser' AND value='true'::jsonb`. No name/email/job/ID/order heuristics and no permission map exposure.
9. **Super User restrictions:** localized badge and informational dropdown. Status/Edit/Password buttons are hidden and disabled; selected-user dispatch and modal-opening guards prevent opening those dialogs. This includes the logged-in Super User. No management shortcut to profile/password is added.
10. **Dialogs:** Add/Edit/Status/Password remain reusable Bootstrap dialogs for ordinary users. Status action says Activate or Deactivate according to the preview state. Universal cache uploader and non-persistence notices remain intact. No management write endpoints or finalization were added.
11. **Localization:** migration 012 adds `cpanel.users.allStatuses`, `cpanel.users.superuser`, `cpanel.users.protected`; updates `cpanel.users.clear` to Reset filters. Existing field/status/view/action/dialog/media labels are reused.
12. **Database translations:** all three new keys have real **tm/ru/en** values (9 new values); Reset filters updated in all three languages. Canonical totals: **179 keys / 537 language values / 171 used UI keys**. Migration applied to the current development database; running cache refreshed via SIGUSR2. Actual running-server browser verification passed in all three languages.
13. **Themes:** Grid/List, toolbar, inactive appearance and existing dialogs exercised in light/dark. Screenshots visually inspected. Screenshot capture disables CSS animations to avoid capturing sidebar transitions; geometry assertions also check the actual sidebar/workspace widths.
14. **Responsive:** representative 1280px desktop, 768px tablet and 375px mobile checks; no horizontal page overflow. On mobile search occupies a full row, selectors share the next row, Grid/List and Add sit below.
15. **Database safety:** Users tests compare complete profile/auth/permission tables before/after UI interactions; no user-management persistence. Isolated authentication fixtures are created/cleaned by the existing test harness, not seeded as UI mock users. The protection test changes only its disposable fixture permission to JSON string `"true"` and back, proving exact boolean semantics before taking the UI safety snapshot.
16. **Permanent rules:** architecture section 33 records Name/Active defaults, inactive styling and protection of ALL Super User targets from Users management edit/status/password/delete/deactivate. Future mutation endpoints/services must enforce this rule server-side from current authoritative permissions. Disabled UI alone is not security. Existing `/cpanel/profile` self-management remains unchanged.
17. **Scope:** read-only directory and UI refinement only. No Users CRUD, status schema, permission management, roles, account writes or next backend stage.

## Files changed

- `src/cpanel/users/repository.ts`, `src/controllers/cpanel/users.ts`
- `src/views/cpanel/pages/users-content.ejs`
- `src/public/cpanel/js/users.js`, `src/public/cpanel/css/users.css`
- New `src/public/cpanel/images/users-sample-avatar.svg` (local code-native illustration)
- New `src/database/migrations/012_cpanel_users_refinement_translations.sql`
- `tests/users.spec.ts`, `tests/unit/database.test.ts`, `scripts/verify-localization.ts`
- `docs/ARCHITECTURE.md`, `docs/CPANEL_USERS.md`, `docs/LOCALIZATION.md`, `docs/INTERFACE_TRANSLATIONS.md`, this report

No shell/navigation/authentication mutation implementation or environment/dependency changes.

## Executed verification

- `npm run typecheck` — passed.
- `npm run build` — passed.
- `npm run db:migrate` — migration 012 applied.
- `npm run localization:check` — passed, 171 used keys.
- `CHROME_PATH=/usr/bin/google-chrome npm run localization:verify` — passed on the existing port 3000 server in tm/ru/en, including Users, earlier profile/password/upload and authentication flows.
- Focused Users browser tests — **7 passed**; additional focused English screenshot/geometry recheck passed.
- `CHROME_PATH=/usr/bin/google-chrome npm test` — **34 unit/integration + 50 browser tests passed**, exit 0.
- `TEST_PRODUCTION=1 CHROME_PATH=/usr/bin/google-chrome npm test` — **34 unit/integration + 50 browser tests passed**, exit 0; compiled production start verified.
- Local documentation links — passed.

Full regressions covered authentication/login/logout, Super User/permissions/session behavior, localization/fresh migrations, shell/navigation/pin/unpin/mobile, theme/language switching, profile/password, media upload/finalization, Frontend and Socket.IO.

## Explicit answers

| Question | Answer |
| --- | --- |
| Is default search field Name? | **YES** |
| Is default status Active? | **YES** |
| Are inactive users visually disabled/muted? | **YES** |
| Can Users Management edit a Super User? | **NO** |
| Can Users Management change a Super User's status? | **NO** |
| Can Users Management change a Super User's password? | **NO** |
| Does Super User self-management remain under /cpanel/profile? | **YES** |
| Were mock users inserted into real user tables? | **NO** |
| Does every new visible string have real tm/ru/en database translations? | **YES** |

## Review status

**Ready for UI review. No known unresolved UI issues.** All required checks passed. Work stops at this UI refinement stage. Intentional limitation: user statuses and mutation confirmations remain illustrative until a separately approved backend stage; real users have an illustrative Active presentation because no status schema exists.
