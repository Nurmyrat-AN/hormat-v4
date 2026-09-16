# Brands activation acceptance ownership

The owner's consolidated A–R UI acceptance remains the workflow baseline. Activation replaces obsolete preview-only assertions (mock IDs, reset-on-reload, no tables/routes) with real PostgreSQL assertions. It does not add duplicate historical suites. `tests/brands.spec.ts` remains the single module browser suite; all tests remain included by normal npm test.

| Coverage | Current executable owner |
| --- | --- |
| Schema, defaults, FKs, attribution, no automatic children | unit/brands.test.ts |
| Name, translations/fallback/registry, Main/Gallery independent persistence | unit/brands.test.ts + primary browser lifecycle |
| Permission exact booleans, forged fields, unsafe paths/cache/non-images, cross-Brand safety, rollback, concurrency | unit/brands.test.ts |
| Independent drafts/fields, save-failure behavior, duplicate save prevention | unit/content-editor.test.ts |
| Create → Edit, three-scope save order, reloads, visibility, search/filter/Grid/List | primary brands.spec.ts scenario |
| HTTP CSRF, fresh permission enforcement, visibility escalation, no Media bypass | security browser scenario |
| Create/Basic/Translation failures, stale Gallery 409, unsaved-close warning | failure browser scenario |
| Real Picker upload/folder/search, image eligibility, missing-file placeholders/retained links | Media integration browser scenario |
| Dynamic fourth language; tm/1440, ru/768, en/375 in Light/Dark | representative visual browser matrix |
| Process-independent persistence | isolated compiled-server restart scenario |
| Permission-aware enabled navigation; Source Products remains disabled | navigation browser scenario + unit/navigation.test.ts |
| Retained keyboard, Picker cancellation/focus, stale search, confirmation revalidation, revoked permission and universal upload regressions | dedicated Picker browser regression |
| Registry-driven Permissions UI and independent view/create/update/visibility controls | capability browser scenario |

The visual matrix is representative, not every possible language × theme × viewport combination. Real test media uses disposable `.test-media/brands-live-*` folders; temporary accounts/Brands/language rows are cleaned up. Browser servers explicitly disable Vendor synchronization. No real Vendor/source/stock data is touched.

## Commands

```sh
npm run build
node --import tsx --test tests/unit/brands.test.ts tests/unit/content-editor.test.ts tests/unit/permission-registry.test.ts tests/unit/media-browser.test.ts
TEST_PRODUCTION=1 CHROME_PATH=/usr/bin/google-chrome npx playwright test tests/brands.spec.ts --project=core
```

Related navigation/shell, Media browse/search/upload/permissions, fresh migration, localization integrity and live verification are selected by actual integration impact. Deep unrelated Vendor/stock/Profile/Users suites are not automatically repeated. See [activation report](../BRANDS_ACTIVATION_REPORT.md) for exact executed results. Older stage reports describe historical UI-only behavior.

## Focused SEO/Product-count extension

Owner scope: tests/unit/brand-seo.test.ts (migration, canonical slug/uniqueness, base SEO, field isolation/fallback, Product FK/count) and tests/brand-seo.spec.ts (Create/Edit SEO smoke, real count/placeholder, affected tm/ru/en labels), plus build. Historical Name selectors are now scoped to their field; expected tab count is three (Basic/Gallery/informational Products). Historical suites remain available and are not rerun for this small extension.

SEO extension verification completed: `tests/unit/brand-seo.test.ts` 2/2 PASS; compiled `tests/brand-seo.spec.ts` 2/2 PASS; affected-page tm/ru/en verification against the running dev server 1/1 PASS. `npm run localization:check` passed for 414 used keys; `npm run build` passed. Migrations 036–037 were applied and the live localization cache refreshed. No historical Vendor/Stock/Users/Profile/Media/Brands suite was executed for this extension. Initial fixture/selector issues were corrected before the passing runs; no unresolved task failure remains.

Separate SEO amendment: four tabs; independent SEO SQL/API/draft scope. Focused unit filter `separate SEO` and tests/brand-seo.spec.ts verify mutual Basic/SEO isolation, wrong-scope rejection, Create unlock, both inline SEO fields and Light/Dark; historical suites remain unexecuted.

Amendment verification: focused database/service test 1/1 PASS; compiled-server browser tests 2/2 PASS; affected live dev-server tm/ru/en browser check 1/1 PASS, including Save SEO. Light/Dark screenshots reviewed. Migration 038 applied to development PostgreSQL and live localization cache refreshed; localization integrity passed for 415 UI keys. Production build and `git diff --check` passed. Unrelated historical suites were intentionally not run: changes are limited to Brands save scopes, layout and one localized action label.
