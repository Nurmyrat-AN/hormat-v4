# Brands UI — completion report

Date: 2026-09-16. Historical initial UI report. **The separate Translations tab below was rejected and superseded by [the inline revision](BRANDS_INLINE_TRANSLATIONS_REPORT.md).** Current behavior is documented in docs/CPANEL_BRANDS.md.

## Result

`GET /cpanel/brands` is ready for UI review. It requires the existing CPanel authentication and effective `brands.view` (Super User passes). Catalog → Brands remains **disabled**. The page is accessible directly for review.

Brand changes live only in the current page's memory and reset on reload. The page and success notices explain this. No Brands domain persistence, mutation endpoints, tables, services or repositories were created. Migration 030 adds interface translations only.

## Requested details (1–54)

1. **Route:** authenticated `GET /cpanel/brands`; unauthenticated access redirects to login, missing effective view permission returns forbidden.
2. **Page:** approved application shell, heading/subtitle, compact preview notice, search, visibility filter, Add Brand, Grid/List and reusable editor dialog.
3. **Search:** case-insensitive local name search, debounced 300 ms, matching base and current-language displayed name. Empty results have localized guidance.
4. **Filter:** All by default; Visible and Hidden supported. It combines with search.
5. **Grid:** primary illustration/fallback, displayed name, translation completeness, gallery count, visibility and three-dot actions.
6. **List:** Brand/Translations/Gallery/Visibility/Actions; thumbnail in the identity column. Narrow screens use stacked rows. Switching views preserves search/filter/data; only view preference uses localStorage.
7. **Hidden:** muted surface, dashed border and translated Hidden badge, while remaining manageable. Hidden does not mean deleted, inactive or broken.
8. **Actions:** Edit and permission-controlled Change Visibility. No Delete.
9. **Create dialog:** same three-tab editor used for Edit; only Basic Information is initially available.
10. **Tab locking:** Translations/Gallery are visible but disabled, with localized explanations until an identity exists.
11. **Required Create field:** base Name. Visibility is displayed as Hidden and is not editable in Create.
12. **Default visibility:** creation always sets conceptual `is_visible=false`; completing other tabs never publishes.
13. **Validation:** blank/whitespace-only Name is rejected locally with translated inline feedback and focus. Backend validation is deferred with backend activation.
14. **Create → Edit:** the mock adapter assigns `preview-<UUID>`, retains the new object, changes mode/title and unlocks dependent tabs.
15. **Dialog after Create:** remains open; there is no list/reopen round trip.
16. **Identity:** the same newly created mock object and ID remain selected in the editor and are added to page-memory rows.
17. **Unlocked tabs:** Translations and Gallery become available immediately; editing still follows independent actor capabilities.
18. **Edit:** Basic Information, Translations and Gallery, each with its own save action and state indicator.
19. **Basic:** base Name and explicit visibility. Name requires update; visibility requires its separate permission.
20. **Basic save:** saves only its draft into the mock row. Translation/Gallery drafts and saved baselines are untouched.
21. **Translations:** active-language selector, saved base name, optional name override, fallback explanation and separate save action.
22. **Registry:** language options and completeness denominator come from the active PostgreSQL language registry supplied by the existing localization middleware. No three-language structural limit.
23. **Base name:** a separate value on the conceptual main Brand, usable without any overrides. The editor references the saved base, not an unsaved Basic draft.
24. **Fallback:** usable requested-language override → base name. Cards use the same reusable resolution helper.
25. **Missing translation:** allowed; input stays empty and explains that the base is used. Opening a language does not copy/create an override.
26. **Completeness:** populated active-language overrides / active registry languages. Informational only.
27. **Translation save:** saves this tab's language drafts together; never saves Basic/Gallery.
28. **Gallery:** multiple illustrative media references, one primary when nonempty, ordering and independent save.
29. **Add Media:** localized inline mock selector with four local SVG illustrations from the existing icon system. Already selected items cannot be added twice. This is a review affordance for the existing Media concept, not a second storage system or a live File Manager integration.
30. **Empty Gallery:** deliberate localized empty state and Add Media control.
31. **Primary:** first added item becomes primary; Set as Primary changes the selected item and updates the card after Gallery save. Removing primary selects the first remaining item.
32. **Remove:** unlinks only the draft reference. No file deletion or Media write occurs.
33. **Ordering:** implemented through Move earlier/Move later, with boundary controls disabled. Primary identity survives reordering.
34. **Gallery save:** saves only Gallery. Unsaved Basic/Translation work remains dirty.
35. **Dirty state:** reusable `ContentEditorState` maintains independent saved/draft snapshots and clean/dirty/saving/saved/error state per tab.
36. **Switching tabs:** keeps every draft, including overrides in other selected languages.
37. **Closing:** close button/backdrop/Escape warns when any tab is dirty. Cancel keeps editing; confirmation discards only unsaved drafts, retaining already mock-saved work. Page exit also uses the native unsaved warning.
38. **Success/failure:** single-flight saving state; translated preview-success notification. Failed save retains draft/error state and allows retry. A forced adapter failure is exercised in tests without adding a production failure switch.
39. **Visibility:** permission-controlled Basic field. Quick Change Visibility opens/focuses that same control; its save updates cards/filter membership consistently. It does not silently publish on other saves.
40. **Permissions:** view controls GET; create controls Add/Create; update controls Name/Translations/Gallery; visibility separately controls publication state. Read-only actors can inspect. Create-only permission does not grant subsequent update rights.
41. **Registry:** four assignable boolean definitions: `brands.view`, `brands.create`, `brands.update`, `brands.visibility`. Existing Permissions Management renders them automatically. No `brands.delete`, roles or implicit grants.
42. **Localization:** 48 new semantic keys: 14 `cpanel.brands.*`, 34 reusable `cpanel.content.*`; existing navigation/profile/users labels reused. Full key inventory is below.
43. **tm:** real database values verified on the live development server and through production browser workflows; no exposed keys.
44. **ru:** same verification passed.
45. **en:** same verification passed.
46. **Light:** Grid/List/Create and all tabs of full/partial/empty representative records checked.
47. **Dark:** equivalent checks, theme-aware surfaces/controls/text/icons.
48. **Responsive:** 1440 px desktop, 768 px tablet, 375 px narrow/mobile; no document horizontal overflow. Scrollable dialog keeps footer actions accessible.
49. **Fixtures:** eight fictional Brands; full/partial/zero translations, visible/hidden, multiple/single/empty gallery, primary item and long name. They are content fixtures, not interface translation dictionaries.
50. **Reusable pieces:** content state/fallback helper plus EJS visibility, registry-driven translation and gallery partials. Bootstrap modal/dropdown and existing shell remain in use; no universal domain schema/framework introduced.
51. **Regression:** targeted new Brands tests plus permission registry/service, fresh migrations, localization integrity, navigation, shell and Permissions browser coverage. Exact results/commands below.
52. **Build:** normal production build, including TypeScript, passed; browser regression runs the built application with `npm start`.
53. **Deferred:** all Brands persistence/APIs, real gallery linking/selection, upload, deletion/reference policy, and Source Products/Categories UI. The sidebar remains disabled until later activation approval.
54. **Before backend:** approve this UX; finalize schema/ID/constraints/name limits, translation validation/fallback, Media path/reference ownership, gallery ordering/primary storage, concurrency/transactions and final authoritative mutation rules. No unresolved UI blocker is currently known.

