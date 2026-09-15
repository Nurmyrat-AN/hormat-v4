# HORMAT-code-v4 — Permanent Architecture and Development Rules

Established by the project owner on 2026-09-15. This document is the default source of truth for project architecture and development unless the owner explicitly changes a rule later. Keep it updated when such a change is authorized; do not silently rewrite established rules.

Read this document before modifying the project. [AGENTS.md](../AGENTS.md) is the entry point for future coding-agent sessions; [README.md](../README.md) describes setup and commands. Historical stage reports record work completed at their respective stages and do not override these rules.

Sections 1–22 preserve the owner's original supplied rules. Section 22 records the scope of that documentation stage; future implementation still requires a separately requested task. Later sections record explicitly authorized additions. These rules do not authorize unrequested modules, database schemas, or business functionality.

---

## 1. Main development philosophy

HORMAT-code-v4 is being rebuilt from scratch.

Previous HORMAT versions may contain useful ideas and business knowledge, but their architecture, database schema, tables, APIs, and implementation must NOT automatically be copied into V4.

V4 must evolve module by module.

One of the main reasons for this approach is that important business requirements often become clear only when we actually design and use the Control Panel interface.

Therefore:

**Do not design the database first.**

**Do not design the backend first.**

For business modules, the Control Panel comes first.

---

## 2. Permanent module workflow

Every new business module should normally follow this sequence:

```text
1. Discuss module requirements
        ↓
2. Build CPanel UI using mock data
        ↓
3. Review the real workflow in the CPanel
        ↓
4. Discover missing requirements / improve UX
        ↓
5. Finalize business rules
        ↓
6. Design database schema
        ↓
7. Review and approve database schema
        ↓
8. Create migrations
        ↓
9. Implement backend/service/repository logic
        ↓
10. Connect CPanel to real backend/data
        ↓
11. Implement API where required
        ↓
12. Run module tests + full regression tests
        ↓
13. Fix all discovered problems
        ↓
14. Freeze the completed module
```

Do not skip directly from an idea to database implementation.

A mock CPanel implementation is allowed and encouraged before the database exists.

---

## 3. One module at a time

Do not attempt to build the entire marketplace architecture in advance.

We will work domain by domain.

Possible future domains include things such as:

* Users
* Permissions
* Media
* Vendors
* Brands
* Categories
* Products
* Discounts
* Customers
* Cart
* Orders
* Notifications
* Live Chat
* Settings
* Search
* etc.

This list is informational only.

DO NOT create these modules now.

DO NOT create their tables now.

DO NOT infer their schemas now.

When we reach a module, its exact requirements will be discussed again.

---

## 4. Project areas

HORMAT-code-v4 is one Node.js application containing multiple logical application areas.

### Public Frontend

Base URL:

`/`

Customer-facing marketplace/storefront.

Its code, views and static assets must remain logically separated from CPanel.

### Control Panel

Base URL:

`/cpanel`

Internal management application.

Its code, views and static assets must remain logically separated from Frontend.

### Future API

When APIs are actually required, they should be introduced deliberately and kept logically separated from EJS page routes.

Do not create large speculative APIs before they are needed.

---

## 5. Technology direction

Current core stack:

* Node.js
* TypeScript
* Express
* EJS
* PostgreSQL
* raw SQL using `pg` / node-postgres
* Socket.IO
* Bootstrap
* jQuery

Do not introduce major frameworks or architectural dependencies without explicit approval.

In particular, do not automatically introduce:

* React
* Vue
* Angular
* Next.js
* Prisma
* Sequelize
* TypeORM
* Drizzle
* other ORMs
* unnecessary microservices

Keep the architecture understandable and practical.

---

## 6. EJS responsibility

EJS is the server-rendered presentation layer.

It must not become the location of business logic.

Views should primarily render prepared data.

Avoid complex business decisions directly inside EJS templates.

---

## 7. CPanel architecture

CPanel is extremely important in V4.

It is not something we build after the backend is finished.

For each management domain, CPanel is used to help discover and finalize the actual business requirements.

Therefore we may initially build screens with mock data such as:

```text
/cpanel/users
/cpanel/products
/cpanel/categories
```

before corresponding PostgreSQL tables exist.

This is intentional.

Do not interpret mock UI as incomplete backend work that needs to be automatically filled in.

Wait for explicit instructions before creating the database/backend for that module.

---

## 8. Frontend and CPanel separation

Even though Frontend and CPanel share one Node.js application, keep their presentation layers separated.

Conceptually:

```text
routes/
  frontend/
  cpanel/

controllers/
  frontend/
  cpanel/

views/
  frontend/
  cpanel/

public/
  frontend/
  cpanel/
```

Shared infrastructure may be reused where appropriate, but avoid turning Frontend and CPanel into tightly coupled UI code.

---

## 9. Business logic separation

When real business logic is eventually implemented, it must not live only inside CPanel controllers.

CPanel is one consumer of the application's business logic.

Conceptually:

```text
CPanel
       \
        \
         Business / Service Layer
        /
       /
API / other consumers

          ↓

Repository / Data Access

          ↓

PostgreSQL
```

For example, future operations may conceptually look like:

```text
productService.create()
productService.update()
productService.getById()
```

rather than duplicating product rules inside CPanel and API controllers.

Do not create speculative services now. Apply this rule when real modules are implemented.

---

## 10. PostgreSQL rules

PostgreSQL is the primary relational database.

Use `pg` / node-postgres and raw SQL.

Do not introduce an ORM unless explicitly approved later.

Database schema must be deliberate.

Do not create fields, relations or tables simply because they "might be useful later."

Every business table should have a known reason to exist.

