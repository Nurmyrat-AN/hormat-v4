# Universal file uploader — V1

The [permanent exact contract](MEDIA_UPLOAD_CONTRACT_V1.md) and architecture section 30 govern every future media-containing CPanel form. The owner clarified that this is a universal **file** uploader: **all formats accepted**, no format allowlist. Original bytes are preserved, including empty files. My Profile is now the first real domain consumer; see [profile behavior](CPANEL_PROFILE.md).

## Public upload protocol

`POST /cpanel/media/upload` requires the existing authenticated CPanel session and CSRF. Send the existing session CSRF token in `X-CSRF-Token`; the shared CSRF middleware now accepts this header as well as the established form `_csrf`. Thus authentication/CSRF run before multipart parsing or file storage. Multipart contains exactly one `file`; extra fields/files and query parameters are rejected. No domain destination is accepted.

Successful HTTP 201 has exactly:

```json
{
  "success": true,
  "media": {
    "cacheToken": "opaque-server-generated-token",
    "url": "/media/cache/opaque-server-generated-token.bin",
    "originalName": "document.file",
    "mimeType": "application/octet-stream",
    "size": 123,
    "width": null,
    "height": null
  }
}
```

Production tokens are random UUID v4 strings. Names are basename-only, control-character stripped and length-bounded display metadata; they never choose storage paths. The stored extension comes from descriptive content identification, or bin for unknown content. MIME detection reads at most a 64 KiB sample; unknown/unidentifiable MIME is application/octet-stream. Sharp reads image metadata only; failures leave nullable dimensions and never reject or transform a file. No optimization/variants, duration or antivirus claims are introduced.

Expected errors use `{ success: false, error: { code } }`:

| Code | HTTP | Meaning |
| --- | --- | --- |
| MEDIA_FILE_REQUIRED | 400 | A valid multipart request has no file |
| MEDIA_FILE_TOO_LARGE | 413 | Optional operator-configured size cap exceeded |
| MEDIA_TYPE_NOT_ALLOWED | 415, reserved | Kept for contract compatibility; not emitted for file format in unrestricted V1 |
| MEDIA_FILE_INVALID | 400 | Invalid multipart/protocol, extra field/file or missing boundary |
| MEDIA_UPLOAD_FAILED | 500 | Generic storage/transport failure without internal details |

Authentication remains the existing login redirect; CSRF remains localized 403. Client-side network/auth/unknown-response failures map to the localized generic upload failure. No server paths or stacks are returned.

## Storage, ownership and finalization

MEDIA_ROOT defaults to project `.media`, outside src/dist. A server operator may configure an absolute external path. The Node application owns controlled public serving.

```text
MEDIA_ROOT/
  .incoming/<token>/upload          streaming, not public
  cache/<token>/asset.<extension>   complete original file
  cache/<token>/record.json         private owner/expiry/reference metadata
  .claims/<token>/...               atomic finalization claim
  .trash/<token>/...                cleanup work
  <trusted destination>/<new UUID>.<extension>
```

The public cache URL stays `/media/cache/<token>.<extension>`; physical directory layout is private. A per-token directory lets original bytes and owner metadata publish atomically. There is no Media database table. Restrictive filesystem modes and generated paths keep request filenames out of filesystem decisions.

The upload request streams to disk with backpressure. It never buffers the entire file in application memory. Successful description/publication returns a temporary reference; aborted/invalid requests remove their staging directory after the write stream settles. Interrupted processes may leave staging work, removed by TTL cleanup.

Trusted future domain services call:

```ts
const { url } = await mediaStore.finalizeCachedMedia({
  cacheToken,                    // from domain form
  destination: 'users/avatar',   // trusted backend constant, never request body
  ownerId: authenticatedUser.id, // server-side identity
});
// The separately approved domain Save stores `url`, never the cache URL.
```

Destination segments are safe lowercase ASCII letter/digit/underscore/hyphen segments starting with a letter; dot segments, cache and symlink destinations are rejected. Token metadata validates the owner and TTL before an atomic rename claims the whole directory. Only one process can claim it. The original file moves to a fresh server filename under the trusted final directory. Successful promotion consumes the token. A normal move failure restores the cache claim for retry; a missing file/token fails explicitly with MEDIA_CACHE_NOT_FOUND. There is no public finalize endpoint.

