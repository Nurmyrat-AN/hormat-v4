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
| `npm run test:unit` | Run localization service/database/startup tests without browsers |
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

```sh
npx playwright install chromium
npm run db:migrate
npm test
npm run build
TEST_PRODUCTION=1 npm test
```

Alternatively use an existing Chrome installation: `CHROME_PATH=/usr/bin/google-chrome npm test`. `TEST_PORT` overrides the test server's default port of 3100. Tests start and stop their own application server and require the test port to be free. They check all existing foundation behavior plus localization cache/fallback/reload, schema constraints, startup failures, all three languages, cookies and safe switching. The English foundation assertions explicitly select English. See [LOCALIZATION.md](docs/LOCALIZATION.md) for details.

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

## Media File Manager UI review

`/cpanel/media` requires `media.view` (or Super User) and provides real filesystem browsing/search with UI-only mutation dialogs. Catalog → Media remains disabled. See [Media File Manager](docs/CPANEL_MEDIA.md). No Media table or direct File Manager upload/rename/delete API is implemented.