Database changes should eventually be managed through migrations.

---

## 11. Socket.IO architecture

Socket.IO is part of the HORMAT foundation.

It will eventually support real-time functionality such as:

* live chat;
* notifications;
* new order events;
* status changes;
* online/session-related events;
* stock-related updates where appropriate;
* other real-time functionality.

However:

Socket.IO must NOT become the primary data transport for ordinary application pages.

Normal flow remains:

```text
Browser
   ↓
HTTP / EJS / API
   ↓
Application
```

Socket.IO supplements this with:

```text
Server
   ↓
real-time event
   ↓
Browser
```

Keep socket infrastructure separated from domain-specific socket handlers.

Do not create speculative business socket events.

---

## 12. Bootstrap and jQuery

Bootstrap and jQuery are intentionally part of the CPanel/frontend foundation.

We want to be able to implement rich UI functionality without introducing a full SPA framework.

Client-side JavaScript may be used for:

* modals;
* AJAX/fetch requests;
* dynamic forms;
* live search;
* filtering;
* autocomplete;
* sortable UI;
* media upload;
* partial updates;
* notifications;
* Socket.IO events;
* other interactive behavior.

Keep JavaScript organized.

Do not accumulate all frontend logic into one huge JS file.

As modules grow, organize client-side code by responsibility/module.

---

## 13. Do not over-engineer

This is an important permanent rule.

Prefer the simplest architecture that correctly supports the current requirement.

Do not create:

* unnecessary abstractions;
* generic frameworks inside the project;
* speculative repositories;
* unused interfaces;
* empty service hierarchies;
* future-proof tables without current requirements;
* excessive dependency injection;
* unnecessary microservices;
* complicated event systems for simple operations.

The project will become large naturally.

Complexity should be introduced only when a real requirement justifies it.

---

## 14. UI-first does NOT mean UI-only

The CPanel mock phase exists to understand the module.

Once the module requirements are finalized, it must still receive proper:

* database design;
* validation;
* backend business rules;
* security;
* permissions where applicable;
* error handling;
* tests;
* audit/history behavior where required;
* API behavior where required.

Do not use UI validation as a replacement for server-side validation.

---

## 15. Security

Never trust browser input.

Even though CPanel is internal, all important validation and authorization must eventually be enforced server-side.

Do not rely solely on:

* hidden buttons;
* disabled inputs;
* client-side JavaScript;
* EJS conditions

for security.

Exact authentication and permissions architecture will be designed when we reach those stages.

Do not invent it now.

---

## 16. Testing and regression rule

As HORMAT V4 grows, completed functionality must remain protected.

For every completed future stage/module:

1. run tests for the new functionality;
2. run the relevant existing regression suite;
3. verify that previously completed functionality still works;
4. fix regressions before declaring the stage complete.

A stage must not be reported as successfully completed if known tests are failing.

Never claim a test was executed unless it was actually executed.

---

## 17. Changes to frozen modules

Once we explicitly declare a module/domain frozen, do not silently change its database schema or business rules while implementing another module.

If another module requires a change to a frozen domain:

STOP and report:

* what change appears necessary;
* why it is necessary;
* which existing behavior/schema would be affected.

Wait for approval before making the architectural change.

---

## 18. Documentation

Maintain a clear architecture/development-rules document inside the repository.

It should allow a future Codex session to quickly understand:

* project philosophy;
* technology stack;
* Frontend/CPanel separation;
* UI-first workflow;
* database rules;
* Socket.IO role;
* testing rules;
* frozen-domain rule;
* prohibition against speculative architecture.

Keep it updated when I explicitly change an architectural rule.

Do not silently rewrite established rules.

---

## 19. Command execution permissions

At the beginning of the work, request the broadest reasonable persistent permission available in the Codex environment for normal LOCAL development commands required by this project.

The goal is to avoid interrupting development by asking me to press `Allow` repeatedly for routine commands.

Where the Codex environment supports persistent approval / command-prefix approval / session approval, request it appropriately for routine development operations such as:

* npm install / npm ci;
* npm scripts;
* TypeScript compilation;
* tests;
* local Node.js execution;
* local development server commands;
* file and directory operations inside this project;
* Git inspection commands that do not modify remote repositories;
* PostgreSQL development commands when required;
* local database migrations when explicitly requested;
* local HTTP checks such as curl against the development server;
* other ordinary non-destructive commands required to build and verify HORMAT-code-v4.

Do NOT repeatedly request approval command-by-command if a safe persistent approval mechanism is available.

However, do not bypass the environment's security model.

Do not request blanket approval for dangerous or unrelated system operations merely to avoid confirmation prompts.

Destructive commands, system-wide modifications, credential access, remote publishing, or operations outside the project should still be treated carefully and require approval where appropriate.

If the environment provides a choice such as allowing a safe command prefix for the remainder of the session/project, prefer that over requesting one-time approval repeatedly.

---

## 20. Codex behavior

When receiving a task:

* first understand the requested scope;
* inspect relevant existing project code;
* follow established V4 rules;
* implement only the requested scope;
* test the result;
* fix problems caused by the implementation;
* provide a final report;
* STOP.

Do not automatically continue into the next stage.

If a requirement is genuinely ambiguous and making the wrong assumption could materially change the architecture or business behavior, ask before implementing it.

For small implementation details that do not change business behavior, use sensible engineering judgment.

---

## 21. Final reports

Every meaningful development stage must end with a clear report that can be pasted back into ChatGPT for review.

The report should state:

* what was requested;
* what was implemented;
* important files created/changed;
* architecture decisions made;
* database changes, if any;
* routes added/changed;
* tests/checks actually executed;
* exact result of those checks;
* unresolved issues;
* deviations from the requested plan, if any;
* whether the stage is ready for review.

