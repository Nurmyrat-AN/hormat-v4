# HORMAT-code-v4

Technical foundation: one Node.js application with separate Frontend and CPanel routes, controllers, EJS views, and public assets, plus shared database-backed interface localization. CPanel now has real email/password authentication and direct per-user JSONB permissions; no marketplace business modules exist.

## Architecture and development rules

Read [the permanent architecture rules](docs/ARCHITECTURE.md) before modifying the project. They are the default source of truth unless the project owner explicitly changes a rule. [AGENTS.md](AGENTS.md) provides the coding-agent entry point, and [development permissions](docs/DEVELOPMENT_PERMISSIONS.md) records the local command-approval approach and current limitations.

## Requirements and setup

- Node.js 22 or newer and npm.
- PostgreSQL with an existing empty database and valid credentials.

```sh
npm ci
cp .env.example .env
# Edit .env with your PostgreSQL connection details.
npm run db:migrate
npm run cpanel:bootstrap # Interactive name/email and hidden password
npm run dev
```

Open `http://127.0.0.1:3000/` or `http://127.0.0.1:3000/cpanel`.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run cpanel:bootstrap` | Explicit initial Super User setup with hidden password input |
| `npm run cpanel:bootstrap:production` | Initial Super User setup from the compiled build |
| `npm run dev` | Prepare npm browser assets and run TypeScript with automatic restart |
| `npm run localization:check` | Check all used UI keys against current database values |
| `npm run localization:verify` | Verify translations on the already-running server (default port 3000) |
| `npm run typecheck` | Validate TypeScript without generating output |
| `npm run db:migrate` | Apply pending SQL migrations and seed data |
| `npm run db:migrate:production` | Apply migrations from the compiled build |
| `npm run build` | Clean dist, compile TypeScript, and copy views and browser assets |
| `npm start` | Run the compiled application |
| `npm test` | Run service/database tests and all browser/HTTP regression checks |
| `npm run test:unit` | Run all unit/service/database tests without browsers |
| `TEST_PRODUCTION=1 npm test` | Run the same checks against the existing compiled build |

## Environment

`.env` is ignored; `.env.example` contains placeholders only. Required PostgreSQL fields are `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD`. The password must be defined but may be empty for a local trust-authenticated database. Ports must be integers from 1 to 65535.

`NODE_ENV` accepts `development` (default), `test`, or `production`. `HOST` defaults to `127.0.0.1`; `PORT` defaults to `3000`. To accept connections on external interfaces, explicitly set `HOST=0.0.0.0`.

Missing/invalid configuration fails startup with a clear error. Create the database and explicitly run migrations before starting the app. Startup loads localization from PostgreSQL before opening the HTTP listener. Connection failures, missing tables, or unusable initial language data prevent startup. After successful initialization, translations are served from memory. `GET /health` checks live database connectivity: `200` after `SELECT 1`, or `503` when unavailable. See [localization documentation](docs/LOCALIZATION.md).

## Structure

```text
src/
  app/index.ts                  Express setup, static mounts, health, errors
  config/env.ts                 Validated environment and configuration
  database/
    pool.ts                     Shared pg pool and SELECT 1 check
    migrate.ts                  Transactional SQL migration runner
    migrations/                 Localization schema and seed SQL
  localization/                 Repository, cache, cookie middleware/route
  controllers/
    frontend/index.ts
    cpanel/index.ts
  routes/
    frontend/index.ts
    cpanel/index.ts
  views/
    frontend/{layouts,partials,pages}/
    cpanel/{layouts,partials,pages}/
  public/
    frontend/{css,js,images}/
    cpanel/{css,js,images}/
    vendor/                     Generated npm assets; ignored
  socket/index.ts               Socket.IO initialization
  server.ts                     Shared HTTP server and graceful shutdown
scripts/
  assets.mjs
  clean.mjs
