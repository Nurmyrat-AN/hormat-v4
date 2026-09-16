# Permanent testing strategy update

## Rule change

The owner's risk-based testing strategy now supersedes blanket full-history regression after each task. Architecture sections 2, 16, 21 and 42, AGENTS.md, README and relevant navigation/authentication/localization guidance are aligned.

Every implementation task tests its own module, directly affected shared infrastructure and realistic dependent/integrated modules. Meaningful implementation stages retain TypeScript/production build verification. Own test/build failures block completion. Reports must identify executed tests, build outcome, intentionally omitted suites and the impact-based rationale.

Full regression remains mandatory for explicit requests, release/deployment milestones, major module groups/refactoring, architecture-wide changes, critical authentication/security infrastructure changes and appropriate periodic health checkpoints after several modules. All existing tests and `npm test` are preserved; nothing was removed, weakened or disabled. Earlier reports of complete runs remain historical facts.

## Current Vendors scope

This task changes documentation/testing policy only, with no Vendor or shared runtime changes. The owner nevertheless explicitly requested immediate targeted Vendor verification. No new tests were added; existing tests were executed.

Selected unit/integration files:

- `vendors.test.ts`, `vendors-preview.test.ts`: complete Vendor unit/credential/schema/security coverage.
- `permission-registry.test.ts`, `permissions.test.ts`: registry and permission service integration.
- `auth.test.ts`: relevant authentication/session foundation.
- `navigation.test.ts`: availability versus authority and navigation configuration.
- `database.test.ts`, `translation-integrity.test.ts`, `localization.test.ts`: fresh migrations, translation completeness, cache/fallback and localization integrity.

Selected browser/HTTP files:

- `vendors.spec.ts`: real CRUD, credentials, errors/rollback, filtering/search, race handling, themes and tm/ru/en.
- `vendors-navigation.spec.ts`: enabled navigation and live permission changes through Permissions Management.
- `auth.spec.ts`: authentication/session protection and CSRF.
- `navigation.spec.ts`: roadmap integration, translated labels, collapsed/mobile behavior.

README records exact reusable commands for this selection and full checkpoints. It explicitly treats the Vendor list as an example to reassess against future code changes.

## Intentionally not executed

- Deep Media/File Manager/Move/universal upload suites.
- Deep Profile/profile-update/password-change suites.
- Deep Users CRUD/avatar/status/password suites.
- Other unrelated historical browser/domain suites, including standalone Foundation/Frontend/Socket.IO and broader shell/UI suites.
- The comprehensive cross-module live `localization:verify` workflow: no UI text, seed or cache changed in this policy task. Fresh/current DB integrity and Vendor browser language tests cover the requested localization checks.
- The complete `npm test` suite.

These areas' runtime code and shared dependencies were not changed. Vendor integration tests still exercise the real permission/authentication/CSRF/navigation/localization contracts. Thus targeted verification is sufficient here; any future shared/core change requires reassessing and expanding the scope.

## Results

- New tests: none added; existing module/integration coverage reused.
- Selected Node unit/integration run: **47 passed, 0 failed**.
- Selected production Playwright run: **16 passed, 0 failed**. Its server used the compiled application via `npm start`.
- `npm run build`: **passed**, including TypeScript compilation and production assets.
- `npm run localization:check`: **passed**, all 324 used UI keys have real tm/ru/en database values.
- Documentation local-link targets and `git diff --check`: **passed**.
- **Full regression was intentionally not run in this task.** This is a targeted result, not a full-suite claim.
- No unresolved issue remains for this policy update.

## Files changed

`AGENTS.md`, `README.md`, `docs/ARCHITECTURE.md`, `docs/CPANEL_NAVIGATION.md`, `docs/CPANEL_AUTH.md`, `docs/LOCALIZATION.md`, and this report. No runtime, test, package-script, route, schema or translation-source changes were made in this policy task.