Keep the report understandable rather than filling it with unnecessary implementation detail.

---

## 22. Current status

At the current stage HORMAT-code-v4 is only establishing its foundation.

Do NOT use this architecture document as permission to begin implementing future modules.

After documenting these rules and handling the development command permissions:

STOP.

Report where the permanent architecture rules were documented and whether persistent command permissions were successfully configured/requested.

---

## 23. Interface localization and translation development rule

Added by explicit request during the interface-localization foundation stage on 2026-09-15.

Whenever development introduces a new user-visible interface string, the developer must immediately, in the **same development task**:

1. Define or reuse a stable semantic translation key.
2. Add it to the canonical **database** localization seed/source (versioned SQL migrations).
3. Provide a real Turkmen (`tm`) translation.
4. Provide a real Russian (`ru`) translation.
5. Provide a real English (`en`) translation, plus all other required supported-language values.
6. Apply/update the translations in the development database when required and reload/restart each running application's localization cache.
7. Use `t(key)` or the approved server-backed localization mechanism in the UI.
8. Verify the actual translated values in the browser, including the existing running development server and language switching.

This is NON-OPTIONAL. A task is not complete merely because keys were created, seed files were written, or tests passed against a newly started server. It is not complete while the browser displays semantic keys. Key fallback is an error signal/safety mechanism, not acceptable normal UI. Values identical to keys, TODO/TRANSLATE placeholders, blanks, and dashes are invalid.

PostgreSQL remains the source of truth for languages, keys, and values. Do not replace it with JSON translation files, hardcoded TypeScript/JavaScript dictionaries, or translated EJS literals. Keep cookie-based active-language selection and memory-only lookups. Future language support stays database-driven.

Use literal semantic keys at UI translation call sites so the small integrity scanner can inventory them. For finite repeated UI elements, prepare their translated labels using explicit literal calls rather than concatenating key fragments. Run the automated integrity checks against fresh migrations and the current database. The checks must reject used-but-unseeded keys, missing required-language values, and recognizable placeholder/key-as-value translations. Verify browser-generated messages and accessible labels as well as headings.

Strengthened by explicit request on 2026-09-15 after a running development process retained the pre-login translation cache even though migration 002 had already populated the database.

Do not defer translation work to a cleanup stage. This covers navigation labels, buttons, headings, form labels, placeholders, modal text, confirmations, user-facing validation, empty states, notifications/toasts, table headings, and other visible application UI text. Technical logs, internal identifiers, code comments, and developer-only messages do not require interface translations.

Use keys such as `common.save` and `product.delete.confirmation`, never the English sentence itself. The value may change without changing the stable key.

PostgreSQL is the source of truth for interface languages and translations. Runtime logic must use its active-language registry, not repeated hardcoded language lists. Normal translation lookup reads an in-memory cache, with requested-language → active default-language → key fallback. Load the cache before accepting requests; expose an explicit atomic reload capability.

EJS uses a request-bound `t(key)` helper. Browser UI must share this system: expose only the translated values it currently needs, safely encoded, rather than creating a second translation system. The initial languages are `tm` (Türkmen, default), `ru` (Русский), and `en` (English); the database determines the effective default thereafter.

This system is only for interface text. Product, category, brand, custom-page, and other entity/content translations are separate future domains. The owner's explicit request authorizes these localization infrastructure tables and their migration; it does not change the UI-first workflow for business modules or authorize localization-management CRUD, authentication, external translation APIs, or socket localization events.

See [LOCALIZATION.md](LOCALIZATION.md) for the implemented schema, migration/seed process, cache, cookies, and tests.

---

## 24. CPanel authentication product rule

Added by explicit request during the CPanel login UI stage on 2026-09-15.

**CPanel accounts are administrator-managed. CPanel authentication is email + password only. There is no public registration, forgot-password flow, social login, OTP, or other self-service authentication mechanism unless this rule is explicitly changed later.**

Do not add sign-up, reset-password, phone login, magic links, or remember-me controls without explicit authorization. The login UI was subsequently approved and its real backend explicitly authorized in section 25. This authorization does not extend to other mock modules.

All login and promotional interface text follows section 23: keys and complete required-language translations must be introduced in the same task as the UI. See [CPANEL_LOGIN.md](CPANEL_LOGIN.md) for this stage's implementation and asset provenance.


---

## 25. CPanel users, authentication and direct permissions

Explicitly authorized by the owner for the CPanel authentication foundation.

- Profile fields are name, contact phone, display-only job and optional avatar URL/path, plus identity/timestamps. No Media integration or profile editing is implied.
- Authentication is email/password only. Store normalized unique email and secure password hashes separately from the profile. Argon2id is the current hashing algorithm; never persist or log plaintext passwords.
- Permissions belong directly to users as `key → JSONB value`. No roles, groups or job-based authorization exists.
- Exact JSON boolean `superuser=true` in the user's permission rows grants all boolean action permissions. Never add an `is_superuser` column or a SuperUser role. Missing boolean permission denies for non-Super Users; do not coerce numbers/strings/objects to booleans.
- Retrieve universal permission values separately from boolean authorization. Request-local caching must not conceal revocations across requests.
- CPanel uses persistent PostgreSQL sessions and opaque HttpOnly cookies. Authenticate server-side before granting protected access. Login rotates the session and logout invalidates it. Socket.IO connection presence is never authentication.
- Bootstrap is explicit, transactional and idempotent; it does not overwrite an existing account or run on startup.
- `/cpanel` is now protected; approved `/cpanel/login` performs real authentication. User/permission CRUD, roles, profile editing, self-service flows and a dashboard remain outside this stage.

