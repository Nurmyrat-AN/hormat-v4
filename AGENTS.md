# HORMAT-code-v4 — Instructions for coding agents

## Read before making changes

Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) in full before modifying this project. It is the canonical architecture and development-rules document. Follow it unless the project owner explicitly changes a rule; record authorized rule changes there. Read [README.md](README.md) for setup, commands, and verification details. Historical stage reports do not override the current rules.

## Working rules

- Inspect relevant existing code and understand the requested scope. Implement only that scope, verify it, fix discovered problems, report the result, and stop. Do not automatically begin another stage.
- V4 is a fresh implementation. Do not automatically copy architecture, schemas, APIs, or implementations from earlier HORMAT versions.
- Work one business module at a time: requirements → mock CPanel UI → workflow/UX review → finalized business rules → schema design and approval → migrations → backend → real data → API where required → module and regression tests → fixes → freeze.
- Mock UI is intentional. Wait for explicit instructions before creating its database/backend. Do not infer future tables, services, APIs, or socket events.
- Keep Frontend (`/`) and CPanel (`/cpanel`) routes, controllers, views, and UI assets separate. Future APIs must be separate from EJS page routes. Reuse shared infrastructure where appropriate.
- Use the established Node.js, TypeScript, Express, EJS, PostgreSQL/raw SQL through `pg`, Socket.IO, Bootstrap, and jQuery stack. Major frameworks, ORMs, or architectural dependencies require explicit approval.
- EJS renders prepared data. Real business rules belong in reusable services with data access separated from controllers. Create these layers only when needed.
- HTTP/EJS/API remains the ordinary data flow; Socket.IO supplements it with real-time events. Organize growing browser code by module/responsibility.
- Enforce validation and authorization server-side when implementing real modules. Do not invent authentication or permissions architecture ahead of its stage.
- Every new user-visible interface string must use a stable semantic key, with seed/source translations for every supported required interface language in the same task. Apply the database seed changes, refresh/restart running caches, and verify actual translated browser values in the same task. Run `npm run localization:check`, the fresh-migration integrity tests, and `npm run localization:verify` against the actual running server. Exposed keys mean the task is incomplete. Use literal semantic keys and the shared EJS `t()`; never replace PostgreSQL with JSON/JS dictionaries or hardcode/defer translations. Interface localization is separate from future content translations. See architecture section 23 and [docs/LOCALIZATION.md](docs/LOCALIZATION.md).
- Before changing a frozen domain's schema or business rules for another module, stop, explain the necessary change, its reason and affected behavior/schema, and wait for approval.
- Ask about ambiguity that could materially change architecture/business behavior. Use engineering judgment for small implementation details.

## Commands and verification

Use existing persistent approvals and the sandbox's permitted local file operations. At the beginning of work, inspect available permissions; request the broadest reasonable safe persistent prefixes for needed local commands where supported. Do not request an approval again when it already covers the action. Respect the environment's security model; command permission never substitutes for schema, frozen-domain, or task-scope approval.

Do not seek blanket shell/interpreter, destructive, system-wide, credential-access, or remote-publishing permissions. Request appropriate scoped approval when such an action is actually required. See [docs/DEVELOPMENT_PERMISSIONS.md](docs/DEVELOPMENT_PERMISSIONS.md) for the recorded permission status and limitations; the live environment is authoritative.

For completed functionality, run its tests and relevant existing regression tests, verify previous behavior, and fix failures before declaring completion. For documentation-only work, check completeness and links; do not claim runtime tests were rerun unless they were.

End meaningful stages with a clear report: request, implementation, changed files, architectural decisions, database/route changes, checks actually executed and exact results, unresolved issues/deviations, and review readiness. Stop after the report.

## CPanel login product constraint

CPanel accounts are administrator-managed; authentication is email + password only. Do not add public registration, forgot/reset-password, social login, OTP, phone login, magic links, remember-me, or other self-service flows unless explicitly authorized. `/cpanel/login` now has explicitly authorized real authentication; `/cpanel` requires a session. Permissions are direct per-user JSONB values; exact `superuser=true` bypasses boolean action checks. `job` never grants permissions. User/permission management UI remains out of scope. Follow architecture sections 24–25 and docs/CPANEL_AUTH.md.

## CPanel application shell

Use the shared application layout and shell context for authenticated CPanel pages; keep login separate. Sidebar/theme settings remain browser-local. The approved roadmap may show planned pages as disabled; enable only reviewed/tested ready pages. Availability is separate from permissions and does not authorize future routes or schemas. Retain server-side authorization independent of navigation. See architecture section 26 and [docs/CPANEL_SHELL.md](docs/CPANEL_SHELL.md).

Navigation roadmap and enabling rules: [docs/CPANEL_NAVIGATION.md](docs/CPANEL_NAVIGATION.md), architecture section 27. Configuration stores literal translationKey metadata; the scanner inventories these alongside literal t() calls.
