# Attached Products

Brands, Categories and Discounts share `content/attached-products.js` and its EJS partial. The reusable content editor and Discount editor mount the same component. Other Basic/SEO/Rules/translation/Gallery drafts are untouched. Search uses the existing AsyncAutocomplete debounce, cancellation, keyboard, retry, pagination and selected-ID handling.

## API

- `GET /cpanel/api/products/attachments/:kind/:parent?page=1` reads direct attached Products, ordered by Name then ID.
- Add `lookup=1&query=...` for literal server Name search excluding current attachments; optional `selected=ID` hydrates an eligible identity. Pages contain at most 20 items plus hasMore/nextPage.
- `POST .../attach`: `{product_id}`; an existing different Brand/Category returns 409 PRODUCT_MOVE_REQUIRED with safe current/destination names and currentId. Only explicit Move resubmits `{product_id,expected_parent_id}`. Stale parent confirmation fails safely. Cancel sends no mutation.
- `POST .../detach`: `{product_id}`; verifies current ownership. Discount unlink removes only that pair.

Kind is allowlisted to brands/categories/discounts. GET requires domain.view and products.view; writes require domain.update and products.view independently, plus authentication and CSRF. No new permission. The product row lock serializes changes with Product Edit; same authoritative foreign keys/pairs are used in both directions. Missing/false permissions deny, exact Super User bypass applies.

Counts are computed, never stored: Brand direct; Category direct plus recursive subtree; Discount pair count. After changes, the current count and parent browser refresh without closing/replacing unsaved editor drafts. Lists/search do not preload all Products. Primary images reuse controlled Media previews; missing files retain placeholder behavior.

Selection saves immediately. Success clears/refocuses search; failure retains selection and does not add a fictitious row. Detach uses the existing three-dot action convention. No Save Products, reordering, Product deletion or automatic hiding. Mutation errors are localized and server internals are not returned.

Migration 077 adds only eight interface keys / 24 real tm/ru/en values. No business schema change. Existing domain/relationship tables remain authoritative. There is no existing comparable audit-history infrastructure; this task does not introduce one.

## Focused verification

`tests/attached-products.spec.ts` covers the three editors and shared HTTP contract: pagination/exclusion, immediate attach/clear, failure/retry, move/cancel/stale checks, detach, counts/subtree separation, unchanged Product fields, Product read consistency, permissions and CSRF. `scripts/verify-attached-products-localization.ts` checks live tm/ru/en and light/dark on all three pages with disposable fixtures. Fresh-migration localization tests and production build complete this scope. Unrelated historical domain suites are intentionally omitted.

### Verification results

- New browser/API acceptance: 4/4 passed.
- Existing reverse Product → Discount integration: 2/2 passed.
- Fresh migration/translation integrity: 2/2 passed (776 keys, 2,328 values, 77 migrations; 727 used UI keys).
- Current development database localization check passed; migration 077 applied and running cache reloaded.
- Live browser: all three pages in tm/ru/en, immediate attach/detach and light/dark smoke passed (nine page/language combinations).
- `npm run build` and `git diff --check`: passed.
- Historical Catalog CRUD, Vendor Sync, Stock, Media, Profile and Users suites were not executed: this change is confined to relationship operations and their shared UI; the directly shared reverse Discount flow was exercised.
