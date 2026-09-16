# Vendor source edit timestamp amendment

## Implementation

`date_last_operation` now means the newest valid **source document edit timestamp** successfully handled at the durable checkpoint. The exact approved decoded field is **top-level `uytgeme_tarih`**. It does not use `fatura.Tarihi`, nested edit timestamps, `uytgeme_tarih_yen`, receipt time or server time.

Controlled real-source reads found ISO timestamps with an explicit **`+05:00`** offset, e.g. `2026-02-18T11:02:37.367362+05:00`. That value denotes `2026-02-18T06:02:37.367362Z`; honoring its supplied offset is not an assumption that legacy wall-clock time was UTC. Missing-offset UTC semantics remain unconfirmed and are never inferred from the host timezone.

The field is not universal: the prior full inventory already showed a missing field on one kagent, one defter and one olc_umum document, plus types without it. Missing/invalid/unconfirmed diagnostic dates do not block otherwise valid synchronization and never get an invented fallback.

The existing PostgreSQL **timestamptz** column is unchanged. PostgreSQL computes MAX over valid source timestamp strings, then GREATEST with the stored date. Real source data also includes seven fractional digits (for example `.5001012+05:00`). Validation accepts up to nine digits; PostgreSQL rounds to its existing microsecond storage precision. JavaScript Date is not used for aggregation or millisecond truncation. The update is part of the same locked transaction as mapped data, stock snapshots, checkpoint and sync timestamp.

Every handled business type can contribute, including unsupported decoded `z_waka`. Crucially, only the original stream batch contributes; bulk dependency lookups may return future states and therefore cannot advance the operation date before their own change is durably handled. Reference-only bootstrap and tombstones without decoded edit data contribute no invented timestamp.

Historical replay cannot move the date backwards. Decode failure prevents the commit; SQL/business failure rolls back the operation date with the rest of the batch. Empty polls do not invent source activity. `date_last_sync` retains server commit-time semantics and `last_sequence` remains the only synchronization checkpoint.

## Changed files

- `src/vendors/sync/operation-date.ts`: source timestamp/calendar/offset validation.
- `src/vendors/sync/durable.ts`: extract dates from original decoded batch only.
- `src/vendors/sync/durable-repository.ts`: atomic PostgreSQL MAX/GREATEST update.
- `tests/unit/source-operation-date.test.ts`: parser/calendar/offset/precision cases.
- `tests/unit/durable-sync.test.ts`: mixed mapped/unsupported types, replay, business-date exclusion, decode/SQL rollback, deletion and future-dependency exclusion.
- `docs/ARCHITECTURE.md`: owner-approved section 46.
- `docs/DURABLE_VENDOR_SYNC.md`: replaces the earlier unresolved operation-date behavior.
- This report.

No schema migration, new route, business table, UI string or translation key was introduced.

## Verification actually executed

- `npm run typecheck`: passed.
- `npm run build`: passed.
- Combined `source-operation-date`, `durable-sync`, `vendor-sync`, `couchdb-analysis`, `vendors-preview` unit/integration suites: **59 passed**.
- Vendor CRUD/events/production startup and shutdown suite: **12 passed**.
- Existing English Vendor browser workflow, including dates/lag, Grid/List, light/dark and desktop/mobile: **1 passed**.
- `git diff --check`: passed.

Unrelated deep Media/Profile/Users and the complete historical suite were intentionally not rerun: no shared authentication, permissions, Media, localization or browser formatting logic changed. The selected scope covers the changed transaction, parser, decoder, lifecycle and Vendor presentation integration. No full-regression claim is made.

## Explicit confirmations

- Independent of CouchDB business document type? **YES**.
- Can urun, depo, zarf and unsupported successfully handled types all advance it? **YES**.
- Based on source edit time rather than fatura.Tarihi? **YES**.
- Can historical replay move it backwards? **NO**.
- Is date_last_sync still the HORMAT successful-sync timestamp? **YES**.
- Is last_sequence still the authoritative checkpoint? **YES**.

## Real Vendor 97 verification and date initialization

The complete date-only scan handled **225,026 changes**. Among decoded live business documents, **225,010** had valid edit timestamps, **5** had no timestamp, and **0** had malformed/offset-less timestamps. All valid values carried explicit **+05:00**. Eight deletions and three system design documents supplied no trusted decoded edit date.

The first diagnostic scan exposed seven-digit fractions; it was stopped before writing, validation was corrected and the full scan was repeated. Nothing was substituted with server time or implicit UTC.

The completed scan’s final CouchDB sequence exactly matched the captured committed checkpoint. The final short PostgreSQL transaction revalidated Vendor URL/source binding and checkpoint under the Vendor lock, then updated only date_last_operation using GREATEST.

Stored maximum:

- Source offset: **2026-08-01 14:34:30+05:00**.
- Same UTC instant: **2026-08-01 09:34:30Z**.

Both **last_sequence and date_last_sync remained unchanged**. No Source Products, barcode, stock or movement snapshot was rewritten by this initialization. Ongoing synchronization now maintains the date in normal batch commits.

The final strengthened AFTER-UPDATE failure test passed (**1 additional focused test**), proving rollback after date assignment, not merely before assignment.

The existing running development server was also checked with the actual Vendor 97: Last Operation, Last Sync and Lag rendered successfully in **tm, ru and en**. A temporary verification account/session was removed afterward. No new translations were needed.
