# HORMAT-code-v4 — Translation repair and integrity report

## Outcome and root cause

Fixed the actual running development UI. The existing Node process on port 3000 was serving a stale localization snapshot: its HTML contained `brand.name`, `cpanel.login.title`, promotional keys and field/message keys. A read-only audit of the configured PostgreSQL database found both migrations already applied and all **34 keys / 102 real tm/ru/en values** present, with no missing combinations or placeholders.

The development watcher restarted the process after the code changes, loading the current database snapshot. The same URL then returned translated text. Browser verification against that original server confirmed every login value, including data attributes and hidden notices. Previous regression tests started fresh processes and therefore had not detected the stale long-running server.

## Database/source status and actual values

`npm run db:migrate` was executed successfully against the current development database. It was already up to date: no new translation rows or replacement values were necessary. Migrations `001_interface_localization.sql` and `002_cpanel_login_translations.sql` already contain all current values and were deliberately left unchanged. Fresh-migration tests independently verified those canonical seeds.

No JSON translation files, runtime JS/TS translation dictionaries, duplicate repair seeds, new tables, or unrelated modules were created. PostgreSQL remains the source of truth. The full inventory and actual values appear below; these are existing values restored to the running UI through cache refresh, not newly invented seed entries.

## Changes

- Added `scripts/localization-integrity.mjs`: a small literal-key inventory and required-value validator.
- Added `scripts/check-localization.ts` / `npm run localization:check`: validates current database rows against every currently used UI key.
- Added `scripts/verify-localization.ts` / `npm run localization:verify`: verifies the already-running server against actual database values, rather than starting a fresh process.
- Added negative integrity tests and a fresh-migration UI coverage test, plus a real development cache-refresh test.
- Replaced computed promotional key fragments in the login EJS loop with explicit literal translation calls. Updated the conditional error translation similarly. Rendered text/layout behavior is unchanged.
- Added a development-only SIGUSR2 handler calling the existing atomic `localization.reload()`. Failed reloads retain the previous cache. No HTTP endpoint, periodic polling or per-lookup SQL was added.
- Updated the migration runner's completion message to require cache reload/restart.
- Strengthened architecture section 23 and AGENTS.md: the same task must create/reuse keys, seed real tm/ru/en values, apply data, refresh running caches, use the shared helper, and verify actual browser text. Exposed keys mean the task is incomplete. Updated README/localization documentation and recorded the complete translation inventory.

Other changed files: `src/app/index.ts`, `src/server.ts`, `src/database/migrate.ts`, `src/views/cpanel/pages/login.ejs`, `package.json`, `tests/unit/database.test.ts`, `tests/unit/translation-integrity.test.ts`, and `tests/login.spec.ts`.

## Integrity protection

The check rejects:

- UI-used keys absent from canonical migrated data;
- missing tm, ru, or en values;
- values identical to their key;
- blank, TODO, TRANSLATE, TBD and dash placeholders;
- dynamic translation calls that the simple literal scanner cannot safely inventory.

The scanner does not act as a translation source or a general natural-language/static-analysis framework. Additional languages remain database-driven; the required-language list is confined to verification policy. Developers still review translation quality and client-visible text. Current browser messages use server-rendered values and escaped data attributes.

## Executed checks and results

| Check | Result |
| --- | --- |
| Pre-fix live HTML and configured database audit | Reproduced stale keys; database already contained all 102 values |
| `npm run db:migrate` | Passed; already-current seed migrations skipped |
| `npm run localization:check` | Passed: all 34 UI keys have real tm/ru/en database values |
| `CHROME_PATH=/usr/bin/google-chrome npm run localization:verify` | Passed against the existing server on port 3000 |
| `/` in tm, ru, en on existing server | Actual database text; no exposed keys |
| `/cpanel` in tm, ru, en on existing server | Actual database text; no exposed keys |
| `/cpanel/login` in tm, ru, en on existing server | All expected copy/attributes present; no exposed keys |
| Existing language selector | Cookie and rendered text changed correctly from each starting language |
| `npm run build` | Passed |
| `npm run typecheck` | Passed |
| Development `npm test` | **16 Node tests + 19 browser/HTTP tests passed** |
| Production `TEST_PRODUCTION=1 npm test` | **16 Node tests + 19 browser/HTTP tests passed** |
| Documentation links/code fences; source/compiled seed files | Passed |

The full suites include Frontend, CPanel, login, localization fallback/cache, Bootstrap, jQuery, Socket.IO, assets, responsive UI and mock-form behavior. Production tests start the compiled server and render the login page.

An initial regression run uncovered an old 55/45 layout assertion. The existing user-edited CSS already uses `1fr 450px`; CSS was not changed. The test now checks that exact existing layout, and final runs passed. No design changes were made. Existing expected oversized-request logs and terminal-color warnings remain harmless.

## Cache and remaining status

