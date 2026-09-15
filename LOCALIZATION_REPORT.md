# HORMAT-code-v4 — Interface localization completion report

## Outcome

The requested shared, database-backed interface-localization foundation is implemented and ready for review. Both Frontend and CPanel use it. No unrelated business functionality, entity/content translations, management pages, authentication, external translation services, Redis, or socket localization events were added.

## Database

Created and applied `src/database/migrations/001_interface_localization.sql`, including the initial seed. The previously empty migration directory now has a small transactional raw-SQL runner with locking and an applied-migration ledger. No ORM or new dependency was introduced.

- `languages`: `code text PRIMARY KEY`, `display_name text NOT NULL`, `is_active boolean NOT NULL DEFAULT true`, `is_default boolean NOT NULL DEFAULT false`, `sort_order integer NOT NULL DEFAULT 0`, `created_at timestamptz NOT NULL DEFAULT now()`.
- `interface_translations`: `language_code text NOT NULL`, `translation_key text NOT NULL`, `translation_value text NOT NULL`; composite primary key `(language_code, translation_key)`; foreign key to `languages.code` with update/delete cascade.
- Constraints validate language codes, dotted semantic keys, and nonblank names/values. A partial unique index permits at most one default. A check requires the default to be active. A deferred constraint trigger prevents transactions leaving no default, and a truncate guard prevents bypassing that row-level check.
- The additional technical table `schema_migrations(name, applied_at)` tracks migration execution. It is not a localization or business domain.

Initial active languages: `tm` — Türkmen (**default**), `ru` — Русский, `en` — English. The database controls future defaults and supported languages.

Six seeded keys, each translated into all three languages (18 values):

- `frontend.title`
- `cpanel.title`
- `errors.notFound`
- `errors.internalServer`
- `errors.invalidLanguage`
- `errors.invalidRequest`

Full column constraints and translation values are documented in `docs/LOCALIZATION.md`.

## Runtime and routes

A dedicated repository reads active languages/translations in a consistent PostgreSQL transaction. The service builds an in-memory snapshot, exposes `load()`, `reload()`, `translate(language, key)` and request-bound helpers, and replaces snapshots atomically. Failed reloads preserve the previous good cache. Additional languages require database/seed data, not new runtime branches.

Startup awaits cache loading before accepting HTTP/Socket.IO connections. Unavailable PostgreSQL, missing localization tables, or unusable initial cache data cause a clear error and nonzero exit. Migrations must be run explicitly before startup.

**Does normal translation lookup perform PostgreSQL queries per `t()` call? NO. It reads the in-memory cache only.**

EJS receives `t(key)`, `language`, and an ordered `languages` list. The existing two pages use escaped translation expressions for headings/titles and set their document language. Their UI remains minimal. Fallback is requested language → default language → key. Missing-key warnings are deduplicated and bounded in development.

Cookie: `hormat_lang`, active-language validation, default fallback for missing/invalid/inactive values, `Path=/`, `SameSite=Lax`, `HttpOnly`, one-year lifetime, and `Secure` in production. Production requires HTTPS.

New route: `POST /language` with URL-encoded `language` and optional `returnTo`. Valid requests set the cookie and return HTTP 303 to `/cpanel` when explicitly selected, otherwise `/`. Invalid languages return localized 400 without setting a cookie. Only the two existing pages are allowed redirect destinations. Oversized form bodies return localized 413.

Existing `/`, `/cpanel`, `/health`, static assets, and Socket.IO remain available after successful startup. Error responses are localized; technical health/log output remains technical.

## Files created/modified

Created:

- `src/database/migrate.ts`
- `src/database/migrations/001_interface_localization.sql`
- `src/localization/{index,repository,service,http}.ts`
- `tests/unit/{database,localization}.test.ts`
- `tests/localization.spec.ts`
- `docs/LOCALIZATION.md`
- `LOCALIZATION_REPORT.md`

Modified:

- `src/app/index.ts`, `src/server.ts`
- `src/views/frontend/pages/index.ejs`, `src/views/cpanel/pages/index.ejs`
- `scripts/assets.mjs`, `package.json`, `playwright.config.ts`
- `tests/foundation.spec.ts` (explicitly selects English to preserve foundation expectations)
- `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT_PERMISSIONS.md`, `README.md`

Architecture section 23 permanently requires stable semantic keys, seed/source entries, translations for every supported required language, and use of those keys in the same task that introduces visible UI text. Original sections 1–22 were checked and remain unchanged. Shared infrastructure authorization does not alter the UI-first rule for business modules.

## Executed verification

- `npm run db:migrate`: passed; migration 001 applied to the configured local development database.
- `npm run db:migrate:production`: passed; compiled runner correctly skipped the already-applied migration.
- `npm run build`: passed; compiled JavaScript, EJS/assets and SQL migration files generated.
- `npm run typecheck`: passed.
- `CHROME_PATH=/usr/bin/google-chrome npm test`: **11 Node tests + 10 browser/HTTP tests passed**.
- `TEST_PRODUCTION=1 CHROME_PATH=/usr/bin/google-chrome npm test`: **11 Node tests + 10 browser/HTTP tests passed**.
- All four existing foundation regression tests passed in both modes: pages/assets, Bootstrap styling/behavior, jQuery, Socket.IO, database health and 404 behavior.
- Localization checks passed for complete initial seeds, database constraints, migration reruns, memory-only lookup, fallback, missing-key behavior, cache consistency/reload/failure, extra and inactive languages, cookie parsing/switching/security flags, all languages on both pages, escaping, redirect safety, startup failure and graceful shutdown.
- Documentation: 14 local links and code fences checked; original architecture sections preserved; compiled migration SQL matched source.

Database integration tests created/dropped only isolated test schemas. The initial sandboxed test attempt could not complete the database tests; approved executions passed. Persistent migration-command prefixes were confirmed. Intentional oversized-request tests generated expected server error logs; inherited terminal-color warnings were harmless.

## Remaining notes

No known implementation failures or unresolved regressions remain. Local development still uses the temporary PostgreSQL instance configured during the foundation stage; permanent deployment database provisioning is outside this task. Apply migrations to each deployment database and restart/reload each application process after changing translations. No public cache-reload endpoint or management UI exists by design.

Work stopped at the requested localization foundation. No next module was started.