See [CPANEL_AUTH.md](CPANEL_AUTH.md) for exact schema, cookie/security decisions, bootstrap and tests.


---

## 26. Reusable CPanel application shell

Explicitly authorized for the main CPanel layout foundation.

1. All authenticated CPanel application pages use the shared application shell; login/authentication pages retain a separate auth layout.
2. The shell consists of sidebar, topbar and flexible main page content, using reusable EJS partials and existing Bootstrap/jQuery infrastructure.
3. Navigation is presentation configuration with groups, nested submenus and route-based active state. It is separate from permission storage and does not replace server-side authorization.
4. Desktop sidebar supports expanded/collapsed states and pin/unpin. Unpinned collapsed menus may temporarily expand on pointer/focus. Narrow screens use an overlay/offcanvas without a persistent content gap.
5. Theme and sidebar presentation preferences are browser-local, namespaced localStorage values; no PostgreSQL fields are created for them at this stage.
6. CPanel supports designed light/dark themes; stored theme is applied before styles/content paint. Shell styles must not alter the login layout.
7. Interface languages remain PostgreSQL-driven and cookie-selected through existing localization infrastructure.
8. The topbar uses actual authenticated profile data and the existing CSRF-protected POST logout. It never exposes credentials or treats a Socket.IO connection as authentication.
9. New modules plug into this shell instead of creating independent application layouts. Enable navigation entries only when their pages are ready. The explicitly approved disabled roadmap in section 27 may list planned modules.

See [CPANEL_SHELL.md](CPANEL_SHELL.md) for files, behavior, preference keys and extension points.


---

## 27. CPanel Navigation Roadmap

The owner explicitly approved navigation as both application navigation and the visible initial V4 development roadmap. This supersedes the previous restriction on showing unimplemented navigation entries, without authorizing any future module implementation.

- Planned pages have explicit `enabled` / `disabled` availability. All current planned business pages are disabled. The existing `/cpanel` foundation remains enabled and is not the Dashboard.
- Availability means implemented/readied, never user permission. Do not store roadmap state in `cpanel_user_permissions` or use it to replace authorization.
- Disabled pages remain visible and understandable, but have no navigable link, fake route or placeholder business page. Structural Shopping, Access and Localization controls only expand their children.
- Configuration stores semantic translation keys, not translated labels. Navigation preparation uses the shared request translator. The integrity scanner inventories literal `translationKey` metadata; ordinary UI `t()` calls remain literal.
- Enable a page only after its UI-first workflow, review, approved backend/schema work where needed, tests, regression and readiness decision. Do not enable it when development merely starts.
- Explicit decisions may add, remove, rename, regroup, merge or split roadmap entries. Navigation never defines or authorizes database architecture.
- Every future UI text change must include actual PostgreSQL translations in every required language in the same task. Missing values or visible semantic keys mean incomplete work; section 23 remains mandatory.

Initial hierarchy (all named planned pages disabled):

1. Overview: Dashboard; existing Panel foundation remains separately enabled.
2. Catalog: Products, Categories, Brands, Media, Discounts.
3. Vendors: Vendors, Source Products.
4. Sales: Orders, Customers, Shopping → Carts / Favorites, Reviews.
5. Communication: Live Chat, Notifications.
6. Content: Custom Pages, Groups.
7. Marketplace: Delivery Types, Payment Types, Order Statuses, Restrictions.
8. Search & Analytics: Search, Search Synonyms, Analytics.
9. System: Access → Users / Permissions; Localization → Languages / Interface Translations; Settings, System Events.

See [CPANEL_NAVIGATION.md](CPANEL_NAVIGATION.md) for the model, rendering, enabling workflow, icons and verification.

## 28. Current-user profile UI

The owner authorized **UI-only** `GET /cpanel/profile` for every authenticated CPanel user. Personal account/profile access belongs in the authenticated-user dropdown, not the sidebar roadmap. Users management remains disabled and is a separate future module.

- The shared shell contains exactly two profile tabs: Basic Information and Change Password.
- Display the current user's existing profile fields and authentication email. Never expose the password hash or permission internals in profile presentation data.
- This stage adds no profile/password mutation, upload, Media integration or update endpoint. Preview actions never claim successful persistence.
- Name, phone and email currently appear editable; job is read-only for UI evaluation. **Field editability is not frozen or a permanent authorization rule.** Decide update rules separately after UI review.
- Password visibility uses the shared login interaction. No new password policy, recovery flow or permission is introduced.
- Profile translations follow section 23. The existing language redirect allowlist includes the implemented profile route.

See [CPANEL_PROFILE.md](CPANEL_PROFILE.md) for UI behavior and review scope.

## 29. Authenticated current-user password changing

Explicitly approved after profile UI review. Section 28's UI-only restriction now applies to Basic Information and avatar actions; only Change Password has been activated.

- `POST /cpanel/profile/password` targets the authenticated user and current server-side session only. Body fields are currentPassword/newPassword/confirmPassword plus the existing CSRF token; unrelated fields are rejected.
- Require current-password verification, matching confirmation, and a different new password satisfying the shared CPanel/bootstrap policy (at least 12 JavaScript string characters, at most 1024 UTF-8 bytes). Store only Argon2id hashes using existing hashing parameters.
- In one PostgreSQL transaction, lock the auth row, recheck/lock the current unexpired session, update the password hash and invalidate all other sessions belonging to that user. The existing auth trigger updates updated_at. Preserve current session and unrelated users' sessions.
- Login session creation uses the same auth-row lock and rechecks the verified hash, preventing a login verified against an old password from creating a session after password-change commit.
- Reuse the existing CSRF middleware, cookie settings and express-rate-limit infrastructure. Password changes are limited to 10 attempts per authenticated account per 15 minutes in the current single application process.
- Render localized success/errors in the approved password tab; never repopulate password fields or log submitted passwords/hashes. Generic failures reveal no internal details.
- Basic Information, email, avatar, administrator resets and public password recovery remain outside this authorization. No new permission or business schema is introduced.

