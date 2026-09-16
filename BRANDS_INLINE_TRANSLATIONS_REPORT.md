# Brands — inline translatable fields revision

Date: 2026-09-16. Status: implemented and ready for UI review.

This report supersedes the separate Translations-tab design in BRANDS_UI_REPORT.md. The approved inline translation UX is retained; subsequent media changes are recorded in [the Main Image/Gallery/Picker report](BRANDS_MEDIA_PICKER_REPORT.md).

## Result

The existing authenticated `/cpanel/brands` preview now has exactly two dialog tabs:

1. Basic Information
2. Gallery

Name remains a normal base/default input. Its right-hand end-adornment contains the existing globe icon, explicit translation count and a compact dirty marker. Clicking or pressing Enter/Space expands all active-language inputs directly below Name. No language selector or separate Translations tab remains.

## Behavior

- The base Name is separate from translation overrides.
- All active registry languages render together in vertical rows. No hardcoded three-input layout exists.
- Completeness counts only explicit nonblank translations. A missing value with fallback does not increase the count.
- Missing rows remain genuinely empty and use a neutral dashed indicator, a missing marker and localized fallback text. They are not validation errors.
- Fallback follows the current base form value. If that base is unsaved, it is explicitly labeled as an unsaved preview; its saved baseline is not changed.
- Each field owns its translation state and inline Save Translations action. Saving translations leaves Basic/Gallery drafts untouched; Basic save does not clear dirty translations.
- Collapse is presentation only. It preserves all values and dirty state, keeps the compact dirty marker visible and does not change interface language.
- Failed translation saves retain the draft/error state and permit retry without undoing saved Basic information. Closing checks collapsed translation drafts too.
- Independent component instances do not share expansion or translation state and can remain open together. No accordion auto-closing behavior exists.
- Create requires only the base Name, starts Hidden and keeps Name translations/Gallery locked. Successful mock Create keeps the same dialog open, retains the new identity and unlocks both controls. Translation completeness starts at zero.
- View-only users can expand/read translations; editing requires the existing independent `brands.update` capability. No permission definitions changed.
- Cards/List continue showing saved translation completeness and current-language name resolution.
- Gallery behavior, search/filter/Grid/List and the disabled Brands roadmap entry remain intact.

## Reusable component

- `src/views/cpanel/partials/content/translatable-field.ejs`: unique field identity, base input, end-adornment and all registry rows.
- `src/public/cpanel/js/content/translatable-field.js`: per-field expansion, completeness, accessible state, fallback and independent translation draft.
- `src/public/cpanel/css/translatable-field.css`: scoped theme-aware component styling.
- `src/public/cpanel/js/content/editor-state.js`: reusable `DraftState` and section coordinator; the old hardcoded three-tab model was removed.

The caller supplies localized field/lock labels, active languages and the save adapter. The current Brands adapter remains page-memory only.

The obsolete `partials/content/translations.ejs`, Translation-tab markup, tab-specific state/rendering and content-language dropdown handlers were removed. Historical localization seed values are retained; there is no duplicate editor in the live UI.

## Localization/database

Migration `031_inline_translatable_fields.sql` adds five keys, each with actual tm/ru/en values (15 values):

- `cpanel.content.showTranslations`
- `cpanel.content.hideTranslations`
- `cpanel.content.unsavedTranslations`
- `cpanel.content.fallbackPreview`
- `cpanel.content.missingTranslation`

Existing save/error/fallback/preview/lock labels are reused. Migration 031 was applied to the development database and the running localization cache refreshed through the supported reload signal.

**No Brands tables, content-translation tables, relationship tables, mutation API or real persistence were added.** No new routes or permissions were introduced. Existing mock changes still reset on page reload. Source Products/Categories were not started.

## Checks actually executed

