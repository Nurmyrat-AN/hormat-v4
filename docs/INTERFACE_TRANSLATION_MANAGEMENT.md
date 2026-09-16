# Interface Translation Management

Implemented page: `/cpanel/interface-translations`, under existing System → Localization. The table is intentionally not Grid/List. Active languages define columns and all edit fields. The current Default is marked in Edit.

## Existing storage, not another registry

`interface_translations(language_code, translation_key, translation_value)` remains the sole interface value store. Migration 054 permits NULL value; all original keys/values remain unchanged. Clearing stores NULL rather than deleting a row, so a key remains discoverable even if every translation is cleared. Developers introduce keys through the existing SQL seed workflow. There is no Add, Delete or key-renaming endpoint.

## Resolver

`LocalizationService` precomputes a first-available map on snapshot load:

1. Requested nonblank translation.
2. Current active database Default's nonblank translation.
3. Active languages ordered by sort_order then code, followed by inactive languages in that order.
4. Key.

NULL/empty/whitespace are missing. Only active languages are selectable; inactive values can be final fallback. All t() calls remain memory-only; no per-field SQL. The cache may load an empty dictionary and then return keys as specified, while a missing/ambiguous active Default remains invalid startup data. The existing Languages completeness check before assigning another Default remains.

## API and permissions

- GET `/cpanel/api/interface-translations`: query, prefix, completion=all|missing|complete, language, page. Requires interface_translations.view. Fifty results/page, key order; full-registry total/complete/missing summary. Search includes keys and all stored language values, including inactive languages. Completion counts active explicit usable values only.
- GET `/:key`: active language fields, explicit values and Default marker. Requires view.
- PUT `/:key`: exactly `{values:{code:string|null}}`; requires independent interface_translations.update and CSRF. Submit changed languages only. Server allows only active registry codes, existing key, strings ≤20,000 characters or null; rejects unexpected identity fields/types. Empty/whitespace normalizes to NULL, other text is preserved. Inactive and omitted values stay untouched.

The service validates authority/session and performs all updates in one transaction using the existing registry advisory lock also used by Languages. Unknown keys cannot be created. No mutation touches languages, other keys, or content translations. Safe generic errors leave the editor's draft available for retry. Read-only staff can inspect without usable Save.

Committed changes refresh the existing process cache. Failure to refresh is a distinct saved/pending outcome; next request retries. Multi-process invalidation is outside the existing single-app-process topology.

## UI and localization

Search, derived prefix, completion and missing-language filters share one table. Namespace filter uses cpanel.<second component> or the first component of non-cpanel keys; labels are actual technical prefixes. An explicit missing translation is missing even when runtime fallback succeeds. All new chrome/feedback/permission labels use migration 055's real tm/ru/en database values. Technical keys in the management table are intentional identifiers, not failed UI translations.

Development must still seed every new key with actual tm/ru/en values in the same task. Maintenance UI does not replace canonical development seeds.

## Verification

Targeted suites: interface-translations service, localization cache/resolver, Languages integration, fresh database/migration checks, Permission Definition Registry, and the production Interface Translations browser scenario. Live check: `npm run localization:verify -- --scope=interface-translations`. Normal build and localization integrity checks remain required. Unrelated Catalog, Vendor synchronization and Stock suites are intentionally excluded.

No basic management feature is deferred. Payment Types remains a separate next task.

### Completed verification

34/34 targeted tests passed: 5 management service/transaction tests, 7 localization resolver/cache tests, 8 Languages integration tests, 8 fresh database/localization tests, 3 permission-registry tests, 2 focused navigation tests, and 1 consolidated production browser scenario. Failures found during implementation were corrected and the affected scenarios rerun. Build, localization:check (558 used keys), live tm/ru/en verification and git diff --check passed. Light/Dark screenshots reviewed; narrow viewport overflow check passed. Browser fixtures were removed and the temporary runtime-cache test value restored. No unrelated domain regression ran.