## Localization and database

Migration: `src/database/migrations/030_brands_ui_translations.sql`.

Applied to the current development database. All 48 new keys have actual tm/ru/en values (144 values). The development server's localization cache was reloaded through its existing SIGUSR2 handler; focused live checks then passed in all three languages.

New keys:

- `cpanel.brands.`: `subtitle`, `search`, `add`, `create`, `edit`, `created`, `empty`, `lockTranslations`, `lockGallery`, `nameRequired`, `permissionView`, `permissionCreate`, `permissionUpdate`, `permissionVisibility`.
- `cpanel.content.`: `visibility`, `visible`, `hidden`, `all`, `changeVisibility`, `translations`, `gallery`, `defaultName`, `baseHelp`, `overrideHelp`, `usesDefault`, `override`, `saveBasic`, `saveTranslations`, `saveGallery`, `addMedia`, `pickMedia`, `galleryHelp`, `emptyGallery`, `primary`, `setPrimary`, `removeGallery`, `earlier`, `later`, `unsaved`, `saved`, `saving`, `saveFailed`, `locked`, `readOnly`, `sampleMedia`, `discardPrompt`, `discard`, `preview`.

Reused labels include `cpanel.navigation.brands`, `cpanel.profile.tabs.basic`, `cpanel.profile.fields.name`, `cpanel.navigation.languages` and `cpanel.users` view/grid/list/actions/close/cancel.

