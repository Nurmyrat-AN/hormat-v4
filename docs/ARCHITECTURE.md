# HORMAT-code-v4 — Permanent Architecture and Development Rules

Established by the project owner on 2026-09-15. This document is the default source of truth for project architecture and development unless the owner explicitly changes a rule later. Keep it updated when such a change is authorized; do not silently rewrite established rules.

Read this document before modifying the project. [AGENTS.md](../AGENTS.md) is the entry point for future coding-agent sessions; [README.md](../README.md) describes setup and commands. Historical stage reports record work completed at their respective stages and do not override these rules.

Sections 1–22 preserve the owner's original supplied rules, with the testing workflow/rules explicitly updated by the owner in section 42. Section 22 records the scope of that documentation stage; future implementation still requires a separately requested task. Later sections record explicitly authorized additions. These rules do not authorize unrequested modules, database schemas, or business functionality.

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
12. Run module tests + risk-based related regression tests
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

**Owner-approved replacement: risk-based regression (see section 42).** Do not automatically run every historical suite after every task.

Every implementation task must run the changed module's tests, tests for directly affected shared infrastructure, and tests for dependent/integrated modules where regression is realistically possible. Select scope from actual code changes and their dependencies. Run TypeScript/production build verification appropriate to the task; meaningful implementation stages require the normal build. Failing module tests or build block completion; fix discovered regressions.

Broaden regression in proportion to changes in authentication, sessions, permissions, localization core, database/migration infrastructure, shared Media, shell/navigation, middleware or security infrastructure. Full-suite checkpoints are mandatory when explicitly requested, before release/deployment milestones, on completing a major module group, major refactoring, architecture changes shared by most of the application, critical authentication/security changes, or an appropriate periodic health checkpoint after a sequence of modules.

Preserve all historical tests for targeted and full runs. Every report must name new and related tests actually executed, build result, suites intentionally omitted and why that scope was sufficient. Never claim full regression passed unless the complete suite actually ran. Documentation-only tasks require completeness/link checks unless runtime checks are explicitly requested; do not invent execution claims.

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
* new tests and related regression checks actually executed (or no new tests);
* build result;
* historical suites intentionally not executed and why that scope was sufficient;
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

## 38. Activated Media File Manager

The owner approved real File Manager mutations and explicitly clarified **any file type, maximum 10 MB per direct file** (10,485,760 bytes, inclusive). This overrides the activation brief's unspecified format allowlist/executable rejection, for File Manager only. Sections 30–31 and the Universal Upload contract remain unchanged: domain uploads accept any format with their existing configurable cap and use cacheToken/finalization. This section supersedes section 37's mock-mutation and restricted human-filename public-serving boundaries.

- Filesystem is the source of truth; no Media catalog/reference tables or database reference repair. Profile/Users keep their domain upload→cacheToken→Save→trusted finalization flow. File Manager direct upload returns an item, never a cacheToken.
- POST `/cpanel/api/media/files?path=<relative folder>` accepts one multipart `file` per request, streams to private staging, then atomically publishes complete bytes into the selected existing folder with an exclusive hard link. Multiple selection sends independent sequential requests with actual XHR progress and per-file success/error; retry skips successful files. No original bytes are transformed and extension changes do not impose a type allowlist.
- POST `/cpanel/api/media/folders` accepts `{parent,name}` and creates one direct child. POST `/cpanel/api/media/rename` accepts `{path,name}` and renames only within the current parent. All collisions fail without overwrite or automatic suffixes. Rename uses GNU coreutils `mv --no-copy --update=none-fail --no-target-directory` (tested 9.7 on Linux); installations must provide these options and no-replace rename support. There is no weaker copy/delete fallback. Unsupported runtime commands fail closed.
- POST `/cpanel/api/media/delete` accepts `{path,recursive:boolean}`. File/empty-folder deletion is permanent. A non-empty folder requires explicit recursive mode; the UI first reads `/cpanel/api/media/delete-info`, counts even hidden children for emptiness, shows the permanent subtree warning and requires a separate checkbox. A stale nonempty response triggers a fresh confirmation. Confirmation is UX, never authorization.
- Existing authentication and CSRF precede body parsing/streaming. Each operation independently enforces its registry permission: media.upload/create_folder/rename/delete; read pages/details/search and delete preflight require media.view (preflight also requires media.delete). Exact boolean Super User bypass needs no individual rows. Missing/false/non-boolean grants deny. Mutation controllers re-read active session and effective authority; direct uploads repeat that check after receiving bytes. Committed revocations affect subsequent requests without logout.
- One shared root-relative resolver serves reads/mutations/public paths. Reject root rename/delete, traversal, absolute Unix/Windows paths, backslashes, encoded-path ambiguity (`%`), control characters, hidden/infrastructure names and symlink components. New names are one segment, at most 255 UTF-8 bytes, with Unicode/spaces supported. All targets are resolved again at operation time. Filesystem mutation queues serialize this process; exclusive publication/no-replace rename also prevent destination collisions.
- The application owns MEDIA_ROOT; local filesystem operators are trusted. Path checking is not an OS sandbox against a malicious local process swapping ancestors during filesystem syscalls. Recursive deletion does not follow descendant symlinks and leaves siblings/outside targets intact. Destructive tests use isolated roots only.
- System/domain folders, including users and cache, can be renamed/deleted by authorized users, with reference-risk warnings (also shown for other rename/delete targets, since references are unknown). No permission implies unused/reference safety. Cache owner filename `record.json` is reserved globally (including renamed cache trees); hidden work areas and writes inside `cache/<UUID>/` token directories remain reserved infrastructure; ordinary cache folders/files remain manageable. Manual files, even token-looking filenames, gain no domain metadata/ownership or finalization rights.
- Domain TTL cleanup remains intact. Token-looking ordinary files are not parsed as cache record directories. Deleting cache is allowed; the next domain upload initializes it again. Domain finalization naturally recreates its required destination. Arbitrary domain folders are not automatically recreated. Direct files placed in cache are not token records and have no domain TTL guarantee; the UI warns that cache is temporary.
- Controlled `/media/<encoded relative path>` now supports safe human filenames/root files/Unicode folders. Existing domain token aliases remain and physical token paths stay private, so expiry cannot be bypassed. All responses use no-store, nosniff and sandbox CSP; only recognized raster content is inline and other bytes are attachment downloads. No execution/antivirus claim is made. Public serving does not expose absolute paths or listings.
- Mutations refresh the current listing/search without a shell reload, preserving folder/scope/view. Failures remain visible and retryable, no fake success. Renamed/deleted references in other database tables intentionally stay unchanged and can become broken URLs.
- Migration 019 adds 13 keys / 39 real tm/ru/en values. The registry remains 12 assignable boolean permissions plus protected superuser. No audit infrastructure is introduced; audit/reference history remains future work.
- The Media activation checkpoint required mutation/security, Universal Media, full regression and production verification before enabling `media.view` navigation. Future testing scope follows section 42. Availability is not a permission.

See [activation report](../MEDIA_FILE_MANAGER_ACTIVATION_REPORT.md) for executed checks and final status.

Activation verification also added migration 020 for the explicit permanent-delete notice on every delete dialog. Final localization totals are 285 canonical keys / 855 values / 269 used UI keys across tm/ru/en.

Migration 021 updates the existing reference-risk text in tm/ru/en to explicitly cover both rename and delete, with no new keys. Raw browser network/parse errors are mapped to localized failure messages.

After passing the 126-test production regression and targeted final mutation checks, Catalog → Media was enabled with independent `media.view` navigation authorization. Same-session revocation removes the usable link and denies the next read. Existing cache token public aliases also count as upload/rename conflicts, preventing manual files from shadowing a valid token URL.

## 39. Media File Manager Move

Explicit owner authorization extends the active File Manager with **Upload, Create Folder, Rename, Move, Delete, Copy URL**. Filesystem remains the source of truth; no database schema/reference registry is introduced.

- Rename changes only the name in the same parent. Move changes only the parent and preserves the exact item name, including all descendants for a folder.
- `media.move` is an independent assignable boolean in the Media definition group. The registry automatically exposes it in Permissions Management. Only exact true or `superuser=true` grants it; no explicit Super User action rows are inserted. Existing view/upload/create/rename/delete grants do not imply Move.
- POST `/cpanel/api/media/move` accepts exactly `{path,destination}` relative paths. Authentication, `media.move`, header CSRF, bounded JSON and fresh active-session/permission checks apply. GET `/cpanel/api/media/move-folders?path=` requires `media.move`, returning actual safe direct child folders for the destination dialog. `media.view` remains necessary to access the manager page, not an implicit dependency of the Move API.
- The shared path resolver rejects absolute/traversal/encoded/hidden paths and symlink components. Root cannot move. Same-parent and folder self/descendant moves fail. Collisions never overwrite, merge or add suffixes; live cache aliases also reserve their public names. Existing private cache-token/record boundaries remain intact. Symlinks/special files inside a moved tree are rejected rather than followed/copied.
- Same-device moves use the existing GNU coreutils exclusive no-copy rename primitive. Cross-device moves copy into a private staging directory on the destination filesystem, compare SHA-256 tree/content snapshots against the source, recheck authority, exclusively publish, then remove the original. Copy/verification/publication failures retain the original and clean staging. If source removal fails after publication, retain the complete destination and return the explicit localized incomplete-move error so both locations can be inspected; never delete the remaining complete copy to simulate rollback. Application mutations are serialized per root; local filesystem operators remain trusted. Crash/power-loss atomicity across devices is not claimed.
- Authorized users may move ordinary media into/out of existing cache/users/products and other directories, including moving those folders themselves. Every Move dialog warns that existing HORMAT references may break; no DB table is scanned or rewritten. Cache remains temporary and its private upload infrastructure remains protected.
- The reusable Media modal provides a distinct Move view: dynamic folder browsing, root/ancestor controls, current destination, disabled current-parent/self choices, localized feedback and duplicate-submit prevention. Current folder/search refreshes after success while Grid/List persists. Fresh Details/Copy URL/search use the new path.
- Migration 022 adds 11 keys / 33 real tm/ru/en translations; existing conflict/loading/cancel/error conventions are reused. Current totals: 296 canonical keys, 888 values, 280 used UI keys, 13 assignable permissions plus protected Super User.

See [Move report](../MEDIA_MOVE_REPORT.md) for verification and operational limits.

## 40. Vendors / CouchDB Suppliers — UI preview

The owner authorizes UI-first `GET /cpanel/vendors`, not Vendor persistence or synchronization. The existing authenticated shell is reused. `vendors.view` gates this direct development route; the **Vendors → Vendors roadmap entry remains disabled** until backend completion. Source Products remains outside scope.

Proposed concepts, **exact schema/columns/types NOT YET FROZEN**:

```text
name
CouchDB connection: url, username, password
runtime synchronization: status, last_sequence, date_last_sync, date_last_operation
```

- A Vendor represents an external supplier/data source backed by CouchDB. The preview has eight fictional `.example.invalid` suppliers, six active/two inactive, with independent Up to date / Behind / Not synced / Error health examples. No real supplier credentials are used.
- Vendor account status, connection configuration and synchronization health are distinct. Runtime fields (sequence, last sync, last operation, health) are system-managed and never editable in Add/Edit. Health thresholds and timestamp semantics remain proposals for later backend design; current health values are explicit fixtures, not frozen thresholds.
- `last_sequence` is opaque text, not an integer. Long values truncate on cards/list with full text available in a tooltip/Details. Timestamps use the existing Intl presentation convention; no Vendor-specific timezone is introduced. Mock lag is source-operation minus last-sync, displayed in localized units; missing timestamps show unavailable values.
- **Passwords must never be returned in normal browser reads, HTML, data attributes, fixture JSON, tooltips or logs.** Read models expose only `passwordConfigured`. Future browser → server transmission is allowed only when an administrator intentionally sets/replaces the password. Keep URL, username and password separate; never put credentials into connection URLs or logs. Presentation strips userinfo/query/fragment and allows only HTTP(S) display URLs, never remote links/requests.
- Add has name/URL/username/empty password and initial Active selection. Edit never pre-fills a password and shows Configured/Not configured plus leave-empty guidance. Status uses a separate confirmation preview. Details groups Supplier / CouchDB connection / Synchronization. No Sync Now action or manual runtime edits.
- All mock Save/status actions are intercepted locally and show the existing localized non-persistence notice; they do not alter fixtures or PostgreSQL and do not call any Vendor/supplier endpoint. Password input is cleared on preview/close and never copied into persistent browser storage. Inputs have no successful-control names, preventing credential query submission without JavaScript.
- Search is debounced locally over name (default), URL, username or their union; password/configuration state is never searched. Active is the initial filter; Inactive/All and Grid/List preserve filters. Only the view preference is stored locally.
- Four future assignable boolean definitions — `vendors.view`, `vendors.create`, `vendors.update`, `vendors.status` — are registered with real tm/ru/en metadata and automatically appear in Permissions Management. Apart from necessary preview route/UI capability checks, this stage introduces no Vendor backend authorization/mutation domain. Super User uses its existing bypass. No Source Products definitions are registered.
- Migration 023 contains interface translations only: 33 new keys / 99 real values. Current totals are 329 canonical keys / 987 values / 314 used UI keys (including reuse of the preview notice); registry totals are 17 assignable booleans plus protected Super User.
- No Vendor table, schema migration, CRUD API/repository/service, CouchDB connection, `_changes`/`_all_docs` request, worker, queue, mapping or synchronization implementation is authorized by this UI stage.