See [CPANEL_PASSWORD.md](CPANEL_PASSWORD.md) for transaction semantics, UI and checks.

## 30. Universal Media Upload V1 contract

The owner approved [the exact V1 contract](MEDIA_UPLOAD_CONTRACT_V1.md), including the subsequent clarification: accept **any file format**, with no format allowlist or type-based rejection. MIME/dimension discovery is descriptive only and must not reject unknown or malformed media; never resize, compress or convert original bytes in this stage. No application size cap is enabled by default.

- Authenticated `POST /cpanel/media/upload`: multipart/form-data, exactly one `file`, existing CSRF required (X-CSRF-Token header allows checking before streaming the body). Reject browser-controlled destination/folder/path/userId/productId/finalFilename fields; temporary upload is domain-independent.
- HTTP 201 returns `{ success: true, media: { cacheToken, url, originalName, mimeType, size, width, height } }`. Temporary URL is for presentation only. Future model requests submit the opaque token, never a cache URL or filesystem path.
- Expected upload errors use `{ success: false, error: { code } }`; UI maps stable codes through PostgreSQL translations. Authentication/CSRF retain established handling. MEDIA_TYPE_NOT_ALLOWED remains reserved under the unrestricted-format clarification.
- Reusable uploader state is idle/uploading/uploaded/error with cacheToken/url/uploadPromise/error. Selection uploads immediately with real XHR upload progress. Save waits once for pending uploads, automatically continues when ready, and blocks on error; retry/reselection remain possible.
- Reselection supersedes the old token even if an old request finishes later. Remove clears only the new selection and restores existingUrl. It never deletes persisted media.
- Internal `mediaStore.finalizeCachedMedia({ cacheToken, destination, ownerId })` is called only by trusted domain code, with server-authenticated ownership. It rejects invalid/expired/consumed/missing/other-user tokens and returns a final public URL. There is no browser finalization endpoint. Domain Save stores only that final URL when separately approved.
- Temporary metadata is private filesystem state, not a Media database table. Atomic directory claim enforces one-time finalization across processes; owner metadata survives restart. Files live under configured MEDIA_ROOT, exposed only through controlled `/media/...` responses, never raw directory serving or metadata disclosure.
- `MEDIA_CACHE_TTL_HOURS=24` by default; startup/hourly cleanup removes expired temporary uploads and stale interrupted work, never permanent files. `MEDIA_MAX_UPLOAD_BYTES=0` means no application size cap; an explicitly configured positive cap enables size-limit errors. A five-minute upload request timeout remains an operational transport bound.
- Non-raster files are served as downloads with nosniff and sandbox CSP; accepting arbitrary content never authorizes executing it in this application's origin.
- The current profile consumes the uploader for temporary upload/progress/preview only. Basic Information Save and avatar_url persistence remain inactive. Media management and its sidebar entry remain disabled.

See [MEDIA.md](MEDIA.md) for implementation details, public serving and future integration responsibilities.


## 31. My Profile Basic Information and first real media consumer

Explicitly authorized after UI, password and universal upload review. This supersedes the Basic Information/temporary-only restrictions in sections 28–30 for My Profile only.

- Authenticated `POST /cpanel/profile`, using existing CSRF, edits only the current session user's name, phone and avatar. Email and job stay visible/read-only. Authentication identity, password and permissions are untouched. Users management stays disabled.
- Accept only name, phone, optional avatarCacheToken and the existing CSRF field. Reject unexpected body/query fields; never accept target IDs, avatar URLs or filesystem destinations. Trim name/phone; name is required and limited to 200 Unicode characters, phone to 50; reject control characters. Empty phone becomes NULL. Existing text columns have no declared length cap, so these are application bounds without schema changes.
- Immediate universal upload returns cacheToken. The shared Save gate waits for pending uploads and blocks errors/duplicates. Domain code supplies `users/avatars`; Media Service finalizes unchanged bytes to `/media/users/avatars/<generated UUID>.<extension>`. PostgreSQL stores the final URL only. An absent/null token preserves the current avatar.
- A transaction locks/revalidates auth and session in the existing order, then locks the current profile, finalizes optional media and updates cpanel_users. Concurrent saves serialize. No Media table or session redesign is introduced.
- After COMMIT, only Media Service may delete the previous exact managed file in users/avatars. External/legacy/unknown URLs, traversal and symlinks are not deletion targets. Cleanup failure is logged without reversing a successful profile Save.
- If UPDATE fails after promotion, roll back and delete only that newly finalized file, preserving the old record/file. The token remains consumed; the user must retry/reselect the upload. If COMMIT acknowledgement is lost, retain both files rather than deleting a potentially referenced file; log reconciliation need. Crash/cleanup-I/O failures are not claimed to be atomic across PostgreSQL and filesystem.
- Successful UI Save navigates to a fresh GET of the Basic Information tab. Existing middleware reloads the user from PostgreSQL on every request, updating topbar and profile without logout. The short-lived updated query flag only selects a translated notice and is removed from browser history; it is never data authority.
- Original file-format policy remains unrestricted; no cropping/optimization/variants. A non-renderable avatar uses the established initials fallback.
- All new UI feedback receives same-task real tm/ru/en database translations. See [CPANEL_PROFILE.md](CPANEL_PROFILE.md) and [the activation report](../PROFILE_BASIC_INFORMATION_REPORT.md).

