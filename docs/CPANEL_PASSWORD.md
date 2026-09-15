# Current-user Change Password

Only the approved Change Password tab is active. Basic Information and Change Photo remain preview actions. There is no public recovery/reset flow or administrator reset.

## Request and policy

`POST /cpanel/profile/password` uses existing loadCpanelAuth/requireCpanelAuth, URL-encoded parsing (16kb), requireCsrf and the shell. An account-scoped express-rate-limit instance permits 10 CSRF-valid attempts per 15 minutes, including validation errors and successes. This uses the existing in-memory limiter approach: counters reset at process restart and are not distributed. A multi-process deployment would need shared limiter storage before relying on one global account quota.

The request accepts only currentPassword, newPassword, confirmPassword and transport `_csrf`. Unknown fields, including user_id, are rejected. The service's target/session are taken exclusively from authenticated server locals.

Required fields, current-password verification, new-policy validation, exact confirmation and rejection of identical old/new passwords are authoritative on the server. Shared `meetsPasswordPolicy` is used by password changing and `hashPassword`, so bootstrap and changing agree: at least 12 UTF-16 code units (the existing JavaScript length behavior), at most 1024 UTF-8 bytes, without trimming or new composition rules. Login retains its compatibility input validation. Existing Argon2id parameters are memoryCost 65536, timeCost 3, parallelism 1.

## Atomic storage and sessions

`PasswordChangeRepository` owns parameterized SQL and one transaction. It locks cpanel_user_auth first, then rechecks and locks the current session using its server-side token_hash, user_id and unexpired timestamp. Verification/hashing happens under this lock. It updates only password_hash; the existing trigger updates auth updated_at. It deletes other session rows for this user, retaining the current token_hash. A failure rolls everything back.

Concurrent password changes serialize; a losing request from a session just invalidated cannot proceed. Login session creation follows the same auth-row-first ordering and compares the hash actually verified during login before inserting a session. Therefore a concurrent login either precedes the change and its session is removed, or follows it and rejects a stale verified hash. No second session system or schema migration is added.

## Responses and UI

The server renders the profile with Password selected, status 200 on success, 400 on validation/input errors, 429 for limiting and 500 with a generic message for an unexpected failure. The existing profile status area shows the localized result. No form values are supplied back to EJS. The action URL includes #password; page JS normalizes the response URL to `/cpanel/profile#password` without submitting a second request. Without JavaScript, the same server-rendered password tab/result works at the POST URL; refreshing may prompt form resubmission. CSRF rejection remains the existing localized 403 response.

Client JS validates required fields/confirmation and disables the submit button while sending; server enforces policy. Visibility controls remain shared with login. Basic Information never submits. No credentials are placed in local storage, URL, logs or template values. The normal existing logout CSRF field remains in the shell.

Migration 008 adds eight keys under cpanel.password: required, policy, mismatch, same, incorrect, success, failure, limited; 24 actual tm/ru/en values. All used keys now total 121; canonical seeds total 128 keys / 384 values. The live verifier changes only a disposable random verification account and deletes it afterward.

## Verification

Unit/service/database tests cover every validation category, old/new verification, unchanged profile/email/permissions, changed updated_at, no plaintext in persisted rows, preservation of current and unrelated sessions, revocation of other sessions, stale-login rejection, concurrent changes and rollback when session deletion fails. Browser tests cover authentication/CSRF, injected target rejection, translated validation/success/limiting in tm/ru/en, empty password fields and Basic Information safety. Existing UI regressions continue to check themes, mobile and password toggles.

See [CPANEL_PASSWORD_REPORT.md](../CPANEL_PASSWORD_REPORT.md) for executed results and security review.