tests/foundation.spec.ts
playwright.config.ts
tsconfig.json
.env.example
package.json
package-lock.json
dist/                           Generated production output; ignored
```

## CPanel login

Open `/cpanel/login` for the localized login UI. It includes a working language selector, password toggle and real server-side authentication. Run migrations before starting the app. See [login documentation](docs/CPANEL_LOGIN.md) for the design, image source, and product constraints.

## Pages and assets

- `GET /` renders the localized Frontend heading/title (English: **Frontend**).
- `GET /cpanel` renders the localized CPanel heading/title (English: **CPanel**).
- Turkmen (`tm`) is the seeded default. A valid active-language `hormat_lang` cookie selects another language across both areas.
- `POST /language` accepts URL-encoded `language` and optional `returnTo` (`/`, `/cpanel`, or `/cpanel/login`), sets the cookie, and redirects with HTTP 303. The login page provides a selector; no language-management pages are added.
- Each area has separate templates and assets. Authenticated CPanel pages use a shared application layout; login remains separate.
- Bootstrap CSS/bundle and jQuery are installed through npm and copied into a shared public vendor directory. No external CDN is required.
- Socket.IO serves its client at `/socket.io/socket.io.js` and shares Express's HTTP server. Each page initializes its own connection (`window.frontendSocket` or `window.cpanelSocket`). Connection/disconnection logs are development-only. There are no business events. HTTP/EJS remains the primary page flow.
- Unmatched routes return plain-text 404; unexpected request errors return a generic 500 and are logged server-side.
- SIGINT/SIGTERM close Socket.IO, HTTP, and the PostgreSQL pool, with a ten-second shutdown limit.

## Production

```sh
npm run build
npm run db:migrate:production
NODE_ENV=production npm start
```

`dist/` includes the compiled code, SQL migrations, EJS templates, custom static files, and copied vendor assets. Paths resolve relative to the application files, not the working directory. A production installation needs `dist/`, `package.json`, `package-lock.json`, runtime dependencies (`npm ci --omit=dev`), and environment configuration. Source files are unnecessary at runtime. Set `NODE_ENV=production` in the deployment environment; `npm start` respects it.

## Verification

Tests need a running PostgreSQL development/test database configured through `.env` or environment variables, applied migrations, and a Chromium browser. Database integration tests create and drop a uniquely named test schema; the database role needs schema-creation permission. They do not change the application schema. Do not run development tests against a production database:

Use [risk-based regression](docs/ARCHITECTURE.md#42-permanent-risk-based-testing-strategy): select the changed module and affected integrations from actual code changes. Preserve all tests; `npm test` remains the full checkpoint command, not a mandatory command after every isolated task. Own test/build failures block completion.

Example targeted Vendor verification (run from the project root):

```sh
npm run build
node --import tsx --test tests/unit/vendors.test.ts tests/unit/vendors-preview.test.ts tests/unit/permission-registry.test.ts tests/unit/permissions.test.ts tests/unit/auth.test.ts tests/unit/navigation.test.ts tests/unit/database.test.ts tests/unit/translation-integrity.test.ts tests/unit/localization.test.ts
npm run localization:check
TEST_PRODUCTION=1 CHROME_PATH=/usr/bin/google-chrome npx playwright test tests/vendors.spec.ts tests/vendors-navigation.spec.ts tests/auth.spec.ts tests/navigation.spec.ts --project=core
```

This covers Vendor CRUD/encryption, permission registry/service and management integration, authentication/CSRF, fresh migrations/translation integrity and navigation. It intentionally excludes unrelated deep Media/Profile/Users suites when their code/shared dependencies have not changed. This is an example, not a fixed universal test list: reassess scope for each change.

Full checkpoints (explicit requests, releases/deployments, major module groups/refactoring, architecture-wide or critical authentication/security changes, and periodic checks after several modules):

```sh
npm run build
TEST_PRODUCTION=1 CHROME_PATH=/usr/bin/google-chrome npm test
```

Install Chromium with `npx playwright install chromium` when needed; omit `CHROME_PATH` to use the installed Playwright browser. `TEST_PORT` overrides port 3100. Browser tests start/stop their own server; the test port must be free. Apply pending approved migrations before tests. All historical suites remain available; no test is removed or weakened by selecting a smaller run.

Reports must list new tests run (or none), related regression run, build result, suites intentionally omitted and the risk-based reason. Never call a targeted run a full regression. For documentation-only work, check completeness/links unless runtime verification is requested. New localization text still requires complete database values and affected running-UI/cache verification; see [LOCALIZATION.md](docs/LOCALIZATION.md).

## Future module workflow

Discuss requirements → mock CPanel UI → review workflow and improve UX → finalize business rules → design and approve schema → migrations → backend/service/repository → connect real data → API where required → module and regression tests → fix problems → freeze module.

Follow the complete workflow and approval rules in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Mock UI does not authorize automatic backend/database implementation. This foundation stops before all business functionality.


After translation data changes, reload/restart existing servers as well as running tests. For development, the verified Node application PID accepts `SIGUSR2` to reload the database cache. Run `npm run localization:check` and `CHROME_PATH=/usr/bin/google-chrome npm run localization:verify` to check the current database and browser-visible values on the running server. See the [cache/integrity workflow](docs/LOCALIZATION.md#required-integrity-and-running-cache-verification).

## CPanel authentication

See [CPANEL_AUTH.md](docs/CPANEL_AUTH.md) for exact schema, bootstrap, permissions, secure sessions, routes and deployment requirements. `/cpanel` requires login; `/cpanel/login` retains the approved design. Bootstrap is never automatic. Runtime tests create temporary random accounts and clean them up; they do not modify owner credentials.

## Main CPanel shell

Authenticated `/cpanel` uses the reusable sidebar/topbar/content shell, with local light/dark and sidebar preferences. See [CPANEL_SHELL.md](docs/CPANEL_SHELL.md) for navigation configuration, EJS integration, responsive behavior and verification. No dashboard or business modules are included.

## Navigation roadmap

The sidebar now shows the approved [CPanel navigation roadmap](docs/CPANEL_NAVIGATION.md). Future pages are visibly disabled; the existing foundation remains accessible. No future routes or modules are implemented by adding entries.

## Current-user profile UI

Authenticated users can open `/cpanel/profile` through **My Profile** in the topbar menu. Basic Information saves name, phone and avatar; job and email remain read-only. Change Password now requires the current password, keeps the current session and invalidates other sessions for that user; see [password documentation](docs/CPANEL_PASSWORD.md). See [profile documentation](docs/CPANEL_PROFILE.md). Users management has a separate permission-protected administrative workflow.

## Universal temporary uploads

The profile now supports immediate temporary upload of **any file**, real progress, token-based preview and removal/reselection. Profile Save now finalizes the token to users/avatars and persists its final URL. See [Media V1](docs/MEDIA.md) and the [exact contract](docs/MEDIA_UPLOAD_CONTRACT_V1.md). Files use `MEDIA_ROOT` (default `.media`), with a 24-hour cache TTL; no default file-size or format restriction is enabled.

## Users management UI

`/cpanel/users` provides real PostgreSQL search, Grid/List and Add/Edit/Status/Password dialogs. Users permissions and Super User target protection are enforced server-side. Account status belongs to `cpanel_user_auth.is_active`; deactivation and admin password changes invalidate all target sessions. See [Users UI contract](docs/CPANEL_USERS.md).

The full `npm test` command runs unit/integration tests, then the `core` and `users` Playwright projects in separate sequential invocations. Each starts a fresh test server, so the expanded login scenarios do not exhaust another suite's real 30-attempt login rate limit. No rate-limit bypass is enabled. For focused runs use `npx playwright test --project=users` or `--project=core`.

## Permissions Management UI

Permissions Management uses independent `permissions.view` and `permissions.update` rights, with the existing Super User bypass. `/cpanel/permissions` lists real users; grouped detail switches save assignable permissions atomically through `/cpanel/api/permissions/:userId`. Self-edit and Super User target edits are forbidden. See [Permissions Management](docs/CPANEL_PERMISSIONS.md) for the frozen registry contract, sparse assignments and immediate permission refresh.

## Media File Manager

`/cpanel/media` requires `media.view` (or Super User) and provides filesystem browsing/search and approved direct upload, folder creation, rename, move and permanent deletion. Direct uploads accept all types up to 10 MB per file; Profile/Users keep their separate cacheToken workflow. See [Media File Manager](docs/CPANEL_MEDIA.md). No Media database catalog exists. Rename requires GNU coreutils with `--no-copy --update=none-fail` (tested 9.7/Linux). See [activation report](MEDIA_FILE_MANAGER_ACTIVATION_REPORT.md) for navigation and verification status.

## Vendors / CouchDB Suppliers

`/cpanel/vendors` provides persistent configuration CRUD with independent view/create/update/status permissions. CouchDB passwords use AES-256-GCM. Before any application/migration/test command, configure `VENDOR_CREDENTIALS_KEY` as 64 hexadecimal characters (32 random bytes); keep it stable and securely backed up. See [Vendors](docs/CPANEL_VENDORS.md) for key handling, API, URL normalization and verification. The opt-in [durable Vendor synchronization](docs/DURABLE_VENDOR_SYNC.md) uses Nano, PostgreSQL checkpoints and transaction-derived stock snapshots. Set `VENDOR_SYNC_ENABLED=true` only in environments that should contact configured Vendors; it defaults to false. Source storage and durable progress are implemented; Source Products UI and the HORMAT Products domain remain outside this stage.

### Vendor synchronization reset

See [Reset Sync Data contract](docs/VENDOR_RESET_SYNC.md) for the selected-Vendor administrative action, permissions, preserved source data and restart/failure semantics. Targeted tests: `node --import tsx --test tests/unit/vendor-reset.test.ts` and `npx playwright test tests/vendor-reset.spec.ts --project=core`. Set `TEST_PRODUCTION=1` after `npm run build` to exercise the built runtime.

## Brands module

Authenticated `/cpanel/brands` is PostgreSQL-backed and enabled under Catalog for staff with `brands.view` (or Super User). Approved Create → Edit, inline Name translations, dedicated Main Image, ordered Gallery and independent saves are active. New Brands stay Hidden until explicitly published by staff with `brands.visibility`. The reusable filesystem Media Picker uses existing browse/upload services; no physical Media copy or deletion is performed by Brands.

Brands also has canonical slug, independently translated SEO fields and real Product counts. Its Products tab supports shared immediate attachment/detachment and confirmed Brand moves. SEO has its own tab and independent Save SEO action. See architecture sections 53–54.

See [Brands contract and exact schema](docs/CPANEL_BRANDS.md), [Media Picker](docs/MEDIA_PICKER.md), [activation report](BRANDS_ACTIVATION_REPORT.md), and [focused acceptance](docs/BRANDS_ACCEPTANCE.md).

Focused verification:

```sh
npm run build
node --import tsx --test tests/unit/brands.test.ts tests/unit/content-editor.test.ts tests/unit/permission-registry.test.ts tests/unit/navigation.test.ts
TEST_PRODUCTION=1 CHROME_PATH=/usr/bin/google-chrome npx playwright test tests/brands.spec.ts --project=core
CHROME_PATH=/usr/bin/google-chrome node --import tsx scripts/verify-brands-ui.ts
```

The live verification defaults to port 3000 (`LOCALIZATION_URL` overrides), checks database translations and durable authoring with a temporary staff account/Brands, then cleans up those records. It does not upload files to production Media. Broader checks remain risk-based; see architecture section 42.

## Categories module

`/cpanel/categories` provides the persistent recursive folder browser and shared content editor under `categories.view`. See [Categories contract](docs/CPANEL_CATEGORIES.md). Parent moves are cycle-checked, independent saves persist in PostgreSQL, and direct/recursive counts use nullable products.category_id. Direct Product attachment management is active; Category deletion remains deferred.

## Discounts module

`/cpanel/discounts` uses persistent discounts, discount_translations and product_discounts under independent discounts.view/create/update/visibility permissions. Basic, Rules and inline Name translations save independently with the approved footer. Counts are real; Products supports shared immediate attachment/detachment. Percent rules accept 0–100, decimal values use NUMERIC, and the name-on-product flag is presentation-only. Pricing, winner selection and Delete remain deferred. See [Discounts contract](docs/CPANEL_DISCOUNTS.md).

## Currency Configuration

Marketplace → Currencies opens persistent `/cpanel/currencies/frontend` and `/cpanel/currencies/vendors`. Frontend currency/name overrides and manual Vendor rates use PostgreSQL; synchronized Vendor currencies remain the source registry. Missing rates display Not configured and use effective 1 only in the centralized NUMERIC conversion helper. No Product integration exists yet. See [Currency Configuration](docs/CPANEL_CURRENCIES.md). Focused live localization: `npm run localization:verify -- --scope=currencies`.

## Languages registry management

System → Localization → Languages opens authenticated `/cpanel/languages` under languages.view. Create/Edit/status/default persist to the existing registry with independent permissions and CSRF. New languages start inactive; code is immutable. An incomplete active language falls back to Default; assigning Default requires all current Default keys. Changes refresh the localization cache. No duplicate registry, Delete or translation editor. See [Languages contract](docs/CPANEL_LANGUAGES.md). Scoped live check: `npm run localization:verify -- --scope=languages`.

## Interface Translation Management

System → Localization → Interface Translations opens `/cpanel/interface-translations`. Search/filter existing keys, find missing active-language values and edit translations under independent view/update permissions. No Add/Delete keys. Central fallback is requested → current Default → deterministic any available → key. Clearing retains keys with NULL and refreshes runtime cache. See [contract](docs/INTERFACE_TRANSLATION_MANAGEMENT.md). Scoped live check: `npm run localization:verify -- --scope=interface-translations`.

## Payment Types + Delivery Types

Both modules are PostgreSQL-backed with permission-aware navigation, inline translations, Media Icon, optional visible Default and Delivery free/decimal price configuration. See [activation contract](docs/PAYMENT_DELIVERY_TYPES_ACTIVATION.md). Live localization: `npm run localization:verify -- --scope=option-types`.

## Marketplace Settings

System → Settings (`/cpanel/settings`) manages Language, Frontend Currency, Payment and Delivery defaults atomically under settings.view/settings.update. Only currency default is stored in the typed Settings registry; existing domain defaults remain authoritative. Current Default Currency cannot be hidden. See [contract](docs/MARKETPLACE_SETTINGS.md). Focused localization: `npm run localization:verify -- --scope=settings`.

## Order Statuses

Marketplace → Order Statuses (`/cpanel/order-statuses`) provides persistent configuration, inline Name/Description translations, a Media Icon and optional visible Default. It reuses Payment Types components under order_statuses.view/create/update/visibility. See [contract](docs/ORDER_STATUSES.md). No Orders workflow or Delete exists.
