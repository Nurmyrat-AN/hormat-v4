# Interface localization

Shared infrastructure for Frontend (`/`) and CPanel (`/cpanel`). It translates application/interface text only. It does not implement marketplace entity/content translations, language-management pages, or automatic translation.

## Database and migrations

Run `npm run db:migrate` before development startup. For a compiled deployment, run `npm run build`, then `npm run db:migrate:production` before `NODE_ENV=production npm start`. Migrations are explicit; application startup never applies them automatically.

The existing migration directory now contains `src/database/migrations/001_interface_localization.sql`. The small raw-SQL runner uses a transaction and an advisory lock, records applied filenames, skips them on subsequent runs, and rolls back on failure. SQL files are copied to `dist/database/migrations` during builds. Do not edit already-applied migrations; introduce new numbered SQL migrations for subsequent schema/seed changes.

### `languages`

| Column | PostgreSQL type | Rules/default |
| --- | --- | --- |
| `code` | `text` | Primary key; lowercase alphanumeric language code with optional hyphenated subtags |
| `display_name` | `text` | Required, nonblank |
| `is_active` | `boolean` | Required, defaults to true |
| `is_default` | `boolean` | Required, defaults to false |
| `sort_order` | `integer` | Required, defaults to 0; tie-break by code |
| `created_at` | `timestamptz` | Required, defaults to `now()` |

A partial unique index on `is_default WHERE is_default` allows at most one default. A check constraint requires that default to be active. A deferred constraint trigger requires at least one active default at transaction end. A separate trigger rejects `TRUNCATE languages`, which would bypass row triggers. Together these enforce exactly one active default after every successful ordinary data-change transaction.

Switch the default in one transaction: clear the old `is_default`, then set the new active language's flag, then commit. Setting a second default before clearing the old one fails immediately. Removing/deactivating the only default without selecting a replacement fails. There is no environment-variable override of the database default.

### `interface_translations`

| Column | PostgreSQL type | Rules |
| --- | --- | --- |
| `language_code` | `text` | Required; foreign key to `languages.code` |
| `translation_key` | `text` | Required; semantic dotted key, independent of translated value |
| `translation_value` | `text` | Required, nonblank |

Composite primary key `(language_code, translation_key)` guarantees at most one value per language/key and supplies the required index with `language_code` leading. The foreign key cascades language-code updates/deletions. No redundant indexes or speculative fields were added.

The runner also creates the technical ledger `schema_migrations(name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`. This is migration bookkeeping, not a third localization domain table.

### Seed data

All three languages are active:

| Code | Display name | Default | Order |
| --- | --- | --- | --- |
| `tm` | Türkmen | Yes | 0 |
| `ru` | Русский | No | 1 |
| `en` | English | No | 2 |

Migration 001 seeds six foundation keys (18 rows); migration 002 adds 28 login/brand keys (84 rows). Migration 004 adds six authentication keys (18 rows): there are 40 seeded keys and 38 currently used keys; the two retired mock-only messages remain seeded. All have real values in all three languages. The complete inventory and values are recorded in [INTERFACE_TRANSLATIONS.md](INTERFACE_TRANSLATIONS.md). Foundation values:

| Key | Turkmen | Russian | English |
| --- | --- | --- | --- |
| `frontend.title` | Baş sahypa | Главная страница | Frontend |
| `cpanel.title` | Dolandyryş paneli | Панель управления | CPanel |
| `errors.notFound` | Sahypa tapylmady | Страница не найдена | Not Found |
| `errors.internalServer` | Serweriň içerki ýalňyşlygy | Внутренняя ошибка сервера | Internal Server Error |
| `errors.invalidLanguage` | Saýlanan dil elýeterli däl | Выбранный язык недоступен | Selected language is unavailable |
| `errors.invalidRequest` | Nädogry haýyş | Некорректный запрос | Invalid request |

The initial seed is part of migration 001 so schema and required initial data commit together. Additional languages and translation keys are added through subsequent seed/data migrations, followed by a cache reload or application restart. No runtime language whitelist needs changing. Fill all required interface values for newly supported languages.

## Cache and startup