Normal `t(key)` lookup performs **NO PostgreSQL queries**. It reads the in-memory snapshot. Requested-language → database default → key fallback remains unchanged; key display is a diagnostic fallback, never accepted as complete normal UI.

After future seed/data changes, restart each application process, or send SIGUSR2 to the verified Node application PID in development mode; then run the current-database and live-browser checks. Production processes must be restarted. The original development server remains available on port 3000.

**Are there currently any known client-visible translation keys without real tm, ru, and en database translations? No.**

No unresolved localization issues remain. Work stopped at this task; authentication and other modules were not implemented.

## All current keys and actual values

| Key | tm | ru | en |
| --- | --- | --- | --- |
| `brand.market` | MARKET | MARKET | MARKET |
| `brand.name` | HORMAT | HORMAT | HORMAT |
| `cpanel.login.changeLanguage` | Dili üýtget | Изменить язык | Change language |
| `cpanel.login.email` | E-poçta salgysy | Электронная почта | Email address |
| `cpanel.login.emailInvalid` | Dogry e-poçta salgysyny giriziň. | Введите корректный адрес электронной почты. | Enter a valid email address. |
| `cpanel.login.emailRequired` | E-poçta salgyňyzy giriziň. | Введите адрес электронной почты. | Enter your email address. |
| `cpanel.login.featureChoice` | Giň saýlaw | Большой выбор | More choice |
| `cpanel.login.featureChoiceDetail` | Dürli harytlar | Разнообразие товаров | A variety of products |
| `cpanel.login.featureConvenience` | Amatly söwda | Удобные покупки | Simple shopping |
| `cpanel.login.featureConvenienceDetail` | Hemmesi bir ýerde | Всё в одном месте | Everything in one place |
| `cpanel.login.featureService` | Ünsli hyzmat | Внимательный сервис | Thoughtful service |
| `cpanel.login.featureServiceDetail` | Size gönükdirilen | С заботой о вас | Built around you |
| `cpanel.login.hidePassword` | Açar sözi gizle | Скрыть пароль | Hide password |
| `cpanel.login.javascriptRequired` | Bu formany ulanmak üçin JavaScript-i işjeňleşdiriň. | Для использования формы включите JavaScript. | Enable JavaScript to use this form. |
| `cpanel.login.language` | Interfeýsiň dili | Язык интерфейса | Interface language |
| `cpanel.login.managedNotice` | Diňe administrator tarapyndan döredilen hasaplar üçin. | Доступ только для учётных записей, созданных администратором. | Access is limited to administrator-managed accounts. |
| `cpanel.login.password` | Açar söz | Пароль | Password |
| `cpanel.login.passwordRequired` | Açar sözüňizi giriziň. | Введите пароль. | Enter your password. |
| `cpanel.login.promoDescription` | Harytlary gözläň, deňeşdiriň we özüňize laýyk saýlaw ediň. | Находите товары, сравнивайте и выбирайте то, что вам подходит. | Discover, compare and find what works for you. |
| `cpanel.login.promoHeadline` | Gündelik söwdaňyz üçin bir platforma. | Всё для ваших покупок. На одной платформе. | Everyday shopping. One convenient place. |
| `cpanel.login.rights` | Ähli hukuklar goralan. | Все права защищены. | All rights reserved. |
| `cpanel.login.showPassword` | Açar sözi görkez | Показать пароль | Show password |
| `cpanel.login.slogan` | Gündelik durmuşyňyza amatlylyk. | Больше удобства каждый день. | A little more ease, every day. |
| `cpanel.login.sloganDetail` | Saýlawdan başlaýan täze mümkinçilikler. | Новые возможности начинаются с выбора. | New possibilities begin with a choice. |
| `cpanel.login.submit` | Giriş | Войти | Sign in |
| `cpanel.login.subtitle` | Hasabyňyza girmek üçin maglumatlaryňyzy giriziň. | Введите данные вашей учётной записи. | Enter your details to access your account. |
| `cpanel.login.title` | Dolandyryş paneline giriş | Вход в панель управления | Sign in to the control panel |
| `cpanel.login.unavailable` | Giriş häzir elýeterli däl. Administratoryňyz bilen habarlaşyň. | Вход пока недоступен. Обратитесь к администратору. | Sign-in is not available yet. Please contact your administrator. |
| `cpanel.title` | Dolandyryş paneli | Панель управления | CPanel |
| `errors.internalServer` | Serweriň içerki ýalňyşlygy | Внутренняя ошибка сервера | Internal Server Error |
| `errors.invalidLanguage` | Saýlanan dil elýeterli däl | Выбранный язык недоступен | Selected language is unavailable |
| `errors.invalidRequest` | Nädogry haýyş | Некорректный запрос | Invalid request |
| `errors.notFound` | Sahypa tapylmady | Страница не найдена | Not Found |
| `frontend.title` | Baş sahypa | Главная страница | Frontend |