| Check | Result |
| --- | --- |
| `npm run build` | PASS — TypeScript and production assets |
| `npm run db:migrate` | PASS — migration 031 applied |
| `npm run localization:check` | PASS — 390 used UI keys covered in tm/ru/en |
| `tests/unit/content-editor.test.ts` plus database/localization/translation-integrity tests | **22/22 PASS** |
| Production Playwright: `tests/brands.spec.ts` + `tests/shell.spec.ts` | **12/12 PASS** — 7 Brands, 5 shell |
| Focused live `scripts/verify-brands-ui.ts` | PASS on the actual development server in tm, ru, en |
| Fresh migration integrity | PASS — 31 migrations, 411 canonical keys, 1,233 tm/ru/en values |

The initial unit run found a test snapshot comparison that compared a class instance with a plain structured clone after the state refactor. The assertion now compares snapshots on both sides while preserving all value/state checks; the rerun passed.

Brands tests cover the retained Grid/List/search/Gallery/create/permission scenarios plus:

- all languages visible simultaneously; no obsolete tab/dropdown;
- 2/3 completeness, 3/3 after entering an explicit override;
- fourth-language 2/4 rendering, fallback and save;
- clearing an override decreases completeness and keeps its actual value empty after save/reopen;
- unsaved base fallback preview;
- translation save retains dirty Basic and Basic save retains dirty translations;
- keyboard expansion/collapse, draft preservation and prevention of accidental Basic submission from a translation input;
- translation failure/retry state and close warning even when collapsed;
- independent field draft states;
- real tm/ru/en UI values, no exposed keys, same-route interface language switching;
- no Brands business mutation requests/endpoints/tables.

Light/dark screenshots and no-horizontal-overflow checks cover 1440, 768 and 375 px. Complete/partial/empty translations, Create locks and Gallery were checked. Representative desktop partial and mobile dark empty editor screenshots were visually reviewed. Artifacts use `artifacts/brands-{theme}-{width}-*.png`.

**Risk-based scope:** this revision changes Brands presentation, a content draft helper used by Brands, and interface seed values. Shared shell regression and localization/fresh migrations were run. Deep Users/Profile/Media/Vendors/Sync/Stock, standalone Permissions/navigation and the complete historical suite were intentionally not rerun because their implementation/authorization/navigation configuration did not change. Existing Brands permission and shell navigation behavior remain covered by selected browser tests. Comprehensive cross-module localization verification was replaced by focused live Brands verification under the current project strategy. No claim of full historical regression is made.

## Required completion checklist

- [x] Separate Translations tab removed.
- [x] Name remains the base/default field.
- [x] Translation icon attached to the input end-adornment.
- [x] Completeness indicator visible; fallback excluded.
- [x] Clicking the icon expands an inline editor.
- [x] All active languages appear simultaneously.
- [x] No language switching required for content editing.
- [x] Missing translations identifiable without error styling.
- [x] Fallback shown for empty translations.
- [x] Fallback never auto-creates an override.
- [x] Translation Save is independent.
- [x] Basic Save is independent.
- [x] Translation dirty state is independent and visible when collapsed.
- [x] Translation control locked before Create.
- [x] Same-dialog Create → Edit unlocks it.
- [x] Gallery remains separate.
- [x] Dynamic fourth-language readiness verified.
- [x] Light/dark verified.
- [x] Desktop/tablet/mobile verified.
- [x] Real tm/ru/en localization verified.
- [x] Obsolete Translation-tab implementation removed.
- [x] Build passes.

## Documentation and files

Permanent rule: architecture section **49, Approved inline translatable-field UX**. Section 48 now reflects the revised two-tab Brands design. This is the default applicable-field UX; another module needs a concrete reason for a different translation presentation. Backend/domain design remains a separate approval stage.

Updated `docs/CPANEL_BRANDS.md`, added `docs/TRANSLATABLE_FIELD.md`, updated README and marked the initial Brands report as historical/superseded.

Other changed files: Brands EJS/page JS/CSS, conditional component stylesheet in the shared layout, the state helper, Brands/browser/unit/localization verification scripts and fresh-migration inventory expectations. No unrelated existing workspace changes were reverted.

**Unresolved UI blockers:** none known. Real persistence and additional module work remain intentionally deferred. Stop here for UI review.