No JSON language files or TypeScript interface dictionaries were created. Mock Brand name overrides are domain-content fixtures, separate from interface localization.

## Verification actually executed

- `npm run build` — PASS (TypeScript compilation and production assets).
- `npm run db:migrate` — PASS, applied 030.
- `npm run localization:check` — PASS, 386 discovered UI keys covered in all required languages.
- Targeted Node tests — **37/37 PASS**: five new content editor tests plus existing registry, permissions, database/fresh migrations, localization, translation integrity and navigation tests. Fresh migration expectations: 30 migrations, 406 canonical keys, 1,218 tm/ru/en values.
- Production Playwright run: `tests/brands.spec.ts`, `tests/shell.spec.ts`, `tests/navigation.spec.ts`, `tests/permissions.spec.ts` — **17/17 PASS** (6 Brands, 5 Permissions, 1 navigation roadmap, 5 shell).
- `CHROME_PATH=/usr/bin/google-chrome node --import tsx scripts/verify-brands-ui.ts` — PASS against the running server at port 3000 for tm/ru/en, actual database text, validation, same-dialog Create/Edit, default Hidden, language switching and mock reset. Temporary test account removed.
- Final strengthened Brands acceptance rerun — **6/6 PASS**, including active-tab ARIA/panel agreement and reduced-motion screenshots.
- `git diff --check` and Brands documentation link check — PASS.
- Fourth-language behavior — real EJS partial rendered with four registry languages in a unit test; browser fixture verified selection/fallback/save for the extra language without changing the real registry.
- Mock boundary — browser verifies no business mutation request, no Brands POST/API endpoint and no `brands`, `brand_translations`, `brand_media` table. Existing Socket.IO protocol traffic is excluded from the no-business-mutation assertion.
- Screenshots: `artifacts/brands-{light,dark}-{1440,768,375}-*.png`; representative page and modal screenshots visually inspected.

Initial no-mutation browser assertion incorrectly counted existing Socket.IO polling POSTs. The assertion was corrected to exclude only `/socket.io/`; Brands business mutation checks remain. Initial live translation check detected stale development cache, fixed with the supported cache reload and reverified. Neither failure was hidden or bypassed.

**Historical suites intentionally not rerun:** deep Media/File Manager/Move/upload, Profile, Users, Vendor sync/reset/stock and Source analysis. No implementation in those domains changed. Existing authorization/registry, localization/migration, navigation and shell behavior are the realistic integration surface and were selected. Comprehensive cross-module `localization:verify` was replaced by focused live Brands verification under the current AGENTS/architecture risk-based strategy. This is **not** a claim that the full historical suite ran.

## Explicit confirmations (requirements 100–107)

| Question | Answer |
| --- | --- |
| Main Brand concept contains its default/base name? | **YES** |
| Missing requested translation uses that name? | **YES** |
| Base name is separate from translation rows? | **YES** |
| Brand can exist without translations? | **YES** |
| Missing-language override can fall back? | **YES** |
| All tm/ru/en content translations required before creation? | **NO** |
| Translation UI driven by language registry? | **YES** |
| Every new Brand starts is_visible=false? | **YES** |
| Hidden differs from deleted/disabled/broken? | **YES** |
| Administrator can prepare before publishing? | **YES** |
| Completing translations/gallery automatically publishes? | **NO** |
| Add initially opens Create mode? | **YES** |
| Only Basic editable before identity exists? | **YES** |
| Translations unavailable before creation? | **YES** |
| Gallery unavailable before creation? | **YES** |
| Dialog closes after successful Create? | **NO** |
| Same dialog transforms into Edit? | **YES** |
| Newly created Brand remains selected? | **YES** |
| Translations immediately unlock? | **YES**, subject to update capability |
| Gallery immediately unlocks? | **YES**, subject to update capability |
| Preparation continues without finding/reopening the Brand? | **YES** |
| Basic has independent save/state? | **YES** |
| Translations have independent save/state? | **YES** |
| Gallery has independent save/state? | **YES** |
| Basic save falsely saves Translation draft? | **NO** |
| Translation save falsely saves Gallery draft? | **NO** |
| Tabs can simultaneously have different dirty/saved states? | **YES** |
| Tab switches retain drafts? | **YES** |
| Close with unsaved changes warns? | **YES** |
| Failed Save keeps affected draft unsaved? | **YES** |
| Failure leaves another successful tab intact? | **YES** |
| Gallery requires conceptual base identity? | **YES** |
| Gallery follows existing Media reference concept? | **YES**, mock selector at this stage |
| Second Media storage architecture introduced? | **NO** |
| Gallery supports multiple items? | **YES** |
| One item can be Primary? | **YES** |
| Removing Gallery item physically deletes file? | **NO** |
| Four requested Brands definitions registered? | **YES** |
| Definitions appear through centralized registry? | **YES** |
| brands.delete created? | **NO** |
| Real brands table created? | **NO** |
| brand_translations created? | **NO** |
| Brand-media table created? | **NO** |
| Real Brands CRUD persistence implemented? | **NO** |
| Current stage intentionally UI-first/mock-backed? | **YES** |
| Source Products UI started? | **NO** |
| Source Products remains postponed pending Product workflow? | **YES** |