See [Vendors UI](CPANEL_VENDORS.md) and [review report](../VENDORS_UI_REPORT.md). Backend/schema review is a separate future task.

### Vendors backend decisions pending approval

The final-report continuation explicitly preserves these open decisions before any Vendor backend implementation:

1. Exact PostgreSQL structure/types/constraints for proposed `name`, `url`, `username`, `password`, `is_active`, `last_sequence`, `date_last_sync`, `date_last_operation` are not frozen.
2. Supplier credential storage must be reversible but protected; do not assume plaintext storage or use one-way login-password hashing as the supplier credential store. Application-level authenticated encryption with a server-held key is a candidate requiring explicit approval, including key-management choices. Do not implement encryption yet.
3. Decide whether synchronization `status` is persisted, derived or combined; mock UI cannot decide this.
4. Approve Up to date/Behind thresholds and timestamp/runtime signals during synchronization design.
5. Inspect actual CouchDB `_changes` behavior/data before freezing sequence storage/checkpoint semantics; keep `last_sequence` opaque meanwhile. This is a future decision, not permission to connect now.

UI review and explicit backend architecture approval must precede Vendor schema migrations/tables, encryption, CouchDB connections, `_changes`, synchronization/workers/retries or Source Products. See the [complete confirmations and open questions](../VENDORS_UI_REPORT.md#decisions-still-required-before-the-backend-stage).


## 41. Activated Vendors configuration module

The owner approved persistent Vendors CRUD and the exact single-table schema, superseding section 40's pending CRUD/schema/encryption decisions. Synchronization approval is explicitly excluded.

- Migration 024 creates only `vendors`, using bigint identity and normal timestamptz conventions: name/url/username/password_encrypted, active default true, nullable TEXT last_sequence and nullable date_last_sync/date_last_operation, created_at/updated_at. No persisted health/status/lag or Source Products tables.
- Vendors CRUD manages configuration; future VendorSyncService owns runtime checkpoint/timestamp writes. Add/Edit reject runtime fields. Deactivation preserves credentials and runtime. No CouchDB connectivity, Test Connection, synchronization, workers, retries or Source Products are implemented.
- Credentials use reusable AES-256-GCM authenticated encryption with random IV, tag, versioned payload and server-only `VENDOR_CREDENTIALS_KEY` (exactly 64 hex characters/32 bytes). Startup fails for invalid/missing configuration. Never store the master key in DB/source or expose any secret/ciphertext through normal reads/logging. Keep the key stable and backed up; rotation requires a separate migration. Empty Edit password preserves ciphertext; replacement encrypts anew.
- API/read models explicitly project safe fields plus passwordConfigured. HTTP(S) URLs store no embedded credentials, query or fragment. Standard URL normalization preserves trailing path slashes; see the detailed contract. Name/username validation, allowlisted parameterized search and bounded JSON are authoritative server behavior.
- Existing four registry permissions independently protect view/create/update/status, with exact boolean grants and Super User bypass. CSRF precedes mutation body parsing. Transactions revalidate actor/session/permissions under the existing lock protocol; updates lock the Vendor and never partially persist failed validation/encryption/SQL work. Permission changes apply on subsequent requests.
- Approved Grid/List/dialogs now use PostgreSQL and asynchronous localized save/search responses. Default search is Name and Active, nine records per page; credentials are not searchable. No Delete exists.
- Null sync state displays Not synced; existing sync timestamps get neutral Not evaluated yet pending actual health rules. Checkpoints remain opaque and read-only. No Up-to-date/Behind thresholds are frozen.
- Migration 025 adds 15 keys with all required tm/ru/en values. Navigation availability is enabled only after CRUD/security/regression verification and remains separate from effective vendors.view authorization. Source Products stays disabled.

See [Vendors contract](CPANEL_VENDORS.md) and [activation verification](../VENDORS_ACTIVATION_REPORT.md).

Migration 026 updates the existing Vendor subtitle in tm/ru/en to describe connection settings only, without implying that synchronization is available. Translation-key totals are unchanged.


### Vendor CRUD freeze and future synchronization boundary

Following the owner's sections 61–87 security continuation and successful full production regression (156 tests), Vendor CRUD is completed/frozen. Persistence is PostgreSQL `vendors`; identity is name; CouchDB configuration is url/username/password_encrypted; activation is is_active; last_sequence/date_last_sync/date_last_operation are reserved system-managed runtime fields. Credentials use authenticated reversible encryption with a server-held key. Existing credentials are represented to browsers only by passwordConfigured.

Normal Edit preserves runtime fields even when connection identity or password changes. No checkpoint reset, listener restart, resync or validation behavior is inferred. Name/URL/username have no global uniqueness requirement. Only the primary-key ID index exists; additional search/runtime indexes require justified design. No synchronization health column is persisted.

A future service may conceptually load active Vendors → decrypt server-side → connect/listen/process CouchDB changes → update the three runtime fields. This describes ownership only. Exact synchronization behavior, connection-identity lifecycle and Source Products architecture are not approved or implemented. They require a separate explicit task. The completed security review and all confirmations are in the [activation report](../VENDORS_ACTIVATION_REPORT.md#supplemental-security-review--sections-6187).


## 42. Permanent risk-based testing strategy

The owner explicitly replaced the blanket requirement to run every previous stage's tests after every development task. This rule supersedes older full-regression stage/enabling instructions for future work; historical test reports remain records of what actually ran.

- **Every task:** test the changed module, directly affected shared infrastructure and realistic dependent/integrated modules. Verify TypeScript/build as appropriate. No completion with failing own tests or build. Meaningful implementation stages retain normal production build verification.
- **Impact selection:** inspect actual changed code and its consumers. Vendors/permissions/CSRF/localization/navigation work requires Vendor and relevant integration tests, not automatically deep Media/Profile/Users suites.
- **Shared/core work:** expand scope for authentication, sessions, permission service, localization core, database/migrations, shared Media, shell/navigation, common middleware and common security. Match scope to likely impact; critical authentication/security or architecture-wide changes require a full checkpoint.
- **Complete-suite checkpoints:** explicit request; release/deployment milestone; completion of a major module group; major refactoring; architecture shared by most of the application; critical authentication/security changes; an appropriate health checkpoint after several modules. Plan a full checkpoint after several additional completed modules or before an important release/deployment. Do not invent an automatic full run for each isolated change.
- **Preservation:** do not delete, weaken or skip tests in the full-suite command to reduce routine work. `npm test` remains the complete suite. Targeted invocations select existing test files; all historical tests stay available.
- **Reporting:** identify new tests executed (or none), related regression executed, build outcome, intentionally unexecuted historical suites and impact-based justification. Say targeted regression when only a subset ran.
- **Immediate Vendors application:** complete Vendor/credential tests; Vendor permission integration; relevant registry/permission/authentication/CSRF tests; new Vendor localization integrity; navigation integration; build. Omit unrelated deep Media/Profile/Users suites unless actual shared changes make them relevant. This policy update does not change Vendor runtime behavior or its frozen domain rules.

See [testing commands and selection examples](../README.md#verification). Localized UI work still needs real translations and verification of affected running UI/cache; risk-based scope does not waive localization correctness.

## 43. VendorSyncManager foundation — temporary listener stage

The owner explicitly authorized a separate Nano-based server subsystem after Vendor CRUD, superseding section 41's prohibition on implementing listeners only within this foundation scope. See [VendorSyncManager contract](VENDOR_SYNC.md).

- One process-local managed worker per active Vendor; startup loads active IDs, repeated starts are safe, and workers are independent. Use one enabled application process; distributed coordination is not part of this stage.
- Nano longpoll `_changes` with configurable batch size, `include_docs=true`, and opaque `since`. Process a complete batch before requesting the next one. No per-document fetch architecture, unbounded prefetch or overlapping per-Vendor processing. Global FIFO batch concurrency defaults to five.
- Existing credential encryption is reused server-side. Per-Vendor isolated Nano clients, abortable requests and explicit dispatcher teardown. Only sanitized IDs/codes/counts enter logs; no documents or credentials in logs, events or browser output.
- All HORMAT Vendor lifecycle mutations must go through `VendorService`; direct manual SQL is outside automatic runtime event guarantees. `VendorService` emits sanitized internal lifecycle events only after commit. No Socket.IO. Manager reloads authoritative config, serializes rapid edits, starts active creates/activation, stops deactivation, leaves name-only changes connected, and reconnects on credentials/URL changes.
- Memory sequence starts from existing `last_sequence`, or `"0"` for null. Credential reconnect and same-URL reactivation preserve memory; an observed URL change starts temporary memory from `"0"`. No persisted checkpoint reset. Restart loses temporary progress and replay is expected.
- This stage never writes `last_sequence`, `date_last_sync`, `date_last_operation`, source documents or any business data. No migrations, Source Products, monitoring UI/API, runtime Socket.IO messages, lag thresholds or persisted health fields. Existing UI still reads persisted fields.
- Fixed-code isolated errors, bounded exponential jitter and clean shutdown. Decryption/invalid URL errors wait for corrected settings rather than repeatedly attempting unchanged invalid configuration.
- Validated sync configuration is opt-in (`VENDOR_SYNC_ENABLED=false` by default); disabled listeners leave CRUD usable. Automated tests never contact real Vendors: normal test servers explicitly disable listeners and enabled cases use isolated fake/local sources.
- Future permanent boundary: receive batch → durably process/commit business data → only then persist checkpoint. Durable sync rules and source identity/URL resets require a separate approved stage.
- Test this subsystem, Vendor CRUD/events/credentials, realistic permission/auth/CSRF/navigation integrations and application lifecycle/build under section 42's risk-based strategy. Preserve unrelated historical suites for full checkpoints.

## 44. Sync storage and decoded-document analysis stage

The owner explicitly authorized seven empty synchronization/foundation tables: warehouses, currencies, measures, source_products, product_barcodes, product_stocks and minimal products(id, source_product_id, timestamps). This is an exception to section 43's earlier no-Source-Products-storage stage boundary, not permission to implement mapping or a Products domain.

CouchDB IDs/references are opaque strings, preserved exactly including case/leading zeros; never numeric/UUID-convert them. PostgreSQL uses internal identity PK/FKs, with Vendor-scoped UNIQUE(vendor_id, source_id) and same-Vendor referential integrity. Deletions are conservative RESTRICT. No real source rows are populated by this stage's schema migration.

Product stocks must later be calculated from transaction documents, not directly synchronized from an apparent stock document. Document families and mappings must be reviewed from the real decoded inventory before implementation. Five property fields have no invented semantics. No source-data/checkpoint/timestamp writes, Source Products UI, Products fields beyond the minimal relationship, or stock computation are authorized now. See [storage decisions and current decoder prerequisite](SYNC_STORAGE.md).

### Legacy decode and bounded real-document inventory

The owner supplied the authoritative compatibility blob. `src/vendors/analysis/legacy.ts` preserves the supplied AES-256-CBC, zero IV, legacy key normalization, LEGIT dictionary decryption, `_key2020` derivation and raw+payload merge semantics exactly. Environment override remains LEGACY_KEY_DICTIONARY_BLOB. This sensitive compatibility system must never replace modern Vendor credential AES-GCM, user authentication or session security.

Explicit analysis initializes the dictionary once and injects a decode-before-classify processor into VendorSyncManager/Nano. Raw decode errors/payloads/dictionary/keys/credentials are not logged. Deleted and failed changes are separate statistics. Opaque identity comes from the outer change ID, scoped by Vendor. Discriminators are selected only after observation; structural fingerprints are the initial fallback. The bounded development runner creates aggregate statistics and sanitized examples, never target rows or checkpoints. Disabled synchronization and ordinary CRUD do not initialize the legacy decoder.

Source-type interpretations, references, price/quantity/date/status/property meanings are discussion candidates only. A discovered field or type does not authorize a mapper. Stock remains a later transaction-derived calculation. See [analysis tooling/security/coverage](COUCHDB_ANALYSIS.md) and [real inventory report](COUCHDB_DOCUMENT_ANALYSIS.md).

## 45. Durable CouchDB source synchronization and stock foundation

The owner approved durable mapping after the decoded inventory review. This supersedes sections 43–44's count-only/no-mapping restrictions for the six supported source types only. It does not authorize Source Products UI, the HORMAT Products domain, accounting balances or destructive resync.

- Map depo/olc_umum/z_walyuta/ayar_umum/urun to existing storage, preserving exact Vendor-scoped IDs. Actual source evidence establishes `ayar_umum.paraAdi` for synthetic ordinary currency `z_walyuta-1` and exact `urun.OlcuBirimi → olc_umum._id`.
- Frozen product price is **temelSatisFiyati**; activity is strictly numeric `StatusIsAktif === 1`; OzelKod1..5 remain strings; embedded barcode sets replace prior sets. Existing Products relationships remain untouched.
- The owner's exact 26-row transaction registry defines effects. Only nested fatura uses warehouse effects; quantity is `esasOlc_SayisiToplam`. Only numeric `fatura.sluj_isYanlis === 1` suppresses movements. Never infer extra cancellation/activity rules.
- Document-level snapshots keyed by Vendor + parent source document + internal product + warehouse make stock NEW−OLD, replay-safe and independent of nested line IDs/order. SQL NUMERIC performs arithmetic; atomic ordered UPSERTs preserve negative/zero stock.
- Business writes, snapshot replacement, checkpoint and sync timestamp commit in one Vendor-locked PostgreSQL transaction. Failures/decode errors/unresolved supported dependencies do not advance progress. Unsupported decoded types remain intentionally outside scope.
- Null checkpoint uses a reference prepass without checkpoint followed by a full pass from zero, plus bounded bulk dependency resolution. Never start from now. A reconnect/restart reloads the durable checkpoint; foundation-stage memory is not authority.
- Persist an exact source URL binding in the minimal vendor_sync_sources support table so an incompatible URL change is blocked across restarts. No automatic reset/rebuild/erasure. Deactivation only pauses.
- Deleted transaction snapshots reverse atomically. Deleted products/references are retained conservatively without changing is_active or breaking relationships. No accounting/history domain is created.
- date_last_sync represents committed progress. The owner’s subsequent amendment in section 46 defines date_last_operation from source document edit time; lag is never used as checkpoint.
- This stage adds no UI route, permission, navigation enabling or visible strings. Risk-based module/integration/build verification remains mandatory.

See [durable mapping, bootstrap, lifecycle, limits and evidence](DURABLE_VENDOR_SYNC.md).

## 46. Vendor source edit timestamp amendment

The owner explicitly replaced the unresolved business-operation-date interpretation. `date_last_operation` is the newest valid top-level decoded **uytgeme_tarih** successfully handled in the committed CouchDB stream, independent of business type. `fatura.Tarihi`, nested edit timestamps and `uytgeme_tarih_yen` are not substitutes.

Real source evidence contains explicit offsets (`+05:00`) and optional fractional seconds, including seven-digit legacy fractions. Honor that offset and store the resulting instant in the existing PostgreSQL timestamptz column; do not relabel local wall-clock values as UTC. Offset-less values have no confirmed UTC contract and are ignored as untrusted diagnostic timestamps, along with missing/invalid values. They do not block otherwise valid business processing. No server timezone or receipt-time fallback exists.

At the durable checkpoint transaction, PostgreSQL computes MAX over valid dates from the ORIGINAL decoded changes batch, including unsupported types such as z_waka, then GREATEST with the stored date. Historical replay cannot regress it. Dependency lookups may observe future source states and therefore do not contribute dates before their own stream changes are committed. Reference bootstrap does not advance this diagnostic field before the normal durable pass. Tombstones without trustworthy decoded edit data contribute nothing. Decode/business/SQL failures roll back the entire date/checkpoint/business transaction.

PostgreSQL performs timestamp comparisons and rounds sub-microsecond fractions to its microsecond storage precision; JS Date is not used for aggregation. date_last_sync remains server time of committed sequence progress. last_sequence remains the authoritative checkpoint. No timestamp controls stock/retry/listener correctness. No schema or new UI strings are introduced by this amendment.

## 47. Vendor Reset Sync Data

The owner explicitly authorizes the selected-Vendor reset operation after durable sync. This supersedes section 45's earlier no-destructive-resync scope only for rebuilding derived stock and synchronization progress. It does not authorize deleting source/reference data, changing source identity, or starting Source Products UI.

- `POST /cpanel/api/vendors/:id/reset-sync` uses existing authentication, CSRF, and the separate assignable boolean `vendors.reset_sync`. Exact JSON true or system Super User grants access; view/update/status do not imply reset. The registry automatically includes this definition in Permissions Management. Only an empty JSON object is accepted; route ID determines the authoritative target.
- The dedicated reset service checks current authority before pausing, then rechecks authentication/session/permission in the reset transaction. SyncManager reserves the selected Vendor synchronously, rejects overlapping resets, waits for pending lifecycle reconciliation, aborts and awaits its worker (including durable commit/rollback), and discards memory progress. Lifecycle notifications during the pause are coalesced; other Vendors keep running.
- Under the existing Vendor row lock, one PostgreSQL transaction deletes only that Vendor's `product_stocks` and `source_stock_movements`, writes **text `last_sequence='0'`**, and clears both diagnostic dates. On any SQL error the entire transaction rolls back.
- Preserve Vendor configuration/credentials/status, `warehouses`, `currencies`, `measures`, `source_products`, `product_barcodes`, `products`, and `transaction_types`. Source Product PostgreSQL IDs and Products foreign keys stay valid. No TRUNCATE, source-cache deletion, Media/cache operation or source-identity rebinding is allowed.
- Preserve `vendor_sync_sources`. A mismatching source URL or an unbound legacy non-null checkpoint fails closed. A never-initialized Vendor with a null checkpoint receives its normal binding atomically before reset to zero. Changing CouchDB source identity still requires a separate approved workflow.
- After commit or rollback, reload current authoritative configuration and resume exactly one worker if active and synchronization is enabled. Inactive Vendors stay stopped. A committed reset is never undone because restart fails; return a distinct localized restart-pending result, keep cleared derived state, and use existing bounded configuration/worker retries. Global sync disabled or application shutdown also reports pending for an active Vendor. Async feed/bootstrap failures follow existing runtime error/retry behavior; HTTP success does not claim that historical replay is complete.
- Checkpoint zero, like null, now performs the bounded reference prepass (without checkpoint advancement), followed by the normal full replay from zero. This also supports resetting a never-initialized Vendor. Reference/source UPSERTs reuse stable identities; clearing OLD snapshots with stock ensures history rebuilds from zero rather than cancelling itself.
- The three-dot action has a translated confirmation naming the Vendor and explaining stopped sync, cleared stock/snapshots/checkpoint/dates, retained entities, and active/inactive replay. Submission is single-flight with progress, safe retryable errors, and localized completion/restart-pending feedback. All new keys receive real tm/ru/en PostgreSQL values in migration 029.
- This follows the established **single enabled application process** contract. The per-Vendor process-local gate coordinates all of that manager's workers; it is not a distributed lock across arbitrary additional enabled app processes. Shutdown waits for in-progress reset operations before the pool closes.
- Risk-based verification covers reset authorization/CSRF, transaction rollback, lifecycle/concurrent pause, replay stock, stable source IDs/FKs, isolated production HTTP/Nano replay, UI/localization, and build. Never exercise destructive verification on an unintended real Vendor.

See [reset contract and operational behavior](VENDOR_RESET_SYNC.md).

## 48. Brands UI and proposed reusable content-authoring pattern

Historical UI-stage record. Brands persistence and navigation are now governed by section 52.

The owner authorizes UI-first Brands and postpones Source Products UI until the storefront/Product workflow is designed. This stage creates only authenticated `GET /cpanel/brands`, mock client-side authoring, permission definitions and interface translations. Catalog → Brands remains disabled. No Brands CRUD API/service/repository or domain schema is authorized.

The UI evaluates the following pattern for applicable future content modules. Its first real schema/business implementation still requires UI review and explicit backend approval; do not impose identical tabs on every domain:

- A main entity's textual field contains a usable **base/default** value. Content translations are optional field-level language overrides, separate from PostgreSQL-backed interface localization. A missing/blank override falls back to the base field; opening a language does not create/copy a translation.
- New content starts conceptually `is_visible=false`. Hidden means not intended for storefront visibility, not inactive, deleted or broken. Creation, translation completeness and gallery completeness never publish automatically. An administrator explicitly changes visibility later.
- Create edits the minimum base information only. After successful creation and receipt of an identity, the **same dialog remains open and transforms into Edit**, retaining the selected entity. Only then do dependent sections unlock.
- The owner rejected the separate Translations tab during review. Brands now has exactly **Basic Information** and **Gallery** tabs. Name translations use the inline field component in section 49. Basic, each field’s translations and Gallery have independent drafts, baselines and save/error states. Closing checks all drafts, including collapsed field editors.
- Brands preview contains eight fictional records. Changes remain page-memory-only and reset on reload; only the established Grid/List presentation preference uses localStorage. Every preview/success notice identifies the mock boundary.
- All active registry languages appear simultaneously below the translatable field; there is no content-language dropdown/tab workflow. Save Translations saves only that field’s overrides, separately from Basic/Gallery. Completeness counts explicit usable overrides only. Missing values remain empty and fall back to the current base input as an explicitly unsaved preview when appropriate.
- The owner replaced Gallery Primary semantics with a dedicated nullable Main Image on Basic Information (section 50). Gallery is only an ordered collection. Both select existing filesystem Media through the reusable Picker; optional Upload uses the existing direct permanent upload contract. Brand relationships remain page-memory mocks.
- `brands.view/create/update/visibility` are explicitly authorized future assignable boolean definitions in the central registry. The preview GET requires view; create controls Add, update controls name/translations/gallery, and visibility separately controls is_visible. Super User follows existing semantics. Read-only users can inspect the editor. No brands.delete exists. This is the owner's UI-stage exception to section 36's normal same-task mutation implementation requirement; future activation must provide authoritative validation/authorization on real mutations.
- Small reusable browser state/fallback helpers and EJS translation/visibility/gallery partials support this page. They do not authorize universal entities/translations/galleries tables or speculative domain services.
- Migration 030 contains interface values only, including all real tm/ru/en values for new keys. Exact Brands schema, content-translation persistence, Media linking and deletion/reference semantics remain decisions for backend approval.

Source Products UI is postponed so it can eventually show connected HORMAT Product counts, filter sources without Products, and create/open storefront Products from selected sources. None of those workflows is implemented by Brands.

See [Brands UI contract](CPANEL_BRANDS.md). Risk-based testing remains section 42; this stage checks the new state/UX and directly affected shell, permissions, localization and navigation rather than unrelated deep Media/Sync/Stock suites.

## 49. Approved inline translatable-field UX

Historical UI-stage record. Brands persistence and navigation are now governed by section 52.

The owner explicitly replaces the separate Translation-tab proposal with **TranslatableField** as the default for applicable textual content fields. This is a UI decision; Brands persistence/schema remains unapproved.

- Render a normal base/default input plus a compact end-adornment button using the existing language icon and explicit override count / active language count. Base remains separate from language overrides.
- The button expands/collapses a section directly beneath that field. It is keyboard-operable, has a localized field-specific accessible label/tooltip and aria-expanded/aria-controls. Expansion is presentation only: no save, dirty reset or language switch.
- Render every active registry language together in vertical rows. Do not hardcode three languages, introduce a language selector, or automatically collapse another field when one opens.
- Missing overrides stay empty, count as incomplete and use neutral missing/fallback styling, never required-field error styling. Do not copy base into an empty override. While base has unsaved edits, fallback shows the current input explicitly labeled as an unsaved preview.
- Each field owns a separate translation draft/baseline and saving/saved/error state. Its inline Save Translations cannot save/clear Basic or another field. Basic save cannot clear dirty translations. A compact dirty marker remains on the end-adornment when collapsed. Errors retain the failed draft and allow retry without invalidating another successful save.
- Create requires base Name only, fixes initial visibility Hidden and locks translation expansion/Gallery until the mock identity exists. The same dialog remains open and becomes Edit; both controls unlock subject to existing independent edit capabilities.
- Brands has exactly Basic Information and Gallery tabs. Gallery remains a separate relationship section; no invisible obsolete Translations tab or duplicate editor/state exists.
- Reusable implementation: content `DraftState`, `TranslatableField` browser module, `translatable-field.ejs` and scoped component CSS. Callers supply field identity/label, active languages, lock explanation and persistence adapter; no universal tables/services are introduced.
- Migration 031 adds five component interface keys with real tm/ru/en values. UI remains mock-backed and roadmap Brands stays disabled. Real Brand/content-translation/gallery persistence requires a later approved task.

See [inline field contract](TRANSLATABLE_FIELD.md) and [current Brands UI](CPANEL_BRANDS.md).

## 50. Brand Main Image, ordered Gallery and reusable Media Picker

Historical UI-stage record. Brands persistence and navigation are now governed by section 52.

The owner approved inline translations and explicitly revised the media UI. Main Image is one nullable media reference on the main Brand concept; Gallery is a separate ordered set of additional references. Gallery has **no Primary/is_primary** state. Exact future column/reference/FK choices remain unapproved; no Brands/content-translation/gallery schema is created.

- Basic Information owns base Name, visibility and Main Image. Selecting/replacing/clearing Main Image dirties Basic only. Its saved reference supplies Grid/List imagery; an absent/non-image/unavailable preview uses a clean placeholder. Gallery order never supplies the card image.
- Gallery independently owns ordered references, Add Media, and top-right three-dot menus containing explicit earlier/later ordering and Remove from Gallery. Boundaries disable ordering actions. Duplicate Gallery paths are excluded; Main Image may independently reference the same path. Clearing/replacing/unlinking never deletes files or changes another relationship.
- Create locks Main Image, inline translations and Gallery until the mock identity exists. The same dialog remains open and becomes Edit. Existing separate brands.update/visibility capabilities remain authoritative for UI; no new permission definitions are introduced.
- The reusable Media Picker uses existing File Manager filesystem listing/search partials and Details reads under media.view. It does not invent directories, storage or a Media catalog. Folder navigation, current/all search, Grid/List, previews and single/multiple selection use the same source. Selected references are re-read before confirming to catch deletion/revocation/type changes. Brands requests image-only eligibility for both Main Image and Gallery; non-image files remain visible but unselectable. This does not restrict universal Media upload.
- Optional Picker Upload requires media.upload and calls existing CSRF-protected direct permanent upload, one file per request, unrestricted types, maximum 10 MB. It is intentionally real even while Brand relationships are previews. The localized notice explains uploaded files survive cancelled selection. No domain cacheToken/finalization flow or new upload backend exists.
- Brand controls open the Picker, never a native local-file chooser. Only Picker Upload opens local selection. Cancel/Escape returns to the same Brand draft without selection changes. The Picker temporarily occupies the existing Bootstrap dialog surface/focus trap; it does not stack independent backdrops or close the Brand dialog.
- The normal eight Brand fixtures start with empty media references; no fake storage files are advertised. Actual filesystem references can be selected during review. Automated scenarios create disposable files only in the isolated test Media root.
- Migrations 032–033 add interface strings only. Risk-based coverage includes Brands, Picker/Media reads and direct mutations, localization, shell and build. Source Products, Categories, Brands persistence and navigation enabling remain outside scope.

See [Media Picker contract](MEDIA_PICKER.md) and [Brands UI](CPANEL_BRANDS.md).

## 51. Consolidated Brands UI acceptance

Historical UI-stage record. Brands persistence and navigation are now governed by section 52.

The owner explicitly makes acceptance groups A–R (specification sections 102–122) authoritative over overlapping or superseded Brands revision checklists. This is a scoped replacement of duplicated Brands acceptance tests, not permission to remove valid architectural requirements or weaken unrelated historical regression coverage.

- Final model: Basic Information owns base Name with inline per-field translations, dedicated Main Image and visibility; Gallery owns ordered additional Media. Sections 48–50's UI-first and separate save/permission boundaries remain unchanged.
- Maintain one functional Create → Edit lifecycle, one Gallery action scenario, one authoritative three-scope save sequence and one consolidated language/theme/responsive review. Do not replay the whole authoring workflow separately for tm/ru/en or execute earlier equivalent acceptance versions.
- Keep distinct fault/security regressions: failed saves, registry language growth, image eligibility revalidation, Media authorization/CSRF and stale search replies. Shared setup is not an additional acceptance scenario.
- Obsolete separate Translation tabs, Gallery Primary, Gallery-derived Main Image, normal Brand-owned local-file selection, physical Media deletion, Save All and Delete Brand have no implementation or positive acceptance expectations.
- Final reporting uses one compact acceptance table and the final architectural confirmations. PASS requires actual verification; document partial/deferred results precisely. Testing selection remains risk-based under section 42.

See [consolidated acceptance ownership](BRANDS_ACCEPTANCE.md). UI review does not authorize persistence or Source Products work.

## 52. Brands activation — persistent content-module contract

The owner approved the revised Brands UI and explicitly authorized real persistence. This section supersedes the mock-only/schema-pending/navigation-disabled boundaries of sections 48–51; their approved interaction design remains. Exact schema, HTTP bodies, permissions and reference rules are in [Brands contract](CPANEL_BRANDS.md).

- PostgreSQL is the sole production source: `brands`, `brand_translations`, `brand_media` (migration 034). Fixtures remain in tests only. The main record contains required trimmed base `name` (1–200 characters), nullable dedicated `main_media_reference`, hidden-by-default `is_visible`, authenticated staff attribution and timestamps. Names are not globally unique. No Brand Delete or Gallery Primary exists.
- `brand_translations` uses the existing text language-code FK and `(brand_id, language_code)` PK. Only active registry languages may be submitted. A usable override wins; otherwise the separate base Name is used. Clearing an override deletes it. Unsubmitted/inactive rows are preserved. No mandatory translations or automatic translation rows.
- `brand_media` uses `(brand_id, media_reference)` identity and a deferred unique `(brand_id, sort_order)` constraint. Gallery order is contiguous from zero when saved. Child Brand FKs use ON DELETE RESTRICT; staff attribution uses ON DELETE SET NULL. Existing updated_at trigger conventions apply. No fake FK to a Media asset table.
- Permanent Media identity is the existing root-relative filesystem path. Preview URLs are derived through Media services, never persistence identity. New references use existing path/root/symlink and actual image checks, require media.view and exclude temporary cache files. Existing missing files retain DB relationships and render placeholders. Brands does not copy, finalize, physically delete or automatically repair Media references.
- Create accepts base Name only, returns the real ID after commit, keeps the same dialog open and unlocks inline translations/Main Image/Gallery. It creates no dependent rows and does not publish. The reusable content-authoring pattern is now established for applicable modules: minimum base Create → real ID → same-dialog Edit → independent sections → explicit visibility. It is not a mandatory tab schema for every future domain.
- Basic, inline Name translations and Gallery remain independently saved. PATCH Basic sends only changed permitted fields. Visibility has its own `brands.visibility` requirement even when submitted with Basic; `brands.update` cannot publish. Translation writes require brands.update and touch no other content scope. Gallery full-form Save requires brands.update and compares an original ordered baseline under a Brand lock; stale saves fail with 409 rather than lose another administrator's changes. New Gallery links need media.view; reorder/unlink does not need Media upload. Maximum current Gallery payload is 200 unique references and JSON body limit is 512 KB.
- Services validate allowlisted payloads and current authentication/session/exact-boolean permissions inside transactions; repositories own parameterized SQL. Server-managed fields are never accepted. Failures roll back a whole save scope; UI keeps drafts and does not report false success. No timer/local-only production save remains.
- List/read require brands.view. The four existing registry permissions remain independent; Super User uses its normal bypass. Catalog → Brands is enabled only after activation checks pass and uses effective brands.view. Source Products remains disabled/postponed.
- Real base-name search is case-insensitive and literal (not translation search), visibility defaults All; page size is nine. Grid/List use one result source. Abort/generation checks prevent stale search rendering.
- Reusable Picker adds permanentOnly and initialSelection options; it still delegates browsing/search/details/upload to existing Media. Universal explicit upload remains any type, 10 MB/file; Brands can link eligible permanent images only. No new upload architecture or frozen Media schema/business-rule change.
- No approved audit-event domain comparable to these mutations exists; none is invented. Staff attribution is recorded; immutable Brand audit history remains future work.
- Migration 035 adds ten real tm/ru/en interface messages. Database migrations and live localization cache/browser verification are part of activation. Interface and entity-content translations remain separate.
- Risk-based regression follows section 42: Brands schema/service/security/production workflows, Picker/shared Media operations, registry, CSRF, localization, navigation/shell and build. Deep Vendor sync/stock/Profile/Users suites are not required unless their shared dependencies change. Existing applicable tests remain; preview-only expectations are replaced with durable persistence expectations.

See [activation report](../BRANDS_ACTIVATION_REPORT.md) for executed checks and limitations. No Categories or Source Products UI is authorized by this stage.

### Brands final pattern confirmation (owner continuation 127–154)

```text
Brand
├── Base/default Name → optional language-specific overrides
├── Dedicated nullable Main Image reference
├── is_visible (new record: false)
└── Ordered Gallery references (no Primary)
```

Applicable future content modules should reuse the approved authoring pattern: create the minimum base entity → receive its real ID → the same dialog becomes Edit → unlock dependent content. Translatable text fields use an inline end-adornment/count and collapsible editor with all active languages together; the separate base field remains fallback. Each persistence scope saves independently. This does not authorize Categories, Products, Source Products, Delete or storefront work. See the completed [Brands report](../BRANDS_ACTIVATION_REPORT.md) for the final completion table and explicit confirmations.

## 53. Approved Brands SEO and Product-count extension

The owner explicitly extends the frozen Brands schema and temporary Products relationship only (migrations 036–037); no full Products domain or Categories work is authorized.

- `brands.slug` is required, unique, non-translated text (1–120 lowercase ASCII letters/digits separated by single hyphens). Service trims, lowercases and converts whitespace to hyphens; invalid paths/characters are rejected. Existing rows receive `brand-<id>`; minimum-name Create receives a collision-resistant `brand-<uuid>` slug, editable after creation. Name changes do not change it. No storefront route or redirect/history service exists yet.
- Base `seo_title` and `seo_description` are non-null text defaulting to empty, with limits 200/2000 characters. They belong to Basic Information with Name, slug, Main Image and visibility; brands.update protects SEO/slug, brands.visibility remains separate.
- `brand_translations` adds nullable seo_title/seo_description overrides. Its name becomes nullable so SEO-only overrides do not manufacture a Name translation. The existing `(brand_id,language_code)` PK/FK remains. Per-field translation requests use `{field,translations}`, where field is allowlisted name/seo_title/seo_description; omitted field retains the existing Name contract. Blank clears only that field; delete the row only when all three overrides are null. Other fields/languages remain intact. Each field has its own draft, completeness and inline Save. Missing overrides fall back to the corresponding base field.
- Basic Information now includes an SEO block with Slug, inline SEO Title and multiline SEO Description. All active languages render together for each field. No SEO/Translation tab or content-language selector is added. Create remains minimal Name-only and hidden; SEO appears after the real ID is received.
- `products.brand_id` is nullable bigint FK to brands(id), ON DELETE RESTRICT, indexed. Existing source_product_id and its FK/semantics stay unchanged. Counts are computed from products per Brand, never persisted in brands. Grid/List and the new read-only Products tab share the returned productCount. Presentation uses the existing localized `Products: N` label/value convention.
- Products is a third informational tab, locked before Create; it contains the real count and a localized future-management notice. No attach/detach/search/picker/edit endpoint or control exists. Brand view authorization covers counts. No additional permissions.
- Nine interface keys receive all 27 real tm/ru/en values. Current totals: 441 canonical keys, 1323 values, 414 used UI keys.
- Owner-requested minimal verification: focused Brands SEO/migration/slug/translation isolation/Product FK/count and UI Create/Edit/placeholder/localization tests plus build. No historical Brands/Media/Vendor/stock/Users/Profile suite rerun.

## 54. Permanent amendment: separate SEO tab and save scope

The owner replaces section 53's placement of SEO inside Basic Information. For applicable public-facing content modules (Brands, Categories, Products, Custom Pages), prefer **Basic Information → SEO → Gallery → domain-specific tabs**. This is reusable UX guidance, not authorization to implement another module. Translations remain inline on their own fields with all active languages together; never create a separate Translations tab.

Brand Edit now has Basic Information, SEO, Gallery, Products. Basic owns Name/Main Image/Visibility only. SEO owns slug/base seo_title/base seo_description and Save SEO. Create remains Name-only, hidden, same-dialog Create → Edit; SEO and all dependent sections unlock only after receiving a real ID. Products remains informational.

`PATCH /cpanel/api/brands/:id/seo` accepts only changed slug/seo_title/seo_description under existing brands.update + CSRF. Basic PATCH rejects these keys and accepts only its existing Name/Main/Visibility contract. Repository updates are physically separate SQL column lists; each may touch authenticated updated_by/updated_at but cannot write the other content scope. Response `row.seo` is separate from `row.basic`; separate client drafts, baselines, dirty/error states and Save buttons prevent cross-scope saving. Each inline translation field still saves through the existing independently scoped translation endpoint. SEO Save cannot modify translations, Gallery or Products.

Migration 038 adds only the Save SEO label with real tm/ru/en values. No business schema change/new permission occurs. Verification is restricted to this amendment's persistence isolation, Create unlock, inline SEO translations, Light/Dark and build.

## 55. Categories UI preview and shared content editor

The owner authorizes authenticated `GET /cpanel/categories` as a **UI-only** module. Require `categories.view`; register future assignable boolean categories.create/update/visibility with all tm/ru/en labels. Super User uses existing bypass. Mutation capabilities control the preview; no Category mutation endpoint, service/repository, PostgreSQL business table or products.category_id/FK is introduced. Catalog → Categories stays disabled pending backend approval, consistent with roadmap readiness rules; review uses the direct route.

Categories browse direct children like folders. Click identity/Open to enter a category, use breadcrumbs to return to ancestors, and recursively search Names with parent paths shown. Grid/List share the filtered data. A hierarchical searchable parent picker supports arbitrary nesting; self and descendants are unavailable, with a second page-memory save guard. Root/current-folder parent is the Create default. New previews start Hidden. Mock totals sum direct products over the category and all descendants; they are not SQL or persisted counts.

Brands and Categories share `content/entity-editor.js` and `content/entity-dialog.ejs` for same-dialog Create → Edit, Basic/SEO/Gallery independent drafts/saves, inline Name/SEO translations, Main Image, Media Picker, Gallery order/removal and unsaved-close handling. Domain adapters supply real Brands persistence or Categories page-memory preview operations. Shared internal `brand-*` DOM IDs are retained for compatibility, only one editor exists per page. The Category-only extension supplies parent/path and Direct/Including-subcategories product presentation. No separate Translations tab, Gallery Primary, Delete or Product attachment controls.

Category fixtures and edits live only in page memory and reset on reload. Visible preview/save text explains non-persistence. Media browsing/selection reuses the real picker under media.view; optional upload retains its existing real permanent-upload notice and media.upload permission. Clearing/removing Category mock relationships never deletes Media. Interface languages remain PostgreSQL-backed, active languages feed each inline field dynamically, and language switching returns to Categories. Migration 039 adds 25 interface/permission keys (75 values) only.

Verification is scoped to Categories recursion, breadcrumbs/search, parent exclusion, Create/Edit, shared fields/media/gallery, visibility, product placeholder, themes/responsive layout, registry/localization and build, plus a short Brands shared-editor smoke. No unrelated deep historical suite is required. Backend schema, real cycle validation, recursive SQL counts, Product category relationship/attach/detach, Delete and Source Products UI remain deferred until explicit approval.

## 56. Activated Categories — persistent recursive content module

The owner approves real Categories persistence, superseding section 55's preview-only boundary. Keep the approved folder/browser and four-tab editor. Do not start Product or Source Product management, Category Delete or Product Attach/Detach.

- Migration 040 creates categories, category_translations and category_media using the same bigint identity/FK, timestamptz, attribution and trigger conventions as Brands. categories.parent_id is a nullable self-FK (NULL=root), with ON DELETE RESTRICT and a self-parent CHECK. Products gains only nullable indexed category_id; source_product_id and brand_id are unchanged. Counts are never persisted. Filesystem Media identity remains the safe root-relative path with no fake Media FK.
- All application hierarchy writers must use CategoriesService. Create/Basic transactions lock actor auth/session, acquire the Categories hierarchy advisory transaction lock `(4840,1)`, then read/validate the parent chain and lock/update the target. Serialized hierarchy mutations prevent concurrent inverse moves from both succeeding. Fresh READ COMMITTED reads occur after obtaining the lock. Self/descendant parent choices fail before UPDATE; a move changes only the selected row's parent_id. Trusted direct SQL/imports must follow this protocol; the database FK/self-check alone is not a general graph-cycle validator.
- Server-resolved ancestry uses a recursive CTE with visited IDs and rejects malformed cyclic ancestry without looping. Direct-child browser/search pages are bounded to 50 rows, with root=NULL and base-name literal ILIKE search across the whole hierarchy. A single batched recursive closure computes totals for all page IDs, with separate direct Product/child counts; no per-card recursive query. Recursive UNION deduplication terminates counts even for malformed graphs. Breadcrumbs/search paths come from authoritative rows, never browser-supplied paths.
- The Parent picker loads nested branches/search pages on demand through the same view-protected list API. Server marks self/descendant choices unavailable; save revalidates independently. Picker paths and cards are presentation only. Query generations ignore stale replies; hash changes restore folder navigation.
- Create takes only Name/parent_id, starts Hidden, generates a unique `category-<uuid>` canonical slug and returns a real identity into the still-open shared Edit dialog. Empty base SEO is nullable in SQL and represented as empty form text. Slug normalization/uniqueness/format and field limits match Brands. Name remains non-unique.
- Basic, SEO, each inline translation field, and Gallery remain independent. categories.update cannot change visibility; categories.visibility cannot change name/parent/media. Visibility affects exactly one Category, not descendants or Products. Only known mutable fields are accepted. Blank field translations clear that override and preserve other fields; all-empty translation rows are deleted. Only active registry languages are accepted; base/default text remains fallback.
- Main Image/Gallery reuse existing actual Media inspection/path safety and media.view for newly selected permanent images. Gallery keeps ordered unique references and original-baseline conflict detection. Reorder/unlink does not physically delete Media; no Primary exists. Missing linked files preserve references with placeholders. All mutations use existing authentication, fresh transaction permission checks, CSRF and safe stable errors.
- Catalog → Categories becomes enabled after activation verification, requiring effective categories.view (or exact Super User). Existing four definitions remain; no new permission is invented. Source Products stays disabled. No audit domain is introduced; actor attribution follows Brands.
- Migration 041 adds three interface keys / nine real tm/ru/en values. PostgreSQL now replaces page-memory Category fixtures; mock counts/save behavior are removed. Test fixtures remain isolated and disposable. Targeted Categories schema/hierarchy/concurrency/counts/persistence/media smoke/permissions/CSRF/navigation/localization/build verification replaces unrelated full-suite runs.

See [Categories contract](CPANEL_CATEGORIES.md) and migrations 040–041 for exact schema and scope.

## 57. Focused Category Move action

The owner adds Move to the Category action menu under existing categories.update. It opens a dedicated confirmation dialog using the **same mounted Parent picker**, moved temporarily into that dialog and restored to Edit on close; no second tree or duplicate picker IDs/logic. Show Category, current parent path and selected new full path. Root is allowed; current parent is disabled. Self/descendant choices use existing server-derived picker exclusions.

Confirmation sends only `{parent_id}` to existing CSRF-protected PATCH `/cpanel/api/categories/:id`. The existing Basic transaction rechecks categories.update and serializes/validates hierarchy moves. A parent-only body uses narrow repository SQL updating parent_id and normal updated_by/updated_at metadata, never content fields, dependent records or Products. ID, creation metadata, Name/SEO/translations/Main Image/Gallery/visibility and every descendant's direct parent remain intact. Counts and breadcrumbs derive from the changed graph; refresh removes a moved child from its old listing. No new route, permission, business schema, Delete or Product-management capability.

Migration 042 adds only three real tm/ru/en dialog labels; Move/Cancel/success reuse existing semantic labels. Verify only focused preservation/counts/cycle/permission/CSRF/Move UI/localization and build; no full Categories or other domain regression.

## 58. Discounts UI preview

The owner authorizes UI-only authenticated `GET /cpanel/discounts` under discounts.view. Catalog → Discounts remains disabled until separately approved backend activation. Four assignable boolean definitions (discounts.view/create/update/visibility) use the central registry; no discounts.delete. Controls respect independent capabilities. No Discount mutation endpoint/service/repository or domain table exists; interface migration 043 adds 33 keys with real tm/ru/en values only.

Create requires base Name and integer Priority, starts Hidden, and retains the same open dialog/mock identity when entering Edit. Tabs are Basic Information, Rules, Products: no SEO, Main Image, Gallery or separate Translations tab. The existing TranslatableField renders all active registry languages and fallback to base Name. Basic, Name overrides and Rules have independent drafts/saves; tab switches retain drafts and closing warns about unsaved changes. Explicit preview notices explain that all changes reset on reload. Grid/List share base-name search and default All visibility; mock counts/dates are illustrations, not real Product relationships or date-status calculations.

Basic holds Name/Priority/Visibility and optional local date/time inputs with explicit No start date/No end date controls. Final backend timezone/validation details remain for activation. Rules holds independent Before/After action/value pairs, exact internal actions addAmount/addPercent/fixed/removeAmount/removePercent, localized labels and descriptive previews only. No Product prices, date applicability, priority sorting/winner selection or stacking engine is implemented. The future approved pricing concept computes Before/After independently and uses the higher resulting discount; priority governs applicable-discount selection under separately finalized rules, never automatic stacking.

Future many-to-many relationship: product_discounts(product_id, discount_id), conceptually UNIQUE(product_id, discount_id). Do not add products.discount_id or a persisted products_count. Products currently displays an illustrative count and future-management notice. Attach/Detach, Delete, pricing and all Discount/content-translation persistence remain deferred for UI review and explicit backend/schema approval.

Verification remains focused on this UI, registry metadata and localization/build. `npm run localization:verify -- --scope=discounts` verifies actual current-server tm/ru/en labels and topbar language routing without running historical domain mutation checks. See [Discounts UI](CPANEL_DISCOUNTS.md).

### Discounts presentation-only name flag

Owner-approved UI addition: Basic Information has `isVisibleOnProduct`, default false, saved independently with that Basic draft. It controls only whether the Discount NAME may be shown on future Product/storefront UI. It is separate from `is_visible` and must never influence applicability, priority, Before/After calculations, winning Discount or final price. The future approved storage contract is `discounts.is_visible_on_product BOOLEAN NOT NULL DEFAULT FALSE`; no Discount schema/backend is created at this UI stage. The switch uses ordinary create/update UI capability, not availability/visibility permission. Existing footer and save scopes remain unchanged. Migration 044 adds only label/helper tm/ru/en values.

## 59. Activated Discounts

Owner approval activates the existing Discounts UI with PostgreSQL; this supersedes section 58's preview-only persistence/navigation boundary. No pricing engine, winning-priority direction, stacking, Source Products or Product attachment management is approved.

Migration 045 creates only discounts, discount_translations and product_discounts. Main rows use bigint identity, staff SET NULL FKs, timestamptz/updated_at triggers, nonunique trimmed base Name, integer Priority, nullable date boundaries, separate Before/After action and NUMERIC value pairs, and false defaults for both visibility flags. Allowed action values remain exactly addAmount/addPercent/fixed/removeAmount/removePercent. The owner explicitly selected percent range 0–100 inclusive; amount/fixed values are nonnegative, nullable values represent incomplete rules. No applicability interpretation of incomplete rules is implemented. Main default actions preserve the approved editor defaults (removePercent/removeAmount); values start NULL.

`is_visible_on_product` remains presentation-only and requires discounts.update. `is_visible` independently requires discounts.visibility. Create accepts only Name/Priority, starts both flags false, returns a real ID and keeps the dialog open. The name-display switch unlocks after Create to ensure the approved false default. Basic, Rules and inline Name overrides retain independent saves/drafts and the existing shared footer. Product counts are computed from product_discounts, never stored in discounts; Grid/List/Products show those real counts. Products remains informational.

DiscountsService rechecks active session and exact permissions in a transaction under the established actor-auth/session lock order; repository SQL owns persistence. Row locks serialize narrow scope writes. Basic accepts only changed approved fields and cannot write Rules/translations. Rules accepts exactly four action/value fields and cannot write Basic. Translation upserts/deletes only submitted active-language overrides, preserves omitted languages, and falls back to base Name for empty/missing overrides. Errors leave drafts dirty; no mock IDs/fake saves or production fixture source remain. Catalog → Discounts is enabled only following activation checks, gated by discounts.view independently of module availability.

Rule API decimal values are canonical decimal strings (up to 128 characters), or NULL, never JS floating-point conversion; stored NUMERIC precision is not rounded to currency. Date API accepts explicit UTC ISO instants with seconds and optional millisecond precision; the browser converts local datetime controls to/from UTC. Date range must satisfy start <= end when both are present. Nullable boundaries mean no boundary; no automatic activation/scheduling occurs. Inputs and enum/boolean/language fields are allowlisted, parameterized and CSRF-protected. Search is literal base-name ILIKE, All visibility default, nine rows/page, stale-response generation protection.

product_discounts uses composite PK(product_id,discount_id), restrictive FKs and created_at; priority belongs to discounts. Product schema is not modified. No Delete API or audit domain is invented; staff attribution follows comparable content modules. Migration 046 supplies four activation message keys in tm/ru/en. See [Discounts contracts](CPANEL_DISCOUNTS.md) for exact API/schema/verification.

## 60. Currencies configuration UI preview

The owner authorizes UI-only Frontend Currencies and Vendor Currency Rates before Products. **Explicit menu exception:** the owner approved opening both UI menu links for review before persistence. Marketplace → Currencies contains Frontend Currencies (`/cpanel/currencies/frontend`) and Vendor Currency Rates (`/cpanel/currencies/vendors`), independently gated by their view permissions. This does not activate currency/rate persistence or relax the roadmap rule for other modules.

Register six assignable boolean definitions: currencies.frontend.view/create/update/visibility and currencies.vendor_rates.view/update. No Delete permissions. Authentication/GET access checks are real; mutations remain local preview interactions with visible non-persistence notice. Permissions Management receives the registry definitions normally; no automatic user grants.

Frontend Currencies has Name/Code/Symbol/Rate/Visibility/Sort Order, base-name/code/symbol search, All/Visible/Hidden, mock Create → Edit in the same dialog, independent availability control and explicit page-memory saved status. New previews begin Hidden and require a configured positive decimal rate; no SEO/Gallery/Products tabs or Delete. Three illustrative frontend currencies are fixtures, never DB rows.

Vendor Currency Rates **reads the existing synchronized currencies table** scoped by vendors.id. Read-only `/cpanel/api/currencies/vendors` exposes only safe Vendor identity and currency id/source_id/name; no credentials or new source catalog. Vendor search returns 50 matches and may be refined. A selected Vendor returns at most 1,000 synchronized currencies with an explicit limit notice. These are UI-read bounds, not a frozen backend-management contract. Rate drafts are separate page-memory values keyed by the existing currency ID. Unknown rates stay blank/Not configured, including synthetic main currency; never silently assume 1. Empty input clears the illustrative configuration; otherwise a positive plain decimal is required. Vendor selection/Refresh preserve page-memory drafts; reload discards them. No writes to synchronized currencies, Vendors, source prices or rates, no sync events, no new business schema.

Future pricing contract (documentation only): `display_price = source_product.price × vendor_currency_rate ÷ frontend_currency_rate`. A rate means one unit of that currency equals rate units of the common internal main-currency normalization basis. Example: source 12 Vendor USD × Vendor rate 20 ÷ Frontend USD rate 15 = 16 USD. No Product price engine, currency conversion, real rate configuration, speculative rate tables or frontend currency table is implemented. Future persistence will use PostgreSQL NUMERIC; decimal inputs preserve strings rather than rounding rates through floating-point arithmetic.

Migration 047 adds only 30 UI/permission keys with real tm/ru/en values. Targeted Currencies UI/menu/access/real-source-read/localization/theme/build checks are sufficient; no Catalog/Vendor Sync/Stock regression. See [Currencies UI review contract](CPANEL_CURRENCIES.md).

### Currency presentation revision

The owner-approved revision supersedes the Vendor selector and 1,000-row presentation described above. Both currency pages now provide Grid/List over the same dataset, preserving query/filter and remembering view per page. Frontend Name uses the existing inline TranslatableField with active registry languages, base fallback and an independent preview translation save. Create still unlocks overrides in the same open Edit dialog; no separate Translation tab.

Vendor Currencies initially lists synchronized currencies across all Vendors, with parameterized composed-identity search and 50-row pagination. `VendorName.CurrencyName` is presentation only; source names/IDs remain unchanged. The read-only endpoint accepts query/page and returns safe currency/vendor identities. No Vendor selector, Add, visibility or translated Vendor currency name is introduced. Its normal Edit dialog shows identity and edits only Rate; Close and Save Rate share the footer. Missing rates stay blank/Not configured, and configured rates must be positive decimals. Page-memory rates survive search/view/Refresh but reset on reload. Migration 048 contains only six interface keys in tm/ru/en and the revised Vendor Currencies title; no business persistence, source mutation or pricing is authorized.

## 61. Activated Currency Configuration

Owner approval activates both Currency screens without a UI redesign. This supersedes section 60's mock persistence and rate-fallback boundary. Frontend Currencies and Vendor Currencies remain enabled under Marketplace → Currencies and their independent view permissions. No Product/storefront integration is authorized.

- Migration 049 creates only frontend_currencies, frontend_currency_translations and vendor_currency_rates. Frontend uses bigint identity, base name/code/symbol, nullable unrestricted NUMERIC rate, Hidden default, integer sort_order, staff attribution and normal timestamptz/update triggers. No unapproved global name/code uniqueness is inferred. Translations use the existing text language registry FK and composite entity/language PK; usable override wins, otherwise base Name. Empty override deletes only that language; active-language validation and independent inline Save remain.
- Vendor currencies stay in the synchronized currencies registry. A LEFT JOIN exposes every source currency whether configured or not, composed VendorName.CurrencyName search, 50-row pagination and the same Grid/List. The configuration table has currency_id PK and composite (vendor_id,currency_id) FK to the already-existing unique source pair. No source schema or synchronization behavior changes. Rate-only transactions lock the source identity, validate ownership and UPSERT configuration, or DELETE it for NULL. No source row/name/runtime field is mutated.
- Stored NULL/missing means administratively **Not configured**, whereas stored 1 remains an explicit configuration. Never manufacture rows or write 1 for fallback. Configured rates must be positive finite NUMERIC; API transport uses decimal strings (max 128 characters) or NULL. Blank UI sends NULL. Frontend rates are nullable too; new Frontend records start Hidden, with optional rate and sort default 0. No Delete workflow.
- `src/currencies/conversion.ts` is the sole conversion implementation: PostgreSQL NUMERIC `sourcePrice * COALESCE(vendorRate,1) / COALESCE(frontendRate,1)`, returned as a decimal string. It validates inputs, does not write configuration, and uses PostgreSQL's numeric division scale without JS floating-point arithmetic or storefront rounding. Repeating fractions necessarily use PostgreSQL's division precision; final Product currency rounding is deferred. No Product price engine or storefront selector is added.
- Six existing exact-boolean permissions independently gate reads/create/update/visibility/vendor rate updates. Services revalidate actor auth/session/permissions in the established transaction/lock order. Frontend Basic sends only changed fields; update cannot bypass visibility. Vendor mutation accepts only rate; authoritative identity comes from route parameters plus database lookup. CSRF precedes bounded JSON parsing. Errors are safe/localized, retain unsaved drafts and permit retry; production mock data/fake saves are removed.
- Same-dialog Create → Edit returns the real ID and unlocks inline translations. Basic and translation saves remain independent; responses never clear another scope's dirty draft. Each Vendor Edit loads the current rate and saves only that setting. Search generations prevent stale responses; both view preferences remain browser-local. No new audit subsystem is introduced; attribution follows existing content modules.
- Migration 050 adds two real tm/ru/en interface keys. Targeted tests cover currency persistence/schema/translation isolation/ownership/decimal conversion, six permissions, CSRF, live UI/reload, localization, registry/navigation and build. Catalog/Vendor Sync/Stock/Users/Profile full suites are intentionally excluded because their shared infrastructure/domain code is untouched.

See [Currency Configuration contract](CPANEL_CURRENCIES.md).

## 62. Languages UI over the existing registry

The owner requests only Languages UI as the next system-reference stage. Payment Types, Delivery Types, Settings and Products remain deferred. No second registry, numeric Language ID, management mutation API, schema change, translation editor or deletion is authorized.

- Authenticated GET `/cpanel/languages` requires `languages.view`. Reuse the existing System → Localization → Languages location and globe icon; the requested UI route/menu is available for review with effective languages.view, while persistence remains unactivated. This is a scoped preview navigation exception, not general permission to enable other unfinished modules.
- Read existing languages (including inactive definitions) and grouped real interface translation counts; render a safe snapshot. Existing storage name is `display_name`; identity remains `languages.code`. An absent TR is added only to that page's review snapshot as inactive/non-default with count 0. It never enters PostgreSQL, localization cache, cookie selector or any content translation registry.
- Grid/List share name/code live search, All default status filter and sort_order/code ordering. The view preference alone is stored locally. Preview mutations live only in page memory and have explicit preview feedback; reload restores real registry data plus the review fixture.
- Create accepts Code/Name/Sort Order and starts inactive/non-default. The same dialog stays open in Edit, with immutable Code and Active/Default controls. Names are native registry labels, without inline translations. New-code regex matches the existing lowercase registry syntax; current preview inputs cap code/name at 35/200 characters and integer order at PostgreSQL INTEGER range. Final mutation validation is deferred to backend approval; no current schema is changed by these UI bounds.
- A preview always has one active Default. Setting another Default clears the previous flag and activates the selected row together. Current Default's active/default switches cannot be cleared directly; choose another Default first. `languages.default` permits that activation as part of default selection; `languages.status` alone cannot change default. Inactive rows remain manageable; no Delete exists. Closing a dirty editor warns before discarding.
- Register five assignable booleans: languages.view/create/update/status/default. Read authorization is real; remaining capabilities control independent preview actions only. No automatic permission grants, new roles or persistence behavior. The existing language cookie flow is unchanged except adding this legitimate return destination.
- Migration 051 contains only 21 semantic interface keys with real tm/ru/en values. Existing common labels are reused. Minimal verification covers Languages UI/safeguards/permissions/navigation, fresh localization integrity, live tm/ru/en, themes/responsive and build, never unrelated Catalog/Currency/Vendor/Stock regressions.

See [Languages UI](CPANEL_LANGUAGES.md). Backend activation and safe rollout of newly active languages remain a separate task.

## 63. Activated Languages and Default readiness

Owner approval activates registry management and supersedes section 62's preview-only boundaries. Reuse `languages.code` / `display_name` and all existing relationships. Migration 052 adds only missing updated_at, immutable-code enforcement and inactive new-row default; no duplicate registry, numeric IDs or destructive seed. Existing tm/ru/en definitions, translations and current Default remain unchanged.

Create is inactive/non-default and transitions to Edit without closing. Metadata, active state and Default require their independent existing languages.* permissions; backend authorization/session revalidation and CSRF are mandatory. All registry mutations serialize transactionally. Exactly one active Default remains enforced; current Default cannot be deactivated/unset. Setting a new Default also activates it atomically.

**Approved clarification:** incomplete languages may be active with fallback to the existing Default. Assigning Default requires usable translations for every key currently provided by the old Default; reject incomplete assignment without partial changes. Translation editing remains deferred. Code is immutable after Create. No Delete workflow.

Committed mutations invalidate/reload the existing localization cache, with revision tracking across concurrent refreshes and retry on subsequent requests after refresh failure. A committed save is not reported as rolled back merely because cache refresh failed. Active selector/name/order and inactive-cookie fallback follow the current registry; no second localization state. Cache invalidation is local to the current single-process application deployment.

Migration 053 adds four real tm/ru/en messages. Use targeted registry/backend, cache/localization, CSRF/permissions, production UI and build verification; do not automatically run unrelated domain suites. See [Languages contract](CPANEL_LANGUAGES.md) for routes, schema and verification. Interface Translation Editor, deletion, Payment Types and other stages remain deferred.

## 64. Interface Translation Management and permanent fallback

The owner authorizes management of existing interface values, using the existing registry/cache, and replaces the earlier two-step fallback. The centralized in-memory resolver now returns: requested usable value → current database Default's usable value → any usable value → key. The any-language order is deterministic: active languages by sort_order, then code; inactive languages by sort_order, then code. An inactive language is never offered in selectors, but may supply the last available fallback. NULL, empty and whitespace-only values are missing. Default is dynamic; no hardcoded language preference or per-t lookup query exists. An empty Default dictionary is no longer a startup error because the explicitly approved any-language/key fallback must work; exactly one active Default remains mandatory. The Languages assignment completeness guard remains in force.

Migration 054 makes only existing interface_translations.translation_value nullable. Clearing normalizes to NULL and retains the existing key row, including when all values are cleared. No second translation registry/table or key deletion is created. Development owns keys through SQL migrations; administrators may edit only values for an existing distinct key. Inactive/omitted language values are preserved. Existing PK/FK/key/nonblank-when-present constraints remain.

System → Localization → Interface Translations opens `/cpanel/interface-translations`. Register assignable boolean interface_translations.view/update independently, with same-task labels and server-side enforcement. No create/delete permission/action/API. GET `/cpanel/api/interface-translations` and `/:key` require view; PUT `/:key` requires update and CSRF. Body is exactly `{values:{languageCode:string|null}}`; only submitted active registered languages change, maximum 20,000 characters per value and 512 KB request. Key comes only from the route and must exist. Unknown/identity fields and malformed values are rejected. Auth/session/permissions are revalidated inside the transaction; language/translation writers share the registry advisory lock. Multi-language saves are atomic.

The table uses active-language columns, name/code labels, explicit-value completeness, key/any-language-value search, derived namespace-prefix filter, All/Missing/Complete and optional specific missing language. Prefix is the first two components for cpanel.* and first component otherwise; it is a technical key identifier, not another stored module field. Response pages contain at most 50 keys. The management read groups the current small registry in one batch; ordinary t() calls remain cache-only. Summary covers the full registry; result pagination reflects filters. Edit shows all active languages simultaneously, marks Default and keeps key read-only. Saves preserve unrelated keys and unsaved state on failure; no Add/Delete UI.

After commit invalidate/reload the existing cache using its revision protocol. Subsequent requests observe updated values without process restart; in-flight pages retain their request snapshot. A failed immediate refresh is reported as committed/refresh pending and retried by subsequent requests. Current single-application-process boundary remains; additional independent processes need coordinated invalidation before deploying that topology.

**Permanent development rule:** every newly introduced visible interface string must register a semantic key and seed actual translations for all currently required development languages (currently tm/ru/en) in the same task. Management is for maintenance/correction/completeness, never an excuse to defer developer translations. Missing detection counts explicit usable values only, never successful fallback. New active languages naturally appear as incomplete.

Migration 055 adds 16 keys/48 real tm/ru/en values. Focused verification covers resolver/default/whitespace/inactive ordering, management search/filter/edit/clear/immutability, permissions/CSRF, transaction rollback, cache refresh, fresh migrations, running-server translations and build. No Payment Types or other domain starts. See [management contract](INTERFACE_TRANSLATION_MANAGEMENT.md).

## 65. Payment Types and Delivery Types — shared UI preview

The owner explicitly authorizes both small configuration UIs together because they share one presentation pattern. Authenticated `/cpanel/payment-types` and `/cpanel/delivery-types` require their independent payment_types.view / delivery_types.view permissions. Existing sidebar roadmap entries remain disabled until backend activation; direct routes support this UI review. No Settings work, domain table, repository/service, mutation API or persistence is authorized.

Shared model preview: one optional Media Icon, base Name and Description, integer Sort Order, and Visibility. Both textual fields reuse the approved inline TranslatableField with every active registry language, separate override saves and base fallback. No tabs, SEO, Gallery, Main Image concept, Delete or payment-provider/transaction fields. New records are Hidden; minimum required base data is Name, with optional Description and sort default 0. Sort is integer and does not depend on creation order.

A shared controller/view/browser module provides separate payment/delivery page-memory state and separate view-preference keys. Grid/List preserve base Name/Description search and All-default visibility filter. Card/row actions are Edit and Change Visibility. Native sample labels are interface-localized review fixtures only, never inserted into domain tables. Same-dialog mock Create → Edit generates a mock ID, retains selection, and unlocks inline translations/Icon. Basic and per-field translation saves remain independent; drafts survive expansion, and closing dirty forms prompts. Footer contains Close + main Save on one row. Preview notices make non-persistence explicit; reload resets all mock entities.

Delivery alone adds Free Delivery and a nonnegative decimal-capable Price in internal main-currency units. The UI's initial review default is Free Delivery checked / price 0 (a UI choice, not a frozen future schema). Checking Free sets price 0 and disables the input; unchecking restores the last entered paid price within the editor. Free displays as a localized word, not primary numeric zero. No currency selector, storefront conversion or Order integration is implemented. Payment Types has no price.

Icon selection/change uses the existing image-only, permanent Media Picker under media.view, never a direct host file chooser. Clear unlinks only the mock reference and never deletes the file. The shared Picker retains its existing separately authorized media.upload capability and explicit real-upload notice; this task creates no upload backend or new storage system.

Register eight future assignable booleans: payment_types.view/create/update/visibility and delivery_types.view/create/update/visibility. View enforcement is real; remaining capabilities gate mock UI only until explicitly authorized backend activation, as with other UI stages. No automatic grants or delete permissions.

Migration 056 contains only 28 semantic keys with 84 real tm/ru/en values. No business schema. Targeted verification is two consolidated UI scenarios, permission-registry tests, fresh localization integrity, actual running-server tm/ru/en checks, themes/narrow layout and build; historical domain regression is excluded. See [review contract](PAYMENT_DELIVERY_TYPES_UI.md). Stop for review; do not start backend or Settings.


## 66. Payment Types and Delivery Types activation

The owner approved persistence, superseding section 65's UI-only boundary. See [activation contract](PAYMENT_DELIVERY_TYPES_ACTIVATION.md) and migration 057 for the exact schema. Both independent modules use real PostgreSQL CRUD without Delete; navigation is enabled and requires the respective view permission. Existing create/update/visibility permissions and CSRF protect real mutations. No automatic permission grants.

Each module allows zero or one Default independently. Default must be visible; setting one atomically clears its predecessor and makes the chosen record visible under update permission. Explicit visibility changes still require visibility permission. Clearing Default is allowed. New records are hidden/nondefault; sort order does not determine Default. Database constraints and per-module transaction locks enforce these invariants.

Base Name/Description and per-field inline translation overrides remain independent persistence scopes. Icons reuse canonical filesystem Media references without physical copy/deletion. Delivery free means price zero; paid price is nonnegative NUMERIC in internal main-currency units. No currency conversion.

Future checkout lists visible records ordered by sort_order/id and optionally preselects each module's configured Default. No checkout, Delete, Settings, Products or payment execution is implemented by activation. Targeted module/security/localization/navigation tests and production build are required; unrelated historical regression is not automatic.

## 67. Marketplace Settings

Owner-approved central Settings uses one typed key/value table and development-owned definition registry. See [Marketplace Settings](MARKETPLACE_SETTINGS.md) for schema, API, permissions and exact numeric representation. No generic setting-key CRUD UI or speculative keys.

Source of truth is permanent: Language → languages.is_default; Payment → payment_types.is_default; Delivery → delivery_types.is_default; Frontend Currency → settings["marketplace.default_frontend_currency_id"]. Never duplicate the three domain defaults into Settings rows.

The Marketplace Defaults service composes existing domain default logic in one transaction. settings.update authorizes the central workflow while preserving Language completeness/active-default and Payment/Delivery visible-default invariants. Payment/Delivery may have no Default. Currency must exist and be visible; Currency management now prevents hiding the configured Default until another is selected. This currency safety change is explicitly authorized by this Settings task. Settings reads are uncached; Language cache refresh follows commit. An unconfigured currency remains null/Not configured with no invented Product pricing behavior.

UI is a sectioned Settings page, not Grid/List. Only Marketplace Defaults currently exists. Other sections, Products and checkout remain deferred. Comparable modules have no audit history mechanism, so no speculative audit tables are created; attribution is retained and audit history remains future work.

## 68. Order Statuses reference module

The owner explicitly approved UI and PostgreSQL backend together using the completed Payment Types pattern. [Order Statuses](ORDER_STATUSES.md) reuses shared reference-type implementation with separate order_statuses/order_status_translations tables, fixed server-selected configuration, permissions and routes. Marketplace → Order Statuses is enabled under order_statuses.view. Orders remains disabled.

Name/Description base values, independent inline translations, optional canonical Media Icon, visibility and sort order follow Payment Types. New records are hidden/nondefault. Optional Default permits zero or one, is always visible, switches atomically and is independent from sorting. Future Orders may use it for initial status_id.

Order Status is strictly configuration. Do not add or infer is_final, is_closed, is_error, is_cancelled, transitions, workflow or operational rules; these belong to a separately designed Order domain. No Delete, Orders, Products or additional Settings integration is authorized by this stage.


## 69. Settings Default Order Status extension

The owner authorized one additional Marketplace Defaults selector. Its sole source of truth is order_statuses.is_default, with no Settings key. Current-language status Name overrides fall back to the base Name. Only visible statuses and No default are offered. Existing Order Status default logic participates in the same atomic Language/Currency/Payment/Delivery/Order Status transaction, under settings.update. No redesign or other domain behavior change.

## 70. Reusable safe HTML Description fields

Formatted customer-facing Description fields in applicable reference/content modules must use the reusable HtmlEditor and centralized server sanitizer. Current scope: Payment Types, Delivery Types, Order Statuses, including their inline translated Description overrides. See [HTML Description contract](HTML_DESCRIPTION_FIELDS.md).

Persist approved HTML only; allow basic paragraph/emphasis/list/link formatting and strip active content, unsafe attributes and unsafe URL protocols on the server. Existing plain text must remain safely editable without destructive migration. Render only server-sanitized HTML; compact list/card previews use readable truncated text. Base fallback and independent saves remain unchanged.

Name, Slug, SEO Title, SEO Description and other short-text fields are not HTML unless explicitly approved later. This opt-in capability does not authorize redesign, new tabs, permission changes or other domain work.


## 71. Manual HTML Description editing

Owner-approved amendment: HtmlEditor provides Visual / HTML source modes for the same base or translated Description, preserving unsaved state and existing save scopes. Toolbar is a convenience, not a format limitation. Manual safe images, classes, headings, tables, div/span/blockquote and controlled presentation CSS are supported by the centralized server allowlist. Script/embedded active content, event handlers, dangerous protocols and unsupported CSS remain forbidden.

HTML → Visual uses server-sanitized preview without persistence; never insert raw source drafts into a rendered surface. Visual containers must contain content layout/paint. No separate translation tab, module redesign, schema change, upload helper or new permissions. See [HTML contract](HTML_DESCRIPTION_FIELDS.md).

## 72. Products / Storefront Products UI review

The owner authorized `/cpanel/products` as UI-only, reusing the shell, inline `TranslatableField`, Visual/HTML `HtmlEditor`, independent draft states and Media Picker. No Product schema/backend, Orders, pricing engine, stock or synchronization changes are authorized by this stage. Products navigation stays disabled until backend activation; review uses the authenticated direct route with `products.view`.

Create requires Name + a Source Product, assigns a page-local mock ID, stays open and becomes Edit. Source identity is immutable after Create and visibility defaults false. Tabs: Basic Information, SEO, Description, Visibility, Price Rules, Discounts, Gallery. Each section and each translated field has its own save state. All Product changes are in page memory and reset on reload, with localized preview/save notices. Gallery selection uses the existing Media subsystem; any explicit upload remains the existing real Media operation, not Product persistence.

Product Gallery has no separate Main Image: zero or one item may be Primary. Reorder preserves Primary; unlinking Primary leaves no Primary. No file deletion. Discount attachments are automatically priority DESC: larger number means higher priority. There is one optional Product price rule, distinct from Discounts and without Before/After scopes. Mock previews do not finalize a pricing engine or the effective-visibility formula. `show_as_in_stock` hides quantity, never changes stock; `hide_when_out_of_stock` may be combined with it. Placement has no invented business effect.

Registered boolean definitions: products.view/create/update/visibility; no Delete. Migration 067 seeds only interface text (53 keys, real tm/ru/en). See [Products UI review](CPANEL_PRODUCTS_UI.md). Stop for owner UI approval before persistence.

## 73. Source Products browser UI review

The owner explicitly postpones further Products work and authorizes a UI-first Source Products browser. This supersedes earlier postponement of Source Products **UI only**; it does not authorize new synchronization, business schema or source mutation behavior.

Authenticated `GET /cpanel/source-products` requires the single registered assignable boolean `source_products.view`. The direct route is available for review; sidebar roadmap availability remains disabled pending activation. No create/update/delete permission, mutation API, source repository/service or source/stock schema change is introduced.

The page uses isolated, explicitly labeled mock source records shaped after existing source_products, currencies, measures, product_barcodes, product_stocks and temporary products relationships. Counts and warehouse quantities are review fixtures, not live data or a new stock calculation. Source identity/content/prices/currencies/measures/barcodes/stock remain read-only. Details contains Basic Information, Stock, Barcodes, Properties and informational Products; no creation of storefront Products is exposed.

Shared browser query-state helpers separate identity search/filter logic from the page and data loading, allowing reuse in a later Product source picker. Name is the initial search field, with Source ID, Barcode, five properties and All fields; All fields excludes unrelated numeric/internal fields. Search is debounced 300 ms; advanced filters combine with AND, have active counts/chips, and Clear Filters retains the query and search field. Vendor uses searchable native suggestions; currency/measure IDs remain Vendor-scoped in fixtures. Five property filters are folded into a compact optional section. Grid/List share the same paginated result set and preserve query/filter state.

Migration 068 adds only 33 interface keys / 99 real tm/ru/en values. No domain migration. Verification covers Source Products UI/query, permission registry, fresh/current/live localization and build; no historical domain regression. See [Source Products UI](CPANEL_SOURCE_PRODUCTS_UI.md). Stop for UI review; do not resume Products or activate source backend automatically.

## 74. Activated read-only Source Products browser

Owner approval replaces section 73's mock-data boundary. `/cpanel/source-products` and GET `/cpanel/api/source-products`, `/options`, `/:id` now read the current synchronized PostgreSQL tables through the reusable Source Products query service/repository. `source_products.view` protects all reads; the sidebar link is enabled independently of permission. No source mutation routes/permissions or Storefront Product workflow.

The browser sends bounded parameterized queries, not entire-table downloads. Name (default), Source ID, Barcode, Properties 1–5 and All fields use literal case-insensitive substring matching with escaped wildcard characters. IDs/barcodes remain strings. Vendor/Currency/Measure filters use actual PostgreSQL identities; references remain Vendor-scoped. All filters combine with AND. Server orders by name/id (optional descending name), returns 12 rows per page and exact filtered count in one repeatable-read READ ONLY snapshot. Browser aborts/ignores stale requests and preserves query/filter/page in URL for refresh/back/forward.

Stock is SUM of existing product_stocks, missing stock means zero, negative values remain unchanged. Counts use products.source_product_id. Separate correlated aggregates and barcode EXISTS avoid join multiplication; list rows contain barcode count/first-value preview, Details loads all barcode strings and actual warehouse breakdown. NUMERIC price/stock travel as decimal strings without Product pricing/Discount conversion.

Reference option queries return up to 50 matches plus a refine-search notice; selected IDs can be restored. No credentials are returned. Migration 069 adds only two justified name/id ordering indexes (global and Vendor-scoped) and two translated error/option-limit keys in tm/ru/en. Existing barcode/stock/Product FK indexes are reused. No new domain tables or synchronization/business-rule changes. Unindexed substring searches and deep OFFSET may need profiling at larger scale; do not introduce another search subsystem without demonstrated need.

See [Source Products activation](CPANEL_SOURCE_PRODUCTS_ACTIVATION.md). Only targeted read-query/UI/security/localization/navigation/build checks are required; Vendor Sync, stock recalculation and historical Catalog suites remain out of scope. Stop; do not resume Storefront Products.

## 75. Shared asynchronous server entity selection

Permanent owner-approved rule: prefer the shared AsyncAutocomplete for existing server entities (Vendor, Brand, Category, Currency, Payment/Delivery Type, Order Status, Source Product, Discount and future references). Tiny static enums remain native selects. Use bounded authorized server search, pagination and selected-ID hydration; never download entire tables or infer identities from display labels. Keep entity repositories/permissions explicit, not an unrestricted generic table endpoint.

The reusable single-select implementation supports 300 ms debounce, stale response cancellation/guards, Load more, localized states, keyboard access, clear/required/disabled/read-only modes. Source Products Vendor/Currency/Measure filters use it now. Existing modules migrate when next touched or during final cleanup; Storefront Products must reuse it later. See [AsyncAutocomplete contract](ASYNC_AUTOCOMPLETE.md).

This supersedes section 74's first-50/refine-only lookup behavior with 20-row pages and exact selected-ID hydration. Source Products remains read-only; status readability is presentation only. No mass selector migration or Product implementation is authorized.

## 76. Shared Product creation dialog review

Owner-approved permanent relationship: **one Source Product → many Storefront Products**. Never make source_product_id globally unique; connected Product count is informational, never a creation restriction. Future minimum Create fields are source_product_id + independent editable Name, initially Hidden.

The owner's correction restores the existing full Product dialog. Products Add first opens a source-only selector with exactly Vendor + Source AsyncAutocomplete fields and Close / Create. It has no Product identity, drafts, connection filter, summary or persistence. Source is Vendor-scoped, disabled until Vendor is chosen and cleared on Vendor change. Continue transfers the selected Source into the **shared existing Product editor**, not a temporary Name-only form or result placeholder. Source Products' action opens that same editor directly.

The editor opens in Create mode: Basic Information active; SEO, Description, Visibility, Price Rules, Discounts and Gallery present but locked. Source is fixed/read-only and Name prefills independently. Merely opening either dialog never writes Products. The interim mock-ID/result workflow is removed. Product persistence is still not activated by this scoped UI correction: actual Create currently reports the localized unavailable-save state and cannot mint an ID/unlock Edit. Only a future successful persistence response containing a real Product ID may transition this new draft to Edit. Existing Products page and historical Edit review design remain unchanged.
Read-only `/cpanel/api/product-create/vendors` and `/sources` are narrowly authorized by products.create for this calling workflow. They adapt the existing Source Products query service, with bounded pages, exact Vendor constraints, safe summary projections and selected-ID hydration. They do not relax source_products.view on the browser/API, duplicate search SQL, create a second source catalog, or implement Product mutations. Both UI entry points require products.create; the Source browser retains source_products.view. No schema or domain data migration, pricing, full Edit work, page redesign or navigation activation is authorized. Migration 071 adds only real tm/ru/en interface text.

Product Basic Information now selects optional Brand/Category identities through shared AsyncAutocomplete. Read-only `/cpanel/api/product-references/brands` and `/categories` authorize the Product view/create/update workflow, return at most 20 identities per page, hydrate by ID and reuse Category ancestor paths. Selection only changes the form draft. The immutable Source name and compact Vendor/price/currency/stock context live once in the persistent modal header, outside every tab. No Product persistence or Create/Edit transition rule changes.

## 77. Activated Product Create/Edit dialog

The owner explicitly approves real persistence for the shared seven-tab Product dialog, superseding sections 72/76's mock-only and unavailable-save boundaries. [Product contract](CPANEL_PRODUCTS.md) records the exact extension, routes, permissions and limits. Existing Product IDs/source relationships are preserved; Source is required, non-unique and immutable. One Source may have many storefront Products.

Basic, SEO, Description, Visibility flags, one optional Price Rule, Discount attachments, ordered Gallery/Primary and five inline translation fields persist independently. Base text remains fallback; HTML reuses the centralized sanitizer. Product Gallery has zero-or-one Primary and no separate Main Image. Discount priority is descending; equal priorities use ID. Unlinking Media never deletes files. Currency normalization reuses the central missing-rate=1 helper; SQL NUMERIC owns the administrative rule preview. No final storefront pricing/Discount engine or effective-visibility column is added.

Only full Product Create inserts and returns a real ID to the same open dialog. Source selection never writes. Source Products opens that same workflow directly. Product persistence has server-side permissions/CSRF/strict field allowlists and transactional saves. Unknown/source/system fields are rejected. The temporary Products list only identifies and opens existing rows; final browsing/search/filter/pagination design, storefront, Orders and Delete remain deferred. Targeted tests and normal production build are required, not historical full regression.


### Product Discount attachment UX amendment

Discounts now use shared AsyncAutocomplete with bounded server search and Product-specific SQL exclusion of existing attachments. Selection immediately attaches; success clears/refocuses the field, failure preserves useful selection and the committed list. Three-dot Detach immediately unlinks only the relationship. No Discounts footer Save. Both operations use products.update/CSRF, Attach also uses existing discounts.view. Composite uniqueness remains authoritative; duplicates are rejected. Ordering remains priority DESC then ID ASC. This supersedes only the earlier Discount draft/footer-save behavior, not other Product scopes or Discount definitions.

## 78. Attached Products management

Owner-approved activation replaces informational Products tabs in Brands, Categories and Discounts with one shared paginated component and Product AsyncAutocomplete. Selection immediately persists and clears only after success; Detach unlinks immediately. There is no relationship Save button and other editor drafts remain independent.

Existing sources of truth remain products.brand_id (nullable single Brand), products.category_id (nullable single Category), and product_discounts (many-to-many). No domain schema, Product deletion, source change, visibility change or duplicate relationship cache is introduced. Category lists contain direct Products only; recursive informational counts retain their existing meaning. Counts are computed from relationships.

Brand/Category reassignment requires explicit confirmation naming current/destination entities. The server locks the Product and compares expected_parent_id to its current parent; stale confirmation cannot overwrite another reassignment. Detach verifies the Product still belongs to the requested parent. Discount uniqueness uses the existing composite primary key; other Discount links remain unchanged.

Explicit allowlisted `/cpanel/api/products/attachments/:kind/:parent` supports brands/categories/discounts only. GET uses domain.view plus products.view, returns 20-row pages, safe primary Media previews, counts, and lookup search/hydration excluding current attachments. POST attach/detach uses domain.update plus products.view, fresh session/permission checks, CSRF and strict payloads. No new permission or arbitrary-table endpoint. Mutations preserve Product content and creation metadata; ordinary updated_at triggers still apply. See [Attached Products](ATTACHED_PRODUCTS.md).

## 79. Source Product → Storefront Products

The Source Product details Products tab is a read/create/open surface, not attachment management. Its only relationship is immutable, required products.source_product_id: one Source can have many Products. GET `/cpanel/api/products/source/:id/products` requires source_products.view AND products.view, validates the Source and returns 20-row pages with real count, safe Primary image, Name, visibility, Brand and Category. No duplicate relationship state or schema change.

Create New Product requires products.create and directly opens the shared Product Create dialog with fixed Source and prefilled independent Name. Opening never inserts. Successful actual Create retains the same Product dialog in Edit. Existing rows open that same editor under products.view/products.update. The Source modal is hidden during editing and restored to its refreshed Products tab when the Product dialog closes; browser counts refresh without a full reload. No Attach, Detach, Move, source replacement, Delete or final Product browser is introduced. Migration 078 adds only one tm/ru/en interface label.

## 80. Bulk hidden Product drafts from Source Products

Owner-approved bulk workflow applies to the entire current Source query, not its visible page. Browser and bulk paths share `sourceWhere(sourceQuery(...))`; no second filter implementation. The review holds one 20-row page, defaults to all matches selected, and represents exclusions (or explicit inclusions after Clear Selection) without loading every identity. A blank filter means the ordinary complete query. Toolbar opening/review never writes Products.

Final creation resolves the stored query at execution time; sources/filters may have changed since review. Unknown or nonmatching exception IDs reject the operation before writes. A PostgreSQL holdable cursor fixes final membership before our inserts can change connection filters, then fetches 100 identities per chunk. Every Product uses the same `ProductsService.createBase` validation/defaults as ordinary Create, under its own transaction and fresh source_products.view + products.create check. Names are trimmed source Name, optionally prefixed by trimmed prefix + " - "; source names/data stay untouched. New rows stay Hidden, with no Brand/Category or dependent content. Existing connected Products never exclude a Source unless the administrator chose that existing filter.

One session-bound opaque token identifies an operation in the existing single application process. Marking it running is single-flight; identical repeated submissions return state, changed submissions conflict. Retry checks/resumes communication with that same token, never automatically recreates successful items. Review tokens expire after 15 minutes; completed summaries after one hour. Unknown/expired/restarted-process tokens fail closed and cannot restart creation. This is intentionally not a durable job queue: process failure can leave committed drafts, so the localized message requires inspecting Products before a new operation. An uncertain database outcome is flagged explicitly and never retried automatically. At most two operations run concurrently; only 20 safe failure details are returned, while created/failed totals cover the full operation. Exception lists are bounded to 20,000 IDs and the existing 512 KB body limit; all-selected batches have no small result-count cap.

The UI shows counts, live prefix previews, Select All/Clear, busy/progress and accurate outcome, and refreshes Source counts after completion. Final POST uses existing CSRF; tokens and all read/status paths are actor/session-bound and permission checked. No new permission, schema, source mutation, pricing logic or speculative audit subsystem. Migration 079 contains only required tm/ru/en text. See [bulk contract](BULK_PRODUCT_DRAFTS.md).

## 81. Products browser

`/cpanel/products` now uses one authorized server query for Name/Source Name/string Source ID search, all advanced filters and both views. Twenty records/page, deterministic base Name/ID ordering; query/filters/page/view survive URL refresh/back. Vendor identity comes only through Source Product; Category filtering is direct. Static presence modes cover unassigned Brand/Category and any/no Discount. Identity-only paginated/hydrated Vendor/Brand/Category/Discount lookups are explicitly allowlisted for the products.view browsing workflow; no unrestricted entity endpoint or full-table preload.

Visibility predicate keys are centralized with editor diagnostics; derived storefront visibility is never persisted. Real stock stays unchanged (including negatives); show_as_in_stock is presentation metadata. Primary previews use only product_media.is_primary, with a missing-file fallback. Separate correlated aggregates/EXISTS prevent Media/Discount/translation row multiplication; total/page share one SQL statement snapshot. Existing relationship/Primary indexes are reused; no domain schema change.

Administrative price reuses the existing NUMERIC Product Price Rule preview then central conversion into visible Marketplace Default Frontend Currency; missing rates retain effective 1. Without a configured default currency, internal units are labeled explicitly. **Owner clarified in this task: show the existing normal price only; Discount price engine remains a separate task.** No invented discounted price or change in pricing semantics. Existing Create/Edit workflow and persistence scopes remain, with a browser-refresh notification after save. Quick visibility uses the existing narrow Basic mutation with products.visibility and CSRF. No delete/source-change action. New interface text is migration 080, real tm/ru/en values. Testing is limited to browser behavior, localization integrity and build.
