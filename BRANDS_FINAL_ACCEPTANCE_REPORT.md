# Brands UI — consolidated final acceptance

The owner's final sections 102–122 replace overlapping revision-specific acceptance lists. The implementation remains UI-first. This task changes tests and documentation only; no application routes, schema, localization seeds or runtime behavior changed.

## Consolidation

`tests/brands.spec.ts` now contains eight focused cases, replacing twelve overlapping revision cases. Functional workflows are no longer repeated for each interface language. One named-step Media workflow owns E–L, including the authoritative Translations → Gallery → Basic save sequence. A single visual matrix owns localization/themes/responsive coverage. Distinct error, permission, CSRF, type-revalidation and delayed-search regressions remain.

The current coverage map is [docs/BRANDS_ACCEPTANCE.md](docs/BRANDS_ACCEPTANCE.md). Architecture section 51 records this authorized exception to retaining duplicate historical tests. Unrelated historical suites remain intact and included in the normal full-suite command.

## Single final acceptance summary

| Area | Result |
| --- | --- |
| Brands page | PASS |
| Create → Edit | PASS |
| Inline translations | PASS |
| Independent saves | PASS |
| Main Image | PASS |
| Media Picker | PASS |
| Gallery | PASS |
| Main/Gallery separation | PASS |
| Visibility | PASS |
| Permissions | PASS |
| Localization | PASS |
| Light/Dark | PASS |
| Responsive | PASS |
| Obsolete UI removed | PASS |
| Persistence boundary | PASS |
| Build | PASS |

## Verification scope

Executed:

```sh
npm run build
node --import tsx --test tests/unit/content-editor.test.ts tests/unit/permission-registry.test.ts
TEST_PRODUCTION=1 CHROME_PATH=/usr/bin/google-chrome npx playwright test tests/brands.spec.ts --project=core
```

Build/TypeScript: PASS. Content-state and Permission Definition Registry unit checks: 9/9 PASS. All eight consolidated browser cases pass across their final applicable runs: six in the initial run, N/O on the targeted recheck, E–L on the final targeted recheck. Previously passing cases were not rerun.

Two consolidation errors were corrected in the test code: the localization corpus now includes placeholders/accessibility attributes, and restoring a Gallery to its saved baseline correctly expects Save to be disabled. Test cleanup now proceeds even if the browser has closed; the temporary account left by the initial timeout was removed using its exact identity/time guard. No production fix was required.

Targeted rechecks used `--grep "E–L|N/O"`, then `--grep "E–L"`; repeated runs were solely to fix failed tests, not duplicate acceptance versions. Current screenshots for all languages were generated; representative tm desktop inline translations, ru tablet Picker and en mobile Gallery menu were visually inspected. Menu viewport bounds, overflow and control reachability were checked by the visual matrix. Documentation links and `git diff --check` passed.

The visual matrix uses tm/1440, ru/768 and en/375, each in Light and Dark. It covers complete representative screens and interaction states, not an exhaustive Cartesian product. Interface values are compared with actual PostgreSQL translations; visual screenshots use real isolated Media files. No development Vendor/source data or live Media files were changed.

Intentionally omitted: old overlapping Brands scenarios; standalone shell/Media browser/mutation suites already checked in the preceding implementation stage; deep Users/Profile, Vendor sync/stock, and the full historical suite. This change modifies only acceptance tests/docs, so the rebuilt production Brands integration suite and content-state/registry checks cover its impact. No new visible text or localization code was introduced, so no seed migration/cache refresh was necessary. This is targeted verification, not full regression.

## Final architectural confirmations

| Question | Answer |
| --- | --- |
| Separate Translations tab exists? | NO |
| Translations inline per translatable field? | YES |
| All active language translations visible simultaneously? | YES |
| Main table/base field remains fallback? | YES |
| Main Image is a dedicated Brand field concept? | YES |
| Main Image belongs to Gallery? | NO — the same Media file may be linked independently to both |
| Gallery has a Primary item? | NO |
| Gallery is ordered? | YES |
| Gallery actions under each item's top-right three-dot menu? | YES |
| Select Media opens HORMAT Media Picker? | YES |
| Add Media opens HORMAT Media Picker? | YES |
| Brand directly opens local file picker for normal selection? | NO |
| Local file picker may open after explicit Media Upload? | YES |
| Removing Main Image deletes Media file? | NO |
| Removing Gallery item deletes Media file? | NO |
| Basic Information, translations and Gallery save independently? | YES |
| New Brand defaults Hidden? | YES |
| Create dialog remains open and becomes Edit after creation? | YES |
| Real Brands persistence created? | NO |
| Source Products UI started? | NO |

## Files changed

- `tests/brands.spec.ts`: consolidated executable acceptance.
- `docs/BRANDS_ACCEPTANCE.md`: one coverage/command reference.
- `docs/ARCHITECTURE.md`: authoritative consolidation rule, section 51.
- `README.md`: current acceptance reference.
- `BRANDS_MEDIA_PICKER_REPORT.md`: historical report points to this final acceptance.
- This report.

No unresolved issue within this UI scope. Brand persistence remains intentionally deferred. Ready for UI review; stop.