## Completion checklist

- [x] Brands page, Grid/List, live search, visibility filtering and Hidden presentation.
- [x] Create mode, required Name validation, default Hidden, locked dependent tabs.
- [x] Create → Edit in the same open dialog; retained identity/selection; tabs unlock.
- [x] Basic edit and independent save.
- [x] Dynamic-registry Translations, separate base name, fallback and completeness.
- [x] Independent Translation save.
- [x] Gallery, empty state, mock Add Media, Primary, unlink and ordering.
- [x] Independent Gallery save.
- [x] Per-tab dirty state, retained drafts across switches, close confirmation.
- [x] Failure remains unsaved; another tab's successful save stays intact.
- [x] Quick visibility entry uses the same authoritative UI field; cards stay consistent.
- [x] Separate permission-aware UI, four registry entries, no Delete.
- [x] Real tm/ru/en interface translations and development database/cache verification.
- [x] Light/dark and desktop/tablet/mobile coverage; representative states reviewed.
- [x] Critical Create → Edit and independent-save browser acceptance scenarios passed.
- [x] Mock-only boundary; no Brands schema/CRUD/content-translation/media persistence.
- [x] Source Products remains postponed.
- [x] Targeted shared-UI regression passed (17 production browser tests).
- [x] TypeScript/production build passed.

## Files in this stage

Created:

- `src/controllers/cpanel/brands.ts`
- `src/cpanel/brands/preview.ts`
- `src/public/cpanel/js/brands.js`
- `src/public/cpanel/js/content/editor-state.js`
- `src/public/cpanel/css/brands.css`
- `src/views/cpanel/pages/brands.ejs`
- `src/views/cpanel/pages/brands-content.ejs`
- `src/views/cpanel/partials/content/{visibility,translations,gallery}.ejs`
- `src/database/migrations/030_brands_ui_translations.sql`
- `tests/unit/content-editor.test.ts`
- `tests/brands.spec.ts`
- `scripts/verify-brands-ui.ts`
- `docs/CPANEL_BRANDS.md`
- `BRANDS_UI_REPORT.md`

Updated:

- `src/routes/cpanel/index.ts` — read-only page route.
- `src/cpanel/shell/context.ts`, `src/localization/http.ts` — Brands language return destination.
- `src/cpanel/permissions/definitions.ts` — registry metadata.
- `src/views/cpanel/layouts/application.ejs` — conditional Brands assets.
- `tests/unit/{database,permission-registry,permissions}.test.ts` — registry/migration inventory expectations, preserving existing tests.
- `docs/ARCHITECTURE.md` section 48 and `README.md` — review-stage flow, scope, commands and reuse contract.

Other pre-existing uncommitted workspace changes belong to previous tasks and were preserved.

## Architecture proposal and stop boundary

Documented for applicable future content modules: Create minimum base → receive ID → same dialog Edit → unlock dependent sections → independent saves → explicit publication. Base fields supply fallback; optional translation fields supply overrides. New visibility defaults false. These are review-stage proposals; the first real Brands schema/business implementation still requires explicit approval. They do not force identical tabs or a universal database schema on every domain.

Source Products UI remains postponed so its eventual workflow can show connected HORMAT Product counts, filter sources without Products and create/open storefront Products from selected sources. No such UI was started.

Stop here for UI review. No automatic Brands backend, persistence, Delete, Source Products or Categories stage follows.