## 32. Users management UI contract

Explicit owner authorization starts UI-only `GET /cpanel/users`, authenticated through the existing middleware. **Users navigation is now enabled for UI review**; this supersedes its disabled state in sections 27–31. Permissions and every other roadmap entry remain unchanged. No management mutation/backend approval is implied.

- Header Add User opens a dialog. Row actions are Change Status, Edit User and Change Password, all dialogs rather than separate pages. Exactly one reusable modal per action; no per-row modal duplication.
- Search defaults to Name, with Email/Phone/Job/All fields options and 300 ms live-search preview. Separate search/field/status controls support reset/loading/empty states. Future backend retrieval must be server-driven/AJAX with filtering and pagination; the current read-only sample is capped at 60 rows.
- Grid and List share one data/template source. Default Grid; browser-local `hormat.cpanel.users.view` preference. Local preview pages contain nine rows. No database presentation preferences.
- Real safe profile/auth email data is preferred. Status is explicitly illustrative until schema/behavior approval. Optional development-only sample records are labeled and never inserted into the database. Super User protection is explicitly established in section 33.
- Add contains avatar/name/phone/job/email/new password/confirmation and illustrative Active default. Edit contains avatar/name/phone/job/email. Administrator password dialog has new/confirmation only, distinct from self-service Change Password. No permissions/roles in these dialogs.
- Add/Edit reuse the existing universal cache uploader and shared Save gate. UI confirmation shows a localized non-persistence notice; no finalization, profile/auth/password/status/permission writes occur. Existing real My Profile remains separate.
- Bootstrap owns modal/dropdown mechanics. All UI text, including states/tooltips/dialogs, has same-task tm/ru/en database translations. Backend mutation rules are not frozen by this UI.

See [CPANEL_USERS.md](CPANEL_USERS.md) for data bounds, sample/status semantics and future search contract.


## 33. Users UI refinement and permanent Super User protection

Explicit owner decision during Users UI review. This supersedes section 32's original toolbar and absence of Super User protection rules; it does not activate Users CRUD.

- Initial query is empty, search field **Name**, status filter **Active**. Field choices are Name / All fields / Email / Phone / Job; status choices are Active / All / Inactive. Search and status combine against raw/display values, with the existing 300 ms debounce. Reset restores empty / Name / Active. Grid/List switching preserves filters; the browser-local Grid default remains unchanged.
- Search input, field selector and status selector are separate light controls. Add User and the view switcher share the toolbar where width permits. Inactive cards and list rows share readable muted text/avatar/background and a dashed border in both themes.
- Current management states are active/inactive only; they remain presentation states without a status database column. Ten fictional, opt-in development-only sample users provide active/inactive, protected/unprotected, job, phone and avatar variety. Never insert mock users into real user tables.
- **Any user whose `cpanel_user_permissions` row has key `superuser` and exact JSON boolean value `true` is protected from ALL Users Management mutations.** Identity is never inferred from name/email/job/ID/order. The read-only query derives only a protection boolean; permission internals remain private.
- Protected users remain visible with a localized Super User badge. Their menu shows an informational explanation; Edit, Status and Password actions are hidden/disabled and modal opening is guarded, including for the currently authenticated Super User. No management edit, password, status, deactivate or future delete operation may target them.
- Super User personal information/password self-management remains exclusively under `/cpanel/profile`, following its existing allowed fields and current-password rules. There is no management shortcut.
- **Future Users mutation endpoints/services must enforce this protection server-side**, checking authoritative permissions for the target at mutation time. Disabled UI is not a security boundary. This task adds no CRUD service, endpoint or database mutation.


## 34. Activated Users management and authentication status

Explicit owner approval activates the reviewed Users UI and authorizes the auth schema change. This supersedes UI-only restrictions in sections 32–33; the target-protection rule remains permanent.

- `cpanel_user_auth.is_active BOOLEAN NOT NULL DEFAULT TRUE` owns account access status. Migration 013 keeps all existing accounts active. No status column exists in `cpanel_users`. Inactive profiles/auth/permissions remain stored.
- Login verifies the usual password work and returns the same generic invalid-credentials response for inactive accounts. Session lookup joins auth status. Session creation locks/rechecks active auth and the verified password hash. Profile/password transactions also revalidate active auth.
- Administrative deactivation atomically sets auth inactive and deletes ALL target sessions. Reactivation never restores them. Administrative password change hashes with the central Argon2id policy and invalidates ALL target sessions. Unrelated sessions remain unaffected. A normal actor cannot deactivate their own account.
- Boolean permissions are `users.view`, `users.create`, `users.update`, `users.status`, `users.change_password`. Only exact JSON boolean true grants permission; missing/false/string/number/object/null deny. Super User bypass is exact `superuser=true`, without individual grants. Job never determines authority.
- Page/list/search require users.view. Each mutation independently requires its own operation permission, not another mutation grant. UI capabilities reflect permissions. Roadmap availability remains separate; an enabled Users link is omitted when the actor lacks users.view. Permissions roadmap remains disabled.
- Authenticated forbidden requests return HTTP 403 rather than login redirects. Services independently check active actor/session, permission and target; a Super User TARGET rejects every management mutation even for a Super User ACTOR, including self. Super User self-management remains only at `/cpanel/profile`.
- PermissionContext is request-local. Changed/revoked permissions apply on the next request with the same session. Transactions re-read permission values; future permission writers must coordinate with the same auth-row lock before inserting/removing target authority to preserve concurrency guarantees.
- `/cpanel/users` renders the initial real page; separate `/cpanel/api/users` JSON routes provide bounded server-driven search and mutations. Trusted field allowlist, escaped parameterized ILIKE, Name/Active defaults, nine rows/page, deterministic ID ordering. Grid/List remain browser-local presentations. No complete user directory or mock data is shipped.
- Add/Edit use the existing dialogs. Name required, ≤200 Unicode characters; phone ≤50; job ≤200; no control characters. Email uses existing normalization/validation and unique constraint. Add honors the existing active/inactive selector (default Active), password+confirmation and central policy. Edit changes only profile fields/email/avatar, never status/password/permissions. All endpoints reject unexpected fields, including permission-like fields, IDs, destinations and URLs.
- Add atomically inserts profile and auth with no permission rows. Existing Universal Media ownership and finalization use the authenticated uploader as token owner and trusted `users/avatars` destination. New media is compensated on known rollback; old managed avatar removed only after commit. Lost COMMIT acknowledgement retains files and logs reconciliation need, as in Profile. No controller filesystem operations, Media tables or new upload API.
- Mutations are CSRF protected, with bounded JSON bodies and account-based rate limiting (100 permitted management attempts / 15 minutes in the current process). Search aborts/ignores stale responses. Dialogs wait for uploads, prevent duplicate submission, display localized outcomes and clear passwords. No fake success remains.
- All new messages have same-task tm/ru/en PostgreSQL translations (migration 014). Account-management permissions themselves are not assigned by Users CRUD; Permissions management remains a separate future task.