- `src/localization/repository.ts` reads active languages and their translations within one read-only repeatable-read transaction.
- `service.ts` builds maps in memory and validates one active default and a nonempty default dictionary. `load()` and `reload()` publish the complete snapshot only after successful loading; failure preserves an existing good cache. Concurrent reload calls share one load. Requests already rendering retain their original snapshot.
- `index.ts` provides the shared application instance. Server-side code can call `localization.translate(language, key)` or bind `localization.forLanguage(language)`.
- `server.ts` awaits the first load before opening the HTTP listener. Invalid credentials, missing localization tables, or critically invalid initial data produce a clear startup error and nonzero exit. Apply migrations first.
- **Normal translation lookup performs no PostgreSQL query per `t()` call.** It reads memory only. Database work happens at load/reload and independent technical health checks.
- Lookup order is requested language → default language → key. Blank database values are prohibited; the cache also treats blank loader values as missing. Development logs warn once per language/key per cache generation, capped at 1,000 warnings to bound memory/log volume. Production does not emit these warnings.

There is no public reload route. Future authorized language/translation management can invoke `await localization.reload()` after committing edits. Each application process owns its cache; until management exists, restart/reload each running process after changing data. No Redis or Socket.IO translation synchronization is implemented.

## Request and EJS integration

`src/localization/http.ts` resolves `hormat_lang` only against active languages in the cache. Missing, unknown, malformed, or inactive values resolve to the database default. Middleware exposes:

- `language`: selected interface code;
- `languages`: ordered active-language list (`code`, `display_name`, `is_default`);
- `t(key)`: request-bound lookup helper.

Pages use escaped EJS expressions (`<%= t('frontend.title') %>`, `<%= t('cpanel.title') %>`) for titles/headings and set the document language. Responses vary by `Cookie` and include `Content-Language`. Frontend and CPanel templates and assets remain separate. The layout is unchanged.

The login UI exposes its required translated toggle/validation messages through escaped data attributes; notices are rendered with EJS. No full browser translation dictionary is needed. If future browser UI requires translations, expose only the needed server-translated values using safe structured encoding; reuse this service.

## Changing language

`POST /language` accepts `application/x-www-form-urlencoded` fields:

```text
language=ru&returnTo=/cpanel
```

A valid active language sets `hormat_lang` with `Path=/`, `SameSite=Lax`, `HttpOnly`, and a one-year lifetime. `Secure` is enabled in production; production deployments must use HTTPS. Local browser production tests use Chrome's trusted loopback origin. The preference contains no sensitive data and works across both areas.

The response is HTTP 303. `returnTo=/cpanel` or `/cpanel/login` returns to that exact page; all other values return to `/`. This intentionally allows only the current three pages and prevents external/open redirects. Invalid, missing, or repeated language values return a localized 400 without setting a cookie. Body size is limited to 2 KB; malformed/oversized form errors are localized. The route has no authentication or business side effects beyond the language preference.

The login page has a selector using this route. No language-management CRUD is introduced.

## Development rule

