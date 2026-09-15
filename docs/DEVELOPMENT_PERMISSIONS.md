# Local development command permissions

## Policy

Follow section 19 of [ARCHITECTURE.md](ARCHITECTURE.md). Reuse existing approvals and request reasonable persistent command prefixes for routine local work where the environment supports them. Request only the permissions needed for authorized work. Do not repeatedly request already-granted permission.

Workspace reads and ordinary edits in writable project directories already run within the sandbox. Use that access directly. For additional commands, use the environment's approval mechanism; do not bypass restrictions or silently edit security settings. Approval to execute a command does not approve business schema design, changes to a frozen domain, destructive actions, or work outside the user's task.

Prefer scoped project commands over blanket shell/interpreter access. PostgreSQL commands and migrations need scope appropriate to the intended local database and the user's explicit task. Remote publishing, destructive operations, system-wide modifications, credential access, and work outside the project remain subject to applicable approval requirements.

Official reference: [Codex command-prefix rules](https://developers.openai.com/codex/rules). Rules match command prefixes; shell wrapping or complex command forms can affect matching. These documents describe project intent and do not themselves grant execution permission.

## Recorded status — 2026-09-15

- The session already exposed approvals for `npm install`, `npm ci`, `npm test`, and `npm start`, along with several specific development/test commands from the foundation stage. Existing matching approvals were not requested again.
- A persistent `npm run` prefix was explicitly requested while executing the existing `npm run typecheck` script. The environment reported **only `npm run typecheck` as the saved approved prefix**. The typecheck completed with exit code 0.
- Therefore a blanket approval for all npm scripts or all local development commands was **not** confirmed. Future commands must use the actual active approvals and request a safe persistent prefix if a needed command is not covered.
- No broad `node`, shell, SQL execution, destructive, system-wide, or remote-publishing approval was requested. No global security configuration was changed.
- The project `.codex/` directory was read-only in this session. Permission persistence was handled through the environment's supported approval prompt, not by writing a project security configuration.

This is a record of observed results, not a guarantee of permissions in another session. Check the live environment's approved prefixes before requesting anything new. If an approval request is narrowed or rejected, report that outcome accurately.

## Localization stage additions — 2026-09-15

The environment confirmed persistent prefixes for `npm run db:migrate` and `npm run db:migrate:production` while applying/verifying the explicitly requested localization migration. Existing browser-test approvals were reused. These command permissions do not authorize unrequested future schema changes.