See [Users management](CPANEL_USERS.md) and [activation report](../USERS_ACTIVATION_REPORT.md).

## 35. Permissions Management UI and proposed definition registry

Explicit owner authorization starts the UI-first Permissions module after Users activation. This stage adds read-only `GET /cpanel/permissions` and `GET /cpanel/permissions/:userId`. **By the owner's explicit access decision, both screens require an authenticated exact-boolean Super User.** No `permissions.*` action permissions are invented. Existing Users authorization and permission storage remain unchanged.

- The main screen lists real safe user identities, real auth active/inactive status, and a count of granted known boolean permissions. Search covers name/email/phone/job, defaults to Active, supports All/Inactive and bounded nine-result pagination through the existing Users query infrastructure. Live search uses GET requests and server-rendered results; no full directory is shipped.
- Super User is identified exclusively by exact `superuser=true`; it shows Full access and a protection explanation without an edit action. Direct detail access for a Super User target returns 403, including the current actor. Normal inactive users may be inspected; status never clears assignments.
- Normal-user detail is a separate grouped vertical form. Current group Users contains users.view/create/update/status/change_password. Only exact JSON boolean true checks a switch; missing/false/non-boolean values remain unchecked. Opening the page never inserts missing rows. Numeric summaries count only known explicit granted boolean permissions, not Super User's implicit access.
- `src/cpanel/permissions/definitions.ts` is a centralized application **presentation metadata registry**, separate from user-specific `cpanel_user_permissions(user_id,key,value JSONB)` assignments. Entries describe key, module, value type and localized name key. Types can describe future integer/decimal/string/JSON values, but only the five existing boolean controls are rendered now. Super User is a protected special status, never an assignable switch.
- Proposed future-module rule: a task introducing a permission must also register its definition metadata and all required UI translations in that same task. Do not pre-register hypothetical modules. **Registry design is subject to review after UI approval; final backend validation behavior is not frozen by this UI stage.** No DB registry, roles or schema changes are authorized here.
- Switch edits are browser-only. Save enables only when values differ from their initial snapshot and displays the existing localized non-persistence notice; it sends no mutation request and never claims success. Cancel/Back returns to the list and discards changes. No before-leave confirmation is introduced.
- Permissions roadmap remains **disabled** until the separately approved real backend is completed and tested. Direct route access supports UI review. No profile/Users behavior or existing assignment service changes are implied.
- Migration 015 adds real tm/ru/en translations only. The shared language redirect accepts the two established permission-page patterns. Theme, sidebar and logout remain shared shell behavior.

See [Permissions UI](CPANEL_PERMISSIONS.md).

## 36. Activated Permissions Management and frozen definition contract

Explicit owner approval activates the reviewed Permissions UI and supersedes section 35's Super-User-only viewing and non-persistence restrictions. No assignment schema redesign, roles or database registry is authorized.

