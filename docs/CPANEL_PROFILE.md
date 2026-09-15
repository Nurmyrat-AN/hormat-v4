# Current-user profile

`GET /cpanel/profile` requires existing CPanel authentication and is available to ordinary authenticated users without a new permission. Access is through My Profile in the topbar. The sidebar roadmap, including Users, remains unchanged and disabled for future management pages.

## Approved interface

The existing shell/card has exactly two Bootstrap tabs: Basic Information and Change Password. Hashes `#basic` and `#password` preserve tab navigation. Light/dark, language cookie, avatar fallback, mobile layout and password visibility reuse the shell conventions.

Basic Information now persists **name, phone and avatar**. Job and email remain visible/read-only; job is administrator-managed display information, email is the authentication identity. Password changes use the separate [approved password flow](CPANEL_PASSWORD.md).

## Profile Save

`POST /cpanel/profile` accepts URL-encoded name, phone, optional avatarCacheToken and existing _csrf. Existing CSRF headers also work. Unknown fields/query parameters are rejected. The target is always the authenticated session user. The service never updates auth or permission rows.

Name is trimmed, required, limited to 200 Unicode characters and rejects control characters. Phone is trimmed, limited to 50 characters, rejects control characters and becomes NULL if empty. Phone remains free-form contact information, with no country-specific or authentication rules. Existing PostgreSQL text columns have no declared maximum; application validation supplies these bounds without changing the schema.

The profile-specific repository locks auth, session and profile in a transaction, rechecks session validity and serializes concurrent profile writes. Services own validation/media orchestration; controllers only map results to localized responses. Profile code contains no filesystem manipulation.

The JS form uses the reusable uploader Save gate. Pending upload is awaited automatically; duplicate Save is blocked during upload waiting and the profile request. Avatar selection remains cancellable while waiting and is disabled while the profile request runs. Errors retain editable input and allow correction/retry. If finalization/Save fails, the selected upload can be retried; a consumed token is never treated as reusable.

Successful JSON response causes a fresh `/cpanel/profile?updated=1#basic` GET. The flag only displays a localized success notice and is removed with replaceState. Current values always come from PostgreSQL. Existing per-request user loading refreshes topbar, avatar and profile without logout, with no profile copies added to sessions. Without JS the Save/uploader buttons remain disabled.

## Avatar lifecycle and failure handling

1. Select → authenticated universal cache upload → actual progress → cacheToken + preview.
2. Save validates fields and server-side user/session, then finalizes owned token through Media Service.
3. Trusted destination is `users/avatars`; filenames remain generated UUIDs and original bytes are unchanged.
4. Store `/media/users/avatars/<UUID>.<extension>` in cpanel_users.avatar_url, never cache URLs or absolute paths.
5. After successful COMMIT, remove only an old exact managed file in that destination. No token or removed temporary selection means preserve the existing avatar/file.

A failed UPDATE after promotion rolls back PostgreSQL and removes only the new permanent file. OLD stays intact; the promoted token remains consumed and the client must upload again. An uncertain COMMIT outcome retains files for reconciliation to avoid deleting a committed avatar. Filesystem cleanup failures are logged as reconciliation needs; a committed Save is not falsely reversed. Process crashes and disk failures cannot be made a distributed transaction by filesystem rename; no crash-proof reconciliation queue is claimed.

`MediaStore.deleteManagedFile(url, trustedDestination)` is the only deletion entry point. It requires an exact generated filename/namespace, rejects symlinks and never interprets external/legacy/unknown URLs as filesystem paths. Original format policy remains universal; non-images are accepted and fall back to initials if not renderable.

## Localization and verification

Migration 010 adds five keys: cpanel.profile.saved, invalidName, invalidPhone, avatarFailed, failure; 15 real tm/ru/en values. Generic invalid-request feedback is reused. Earlier previewNotice remains historical seed data but is not used by current UI.

Tests cover self-targeting/protected fields, session validity, field validation, no-new-avatar, complete upload/finalize/persist lifecycle, replacement, invalid/foreign/expired/consumed tokens, concurrent saves, rollback compensation and managed deletion. Browser tests verify localized success/errors, real waiting/duplicate prevention, topbar freshness, light/dark/mobile and unchanged authentication/permissions. See [the activation report](../PROFILE_BASIC_INFORMATION_REPORT.md) for exact executed results.
