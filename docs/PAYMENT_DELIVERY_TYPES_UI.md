# Payment Types + Delivery Types UI review

Historical UI-stage report. Superseded by the [approved activation contract](PAYMENT_DELIVERY_TYPES_ACTIVATION.md).

Routes: `/cpanel/payment-types`, `/cpanel/delivery-types`. Both require their own view permission and reuse the current CPanel shell. Sidebar entries stay disabled pending backend activation.

## Shared implementation

- Controller: `src/controllers/cpanel/option-types.ts`.
- One EJS host/content pair: `src/views/cpanel/pages/option-types*.ejs`.
- One browser module and stylesheet: `src/public/cpanel/js/option-types.js`, `src/public/cpanel/css/option-types.css`.
- Reuses TranslatableField, DraftState, MediaPicker, mediaPreview and existing Bootstrap dialog/dropdown components.
- Separate domain routes, mock data and localStorage view keys; no shared persistence between the pages.

Grid/List share Name/Description search, All/Visible/Hidden filtering, integer sort ordering and Edit/Change Visibility menus. Review examples include visible/hidden Payment types and paid/free Delivery types. There is no Delete.

Create requires Name, permits Description and Sort Order (default 0), fixes visibility Hidden and keeps the same dialog open after assigning a mock ID. Icon/translation controls then unlock. Each text field displays all active language overrides simultaneously and saves them independently of Basic Information. Base values remain fallbacks. Closing any unsaved draft warns; no separate Translations tab. Close + main Save use the standard bottom footer.

Icon is a single canonical Media selection; no Gallery/Main Image semantics. Existing Picker handles browse/search/image eligibility/permissions. Change/Clear never physically deletes files. Picker Upload remains the existing real Media operation with its own permission and notice; no new upload implementation exists.

Delivery adds Free Delivery (initial UI default checked), with zero disabled Price. Paid values are nonnegative decimal strings in internal main-currency units. Unchecking Free restores the last paid draft value. Cards show localized Free for free options. No conversion or currency selector. This initial default is for review, not a frozen schema decision.

## Boundaries

All type creation/saves/visibility/translation/Icon associations are page-memory previews with explicit localized notices. Reload resets them. There are no Payment/Delivery tables, CRUD APIs, repositories, services, payment gateway fields, credentials, Order processing or Settings work. Existing Media requests are the only picker integration.

The centralized registry defines view/create/update/visibility for each domain. View-only staff can inspect; controls respect independent capabilities and Media permissions. Backend rules must be enforced when activation is separately requested.

## Localization and verification

Migration 056 seeds 28 new keys / 84 real tm/ru/en values; database applied and live cache refreshed. Canonical totals: 619 keys / 1,857 required-language values / 56 migrations; 586 used UI keys. Content overrides remain separate mock data.

7/7 targeted tests passed: two production browser scenarios (one per domain), three Permission Definition Registry tests, and two fresh migration/localization integrity tests. Scenarios verify Create → Edit, locking, inline fields, real Picker selection/clear without deletion, sorting, visibility, Free/paid decimals/negative rejection, footer alignment, read-only access, mock reset and absence of domain tables/mutation requests. Light/Dark screenshots and narrow layout checked. `npm run build`, `localization:check`, `localization:verify -- --scope=option-types` and `git diff --check` pass. Historical module regression intentionally not run because no domain/shared-component behavior changed.

Ready for UI review. Backend and Settings remain unstarted.