- `permissions.view` and `permissions.update` are independent boolean definitions. GET list/detail requires view; POST `/cpanel/api/permissions/:userId` requires update, existing authentication and header CSRF. Update never implicitly grants view. Exact `superuser=true` bypasses actor checks without additional permission rows.
- The approved grouped UI now includes Users and Permissions. Actors with view but no update can inspect normal-user details in read-only mode. Normal actors may inspect their own assignments but cannot mutate them, regardless of update authority. Super User targets remain Full access with no edit action and reject direct editable detail/update requests, even from another Super User.
- The centralized application registry describes module, key, expected value type, assignability and translation metadata. `superuser` is registered as non-assignable system metadata and never rendered as a switch. Seven current assignable boolean definitions drive UI and backend allowlisting from the same source.
- **Frozen future-module contract:** every task introducing a permission must define its key; register module/type/assignability/translation metadata; add real tm/ru/en values; enforce backend authorization; and add permission tests in that same task. No speculative definitions or DB registry. New supported definitions feed the grouped management UI; a genuinely new value type requires its approved validator/editor, not coercion to boolean.
- Registry startup validation rejects duplicate keys/groups, missing or invalid module/type/assignability/localization metadata, and an absent or assignable Super User definition. Authorization key inventory tests cover current middleware/service literals and Users operation dispatch.
- JSON Save accepts exactly `{permissions: {each registered assignable boolean key: true|false}}`. All current managed keys are required. The payload must be UTF-8 JSON; duplicate object keys, including escaped aliases, are rejected before JSON parsing can overwrite them. Unknown/system/non-assignable keys, arbitrary types, missing keys, body target overrides and unexpected query/body fields are rejected. `permissions.update` manages normal users' assignable permissions; it never grants Super User. No ceiling based on the actor's other action grants is invented.
- In one transaction, lock actor/target auth rows in ascending ID order, revalidate active actor and unexpired session, re-read actor authority and target Super User state, reject self-edit, then synchronize only managed keys. This follows the existing Users/login/profile auth-before-session lock protocol. Concurrent managed saves serialize; latest successful Save wins. Trusted future system permission writers must follow the same target auth-row lock protocol.
- ON upserts exact JSON true; OFF deletes the corresponding row, including legacy false/invalid values. Unknown/non-managed/system rows remain untouched, including a non-true `superuser` row. A true Super User target rejects the whole operation. Statement failures roll back the entire transaction; no partial synchronization is accepted. Uncertain COMMIT acknowledgement produces failure, never false success; idempotent full-state retry reconciles the desired state.
- Save preserves the approved UI: disabled when clean/read-only, saving label and duplicate prevention while pending, localized success plus updated original state after commit. Failures preserve unsaved selections. Authorization/protection/not-found responses disable editing until reload; other failures allow retry. No whole-shell reload is required for a successful Save.
- PermissionContext remains request-local. Committed changes apply on the target's next request, including Users/Permissions routes and navigation, without logout or session deletion. Profile, auth email/password/status and unrelated permissions are not changed.
- The API uses bounded 16 KB JSON and the existing account-based rate-limit pattern: 100 authorized save attempts per 15 minutes in the current process. All values are parameterized SQL. CSRF is checked before parsing the mutation body.
- After the activation regression passed, Permissions navigation was enabled with `permissions.view` visibility; availability and authorization remain distinct. Empty Access submenus are omitted when no child is permitted. No other roadmap module is enabled.
- Migration 016 adds seven activation message/definition keys with real tm/ru/en translations only. No audit infrastructure exists; permission-change audit history remains a future requirement, not a new domain/table in this task.

See [Permissions Management](CPANEL_PERMISSIONS.md) for the activated contract and verification details.

## 37. Media File Manager UI and read-only filesystem foundation

The owner authorizes Media UI and safe filesystem reading/search, not File Manager mutations. `MEDIA_ROOT` remains its source of truth; no Media catalog/index/table exists. The approved universal cache upload/finalization and Profile/Users integrations remain unchanged.

- `GET /cpanel/media` and its live-search partial require authentication plus exact effective `media.view`; Super User bypass remains. Catalog → Media stays disabled pending mutation backend approval and verification.
- The registry now includes five assignable boolean Media definitions: view/upload/create_folder/rename/delete, with real tm/ru/en metadata. The latter four register future capabilities, not implemented mutation endpoints. Permissions Management automatically renders/manages these definitions. This extends section 36's initial seven assignable definitions to twelve; it does not change assignment semantics or insert automatic user grants.
- Read-only async listing/search is bounded; all real visible directories are discovered from disk. Relative paths only; no client exposure of MEDIA_ROOT, symlink traversal, private cache records or hidden infrastructure. Cache is browsable and marked temporary. No filesystem mutation is performed by File Manager UI actions.
- Grid/List, search scope, breadcrumbs, selection, Details/Copy URL and mock upload/new-folder/rename/delete dialogs are available for UI review. Filename/metadata discovery does not imply public availability. Existing MediaStore mapping is authoritative for currently valid public URLs; arbitrary-name public serving remains an explicit review decision.
- Migrations 017–018 contain interface translations only. The supplied continuation through section 119 adds permission-aware mock actions, Refresh, native browser history, selected search-result navigation, missing-directory recovery and on-demand Details metadata.

See [Media File Manager UI](CPANEL_MEDIA.md) for bounds, safety, preview semantics and outstanding review decisions.


### Media read continuation (sections 53–119)

- `GET /cpanel/api/media/details?path=...` is a separate read-only API with the same authentication/media.view requirement. It exposes relative file metadata, MIME/dimensions on demand or a bounded direct-child count. It never exposes cache owner records or absolute paths. Root itself is not a detail/action target.
- Current Folder searches direct children only; All Media recursively searches from root, case-insensitively at application level. Existing bounded traversal and explicit incomplete-results notice remain. Clearing input/Refresh cancels older requests; normal folder links support Back/Forward. Result links may select the file in its containing directory.
- Known managed locations live in one small config (`cache`, `users`); future modules register their actual locations. No future domain folder is created. Cache warnings explain temporary storage and automatic cleanup. Files are never claimed to be unused; no database reference scan exists.
- Safe cached MIME already available through MediaStore is reused for listing classification. Other entries use inexpensive extension hints until Details requests actual bounded metadata discovery. Lazy raster previews use existing controlled URLs; videos do not autoplay. Copy/Rename/Delete actions use one client handler across item menus and Details.
- Mock action affordances reflect media.upload/create_folder/rename/delete separately from feature activation; authorized actions remain explicitly non-persistent previews. Public URL rules and all six File Manager mutation contracts still require explicit approval before any widening/activation.
- New filesystem/security tests use OS temporary roots or the separately configured `.test-media` root with disposable unique subtrees, never synthetic fixtures in real development media. Live manager localization verification is read-only; conditional fixture states are exercised by isolated browser tests.