[Architecture section 23](ARCHITECTURE.md#23-interface-localization-and-translation-development-rule) requires stable semantic keys and complete translations in the **same task** that introduces visible interface text. Technical logs/internal identifiers/comments/developer-only messages are exempt. `AGENTS.md` links this rule for future sessions.

## Tests

`npm test` runs Node service/database/startup tests, then the complete Playwright suite. `TEST_PRODUCTION=1 npm test` uses compiled servers for startup/HTTP/browser tests; build first. Existing foundation assertions explicitly select English and still verify assets, Bootstrap CSS/behavior, jQuery, Socket.IO, health and 404s.

Database integration tests use a uniquely named schema in the configured development/test database and drop only that schema afterward. The role needs schema-creation permission. They check migration idempotency, seed completeness, constraints, active-language filtering, real cache reloads, startup failures, and graceful process shutdown. Service tests cover memory-only lookups, fallback, warning deduplication, cache failure/reload consistency, extra languages, cookie parsing and escaped EJS output. Browser tests cover both areas in all three languages, invalid cookies, shared-cookie switching, flags, redirect safety and Socket.IO.

Use `CHROME_PATH=/usr/bin/google-chrome` for the installed browser here, or install Playwright Chromium. Tests use port 3100 (overridable via `TEST_PORT`) and port 3107 for isolated startup checks; those ports must be free. `.env` remains ignored and no new environment variables are required for application localization.


## Required integrity and running-cache verification

Run `npm run localization:check` to compare UI key usage against the current database. `npm test` includes the same check against an isolated schema populated solely by all canonical SQL migrations. Additional negative tests prove missing keys/language rows and key-as-value/TODO/TRANSLATE/blank/dash placeholders are rejected. No translations are stored in the checker; SQL/PostgreSQL remains authoritative.

The small scanner inventories literal `t('semantic.key')` calls in EJS, app/controllers, first-party browser code and the language route. It rejects dynamic calls rather than silently missing them. Finite repeated promotional elements now prepare labels with explicit literal calls. It is not a general parser or a natural-language quality checker; review translations and new client-visible text during each task.

After applying data migrations, refresh every running process. Restart normally, or, for a development-mode Node process, send `SIGUSR2` to its verified application PID (`kill -USR2 <app-pid>`). The development-only handler invokes the existing atomic `localization.reload()` and logs success/failure. Do not signal the npm/tsx supervisor or a production process. Production processes should be restarted after migrations. There is no HTTP refresh endpoint, automatic polling, or per-lookup SQL.

Then run `CHROME_PATH=/usr/bin/google-chrome npm run localization:verify`. It uses the actual server at `http://127.0.0.1:3000` (override with `LOCALIZATION_URL`) instead of starting a fresh one. It checks `/`, `/cpanel`, `/cpanel/login` in tm/ru/en, visible/hidden UI messages and translated attributes against actual database values, and language-selector cookies/rendering. This catches stale running caches that fresh-server regression tests cannot detect.

The current incident was a stale process cache, not absent canonical translations. All 102 rows already existed in the development database and migrations 001/002. Reapplying migration commands was a no-op; restarting the existing watcher-managed process made its login page render the existing values. Do not rewrite applied seed migrations or insert duplicate copies to treat a cache problem.

Authentication-stage live verification creates/removes a temporary random test user to verify the protected CPanel page, generic login errors, CSRF errors and logout in all three languages. It does not need owner credentials. See [CPANEL_AUTH.md](CPANEL_AUTH.md).

Shell stage: migration 005 adds 22 keys / 66 values. Total seeds: 62 keys / 186 values; 60 currently used keys. Live verification now also checks all shell text and accessible/data labels in tm/ru/en. See [CPANEL_SHELL.md](CPANEL_SHELL.md).

Navigation roadmap stage: migration 006 adds 43 keys / 129 tm/ru/en values. Current total is 105 seeded keys / 315 values, 98 used keys. Literal navigation `translationKey` metadata is inventoried alongside literal `t()` calls; configuration stores no translated values. See [CPANEL_NAVIGATION.md](CPANEL_NAVIGATION.md).

Profile UI stage: migration 007 adds 15 semantic keys / 45 actual tm/ru/en values. Current totals are 120 seeded keys / 360 values and 113 used UI keys. The actual-server verifier now includes `/cpanel/profile` and checks every profile translation. Language switching accepts this implemented route as an explicit safe return destination.

Password change stage: migration 008 adds 8 keys / 24 tm/ru/en values; current totals 128 seeded keys / 384 values, 121 used UI keys. The live verifier checks password error/success messages on its disposable account.

Universal uploader stage: migration 009 adds 11 keys / 33 tm/ru/en values. Totals: 190 seeded keys / 570 values; 177 used keys. Uploader code maps stable protocol error codes to translated EJS data attributes. The actual-server verifier also uploads a temporary file and verifies translated state and unchanged profile.

Permissions UI migration 015 adds 13 semantic keys / 39 real tm/ru/en values. Canonical totals are now 203 keys / 609 translations; the integrity inventory includes 191 used UI keys. Live verification covers the permission list, grouped detail labels, unsaved/preview text and unchanged assignments.

Permissions activation migration 016 adds seven keys / 21 real tm/ru/en values: management definitions, read-only/self-edit explanations and saving/success/failure messages. Current totals supersede the UI stage: 210 canonical keys / 630 translations, 197 used UI keys. Live verification now checks persisted grants and actual translated self/read-only states.

Media File Manager UI migration 017 adds 54 keys / 162 real tm/ru/en values. Current totals: 264 canonical keys / 792 translations, 249 used UI keys. Live checks distinguish uploader keys from manager keys in the shared namespace and exercise empty/no-result/limited results plus registry metadata.

Media continuation migration 018 adds seven real tm/ru/en keys (21 values): refresh, notFound, backToRoot, mime, dimensions, children and cacheWarning in cpanel.media. Current totals: 271 canonical keys / 813 values / 256 used UI keys. New manager filesystem fixture tests are isolated; live manager checks are read-only.

Media activation migration 019 adds 13 keys / 39 tm/ru/en values. Current source/database totals: 284 keys / 852 translations; 268 used UI keys. Direct upload success has its own key, distinct from temporary upload success.
