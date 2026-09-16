# Languages — activated registry management

## Storage and scope

Use the existing `languages` registry and `interface_translations`; no duplicate registry or numeric identity. Native Name is existing `display_name`; `code` remains the immutable text PK and existing translation FK target. Migration 052 adds `updated_at timestamptz NOT NULL DEFAULT now()` with the established update trigger, changes new-row `is_active` default to false, and adds a code-immutability trigger. Existing default/active constraints remain. Existing rows receive migration-time `updated_at`; `created_at`, codes, names, flags and translations are preserved. Fresh installation flushes the existing deferred default check before ALTER, then restores deferred behavior.

New languages start inactive and non-default. Exactly one active Default is enforced by existing database constraints; registry mutations serialize with a transaction advisory lock. The current Default cannot be deactivated or unset. Switching Default clears the old flag and activates the new Default atomically. No Delete or translation-edit endpoint exists.

**Owner-approved readiness rule:** an incomplete language may become active, using existing Default fallback. Before it becomes Default, every key of the current Default must have a usable translation (nonblank and not the key itself). Missing keys reject the entire mutation. This does not require translations before Create or ordinary activation.

## Routes, permissions and UI

Authenticated `/cpanel/languages` and GET `/cpanel/api/languages` / `/:code` require `languages.view`. API operations:

- POST `/cpanel/api/languages`: `code`, `name`, optional `sort_order`; requires `languages.create`.
- PATCH `/:code`: only changed `name`/`sort_order` (`languages.update`), `is_active` (`languages.status`), or `is_default: true` (`languages.default`). Each field is authorized independently.
- POST `/:code/status`: `is_active`; requires `languages.status`.
- POST `/:code/default`: empty object; requires `languages.default` and translation completeness. Activation as part of setting Default is included in this permission.

State-changing routes use existing CSRF. The service rechecks live actor/session/exact-boolean permissions in the transaction. Super User uses the existing bypass. Unknown fields, code changes, malformed booleans, invalid code/name/integer order and duplicate codes are rejected safely. No new permission grants or roles.

Approved Grid/List, native name/code live search, All/Active/Inactive filter and sort_order/code ordering remain. Counts come from real interface translations. Create returns the real code and becomes Edit in the same open dialog. Saves are real; failures preserve drafts and allow retry. Mock TR and preview saves are removed. Navigation remains System → Localization → Languages with `languages.view`.

## Cache and localization

After commit the service invalidates and refreshes the existing in-process localization snapshot. A revision counter prevents an older in-flight refresh from hiding a newer mutation. Subsequent requests await refresh if dirty. If immediate refresh fails, the response explicitly distinguishes committed persistence from pending cache refresh; the next request retries. Existing request snapshots remain stable. This follows the current single-application-process deployment; additional independent application processes would need their own refresh/invalidation mechanism.

The response supplies safe active registry options; the topbar updates after mutations. If the selected cookie language becomes inactive, existing resolution uses Default, without rewriting the cookie. Existing content translation components continue using the same active registry. No JSON dictionaries or special language state.

Migration 053 adds four keys with real tm/ru/en values: `cpanel.languages.saved`, `.failed`, `.incomplete`, `.refreshPending`. Migration 051's UI labels remain canonical. Current total: 575 canonical keys / 1,725 required-language values / 53 migrations; 542 used UI keys.

## Verification scope

`tests/unit/languages.test.ts` covers schema preservation, metadata/code validation, search/counts, active/cache fallback, complete Default switching, concurrency/rollback, independent permissions/session revocation and committed-save/refresh-failure semantics. `tests/unit/localization.test.ts` checks snapshot behavior including invalidation races/retries. `tests/unit/database.test.ts` covers fresh migrations, localization integrity, existing constraints, startup/cookies/reload. `tests/languages.spec.ts` runs the production build through real CRUD, reload persistence, default protection, CSRF, permission boundaries, retryable drafts and Light/Dark screenshots.

Targeted tests: 24/24 passed (8 Languages + 6 cache + 8 database/localization + 2 production browser). `localization:check`, scoped live tm/ru/en verification, build and whitespace check pass. Before/after snapshot confirms original en/ru/tm rows and all 1,713 preexisting translations unchanged; Default remains tm. No unrelated Brands/Categories/Discounts/Currencies/Vendor/Stock/Users/Profile suites were run: this change affects the registry/cache and their consumers, covered by the selected integration checks.

Deferred: interface Translation Editor, language deletion/reference policy, Payment Types, Delivery Types, Settings and Products.