A process crash during finalization can leave a private claim until cleanup; it cannot make the token reusable. Future domains must decide compensation/reconciliation for a database Save failing after filesystem promotion during their own approved backend stage; no cross-resource database transaction is claimed here.

## Public serving

Only `/media/cache/<UUID>.<extension>` and trusted final namespace paths ending in a generated UUID filename are served. Metadata, private work directories, listings, symlinks and traversal requests are not exposed. Cache previews are public bearer URLs, expire with their cache records and use no-store. Finalization still requires matching server-side ownership.

Recognized raster-image types can render inline. Everything else, including unknown/active document content, is sent as application/octet-stream attachment. All responses use X-Content-Type-Options: nosniff and a sandbox Content-Security-Policy. Image decode failure affects preview only, not acceptance.

## Cleanup and operational settings

- `MEDIA_CACHE_TTL_HOURS=24`: positive integer; enforced on cache lookup/finalization. Startup and hourly cleanup delete expired cache records/files. Permanent destination files are not cleanup targets.
- `MEDIA_MAX_UPLOAD_BYTES=0`: default, no application file-size cap. Positive values enable a byte cap in client and streaming parser. No default limit was imposed after the owner's unrestricted-upload clarification.
- Upload deadline is five minutes; aborted/timeout requests are cleaned. Reverse proxies/storage can impose their own deployment limits.
- The root must be writable by the application. Keep it on one filesystem so cache claims/promotions use atomic rename. Multiple processes must share the same root to share temporary tokens and ownership metadata.
- `.media` and `.test-media` are ignored. Browser regression servers use `.test-media`; unit storage tests use disposable OS temp directories. Browser/live verification cache files expire via normal cleanup; test accounts are deleted by the harness.

## Reusable browser component

`partials/media/uploader.ejs` renders prepared uploader data and PostgreSQL translations. `js/media/uploader.js` initializes a `HormatMediaUploader` per `[data-media-uploader]` element; instances are available as `element.mediaUploader`.

Each maintains existingUrl separately from state/cacheToken/url/uploadPromise/error/progress. Selection starts XMLHttpRequest immediately. Progress comes only from upload progress events; indeterminate transfer does not invent a percentage. Upload-complete state requires HTTP 201 and a valid reference. Error messages come from translated EJS data attributes, never a JS language dictionary.

Reselection aborts/supersedes the prior request using a revision guard; old replies cannot replace the current token. Remove clears the new token and restores existingUrl, leaving persisted media untouched. Non-image selection shows a download link beside the existing avatar/initials.

`HormatMediaUploader.createSaveHandler(uploaders, saveCallback, button)` prevents duplicate Save, waits for current upload promises (including reselection during the wait), blocks on error and calls the callback automatically with tokens or null for idle uploaders. The consuming domain maps tokens to its own field names and omits idle token fields. Never submit a cache URL as authoritative model input.

The profile uses this gate before POST /cpanel/profile and finalizes to the trusted users/avatars destination. It stores only the final URL, compensates failed UPDATEs and deletes old managed avatars after COMMIT. See [profile failure handling](CPANEL_PROFILE.md). Password changing, logout, sidebar and permissions are unaffected; Media management remains disabled.

## Localization and verification

Migration 009 adds 11 keys / 33 actual tm/ru/en values. The old profile-specific avatar action label is retired from current use, replaced by reusable Choose File. After profile activation: 144 seeded keys / 432 values, 135 used UI keys. All error codes map to shared database translations.

Tests cover arbitrary/empty/image bytes, exact response envelopes, authentication/CSRF, extra-file/field rejection, optional size cap, malformed streams, public serving, metadata privacy, ownership across restart, TTL cleanup, one-time/concurrent finalization, unsafe paths and failed promotion. Browser checks cover actual upload/progress, Save waiting, error blocking/retry, selection races/cancellation, translated states, both themes/mobile and unchanged profile/auth rows.

See [MEDIA_UPLOAD_REPORT.md](../MEDIA_UPLOAD_REPORT.md) for final executed results.

## Managed deletion

`deleteManagedFile(url, trustedDestination)` only removes exact generated UUID filenames in the supplied trusted final namespace, after checking directory/file types with lstat. It returns false for unknown/external/legacy URLs, missing files and symlinks. It never accepts a browser destination. Profile uses it for post-COMMIT replacement cleanup and failed-UPDATE compensation.
