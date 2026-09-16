# Durable Vendor source synchronization and stock foundation

This owner-approved stage supersedes the temporary/count-only runtime in [VendorSyncManager foundation](VENDOR_SYNC.md). It uses the same manager, scheduler, Nano transport, lifecycle events and legacy decoder. There is no Source Products UI or HORMAT Products implementation.

## Source evidence and fixed mapping

Controlled read-only verification against the owner's `elitedb` established:

- `ayar_umum-1.paraAdi` is `TMT`; `paraAdi_Tenne` is the subunit (`teňňe`), not the currency name. Map `paraAdi` into the ordinary Vendor currency with source ID `z_walyuta-1`.
- All 11,960 observed `urun.OlcuBirimi` strings exactly matched existing `olc_umum._id`: 11,956 reference `olc_umum-1`, three reference the metre definition and one the block definition. Resolve exact IDs, never names or trimmed/coerced strings.
- `sluj_isYanlis` occurs on each nested `lst_fatura[]` transaction. Only numeric 1 suppresses its stock contribution; 0 and other values do not trigger truthiness-based suppression.
- Nested transaction/line `_id` values sometimes contain positional suffixes and sometimes are empty. Their stability is not guaranteed. Stock identity uses the parent CouchDB `zarf` ID, independently of nested IDs/array ordering.
- Observed `fatura.Tarihi` values are business dates and are not used for Vendor activity. The approved amendment uses top-level `uytgeme_tarih`: actual values include `2026-02-18T11:02:37.367362+05:00`. Honor the explicit source offset and preserve microseconds. See the source-edit rule below.

| Decoded type | Destination and mapping |
| --- | --- |
| depo | warehouses: `_id`, `Adi` |
| olc_umum | measures: `_id`, `Adi` |
| z_walyuta | currencies: `_id`, `Adi` |
| ayar_umum | currencies: literal `z_walyuta-1`, `paraAdi` |
| urun | source_products: `_id`, `Adi`, **temelSatisFiyati**, `StatusIsAktif === 1`, exact currency/measure references, `OzelKod1..5` |
| urun.lst_Barkodlar | Exact string set, deduplicated and replaced on each product update |
| zarf.lst_fatura[].lstKalems[] | Document stock snapshot and aggregate stock |

All identities remain opaque, case-sensitive strings scoped by Vendor. PostgreSQL identity IDs are used for foreign keys. Outer change ID and decoded `_id` must agree. Unsupported successfully decoded types are intentionally ignored; decoding failures/malformed supported data block the batch.

## Schema

Migration `028_durable_sync.sql` adds:

1. `transaction_types`: the owner's exact 26 rows, unique `(transaction_kind,type_code)`, idempotent seed UPSERT, all six effect columns unchanged. This is configuration, not a new accounting domain or UI translation dictionary.
2. `source_stock_movements`: unique `(vendor_id,source_document_id,product_id,warehouse_id)`, exact NUMERIC `stock_delta`, timestamps and same-Vendor composite foreign keys.
3. `vendor_sync_sources`: one immutable source URL binding per Vendor. This minimal support table is necessary to detect source changes **after process restart**; an in-memory comparison cannot do that. It avoids altering frozen Vendors configuration columns or inventing reset behavior. It contains no credentials/checkpoint duplicate.

The existing seven foundation tables retain their schema. Minimal `products` remains untouched and receives no automatic records.

## Atomic processing and stock

The batch processor decodes before mapping, validates required values, resolves dependencies and then begins a PostgreSQL transaction. It locks the Vendor row, revalidates active state/source binding and compares the incoming `since` to the persisted checkpoint. That lock coordinates concurrent processes and snapshot replacements, not just in-memory workers.

Within the transaction:

1. Bulk UPSERT currencies/measures/warehouses.
2. Bulk UPSERT products; replace each affected barcode set.
3. Read authoritative `fatura` warehouse effects from `transaction_types`.
4. Build NEW movements from each changed `zarf`. Quantity is exclusively `esasOlc_SayisiToplam`; multiply only by registry warehouse effects. Skip zero-effect warehouse roles. No other cancellation/active flags suppress movements.
5. PostgreSQL NUMERIC aggregates NEW movements by document/product/warehouse. It subtracts OLD stored snapshots, groups required deltas by product/warehouse and applies atomic stock UPSERTs in ascending internal product/warehouse order.
6. Replace only changed documents' snapshots.
7. Persist exact opaque `last_sequence`, `date_last_sync`, and the non-regressing source edit timestamp maximum in the same transaction, then COMMIT.

Failure rolls back every effect/checkpoint/timestamp. No JS floating-point accumulation is used; decimal strings are cast and summed in SQL. Nano's JSON numeric decoding is retained; no promise is made to recover digits already lost by JSON/IEEE-754 parsing beyond the observed source precision. Zero stock rows remain; negative stock is valid. Empty polls at an unchanged sequence do not advance diagnostic progress time.

Repeated/overlapping delivery is idempotent. Product/warehouse/type/quantity changes, wrong→valid transitions, added/removed/reordered lines and transfers use the same NEW−OLD calculation. No special reversal arithmetic is maintained.

## Dependencies and bootstrap

A null checkpoint means historical synchronization, never `since=now`.

The same worker first performs a bounded `_changes since=0` reference prepass. It decodes all changes, writes only reference entities in bounded transactions and does **not** persist a checkpoint. A second ordinary pass starts at 0 and durably handles every supported change. Changes during/between passes remain covered by that ordinary pass and its continuous tail; there is no jump to `now` or a guessed boundary. A crash during the prepass repeats idempotent reference UPSERTs. If another worker has already advanced the checkpoint, a stale prepass transaction is rejected.

Products referenced by earlier historical transactions can be fetched with authenticated Nano `_all_docs` bulk POSTs by exact keys. Product currency/measure dependencies are resolved in a second bounded round. Known IDs are queried in bulk from PostgreSQL, strictly within the current Vendor. There are no placeholder entities and no permanent raw-document queue.

Limits: configured changes batch 1–10,000; at most 3 dependency rounds; at most 10,000 missing IDs per round; at most 500 keys per dependency request; at most 100,000 stock movements/dependency references per batch; at most 100,000 pages per reference prepass. Exceeding limits stops/retries safely without moving the checkpoint. A source that never reaches an empty prepass may require a future bounded-boundary bootstrap enhancement; it does not skip data.

No DB connection/transaction is held during dependency network requests. The reference prepass schedules individual database batches through the shared scheduler, so it does not monopolize a processing slot for its entire network scan. Missing/deleted required dependencies, unknown stock types and invalid quantities retry with existing bounded backoff, retaining the last committed checkpoint. Correct the source or approved registry to allow progress. Raw documents/credentials/legacy errors are never logged.

## Lifecycle and source binding

- Every connection preparation loads the authoritative PostgreSQL checkpoint. Foundation memory progress is ignored by the durable runtime.
- Network/credential reconnect, restart and reactivation resume from that committed sequence. A lost COMMIT acknowledgement is recovered by reading PostgreSQL on reconnect.
- Deactivation pauses only; rows, stock, snapshots and checkpoint remain.
- The first durable preparation binds the exact configured URL. Any later mismatch enters permanent runtime `SOURCE_CHANGED`, with no remote changes request, reset, deletion or rebuild. The state is available in internal manager status and sanitized logs; no new monitoring UI/API is introduced.
- An existing non-null checkpoint without a source binding cannot be attributed safely and also fails closed. The explicit Reset Sync Data operation also preserves this source-identity guard; there is no automatic migration/rebinding.
- Trailing-slash/alias changes are conservatively considered different unless the exact original URL is restored. This stage does not claim to detect a remote database replaced in place at an unchanged URL.
- Credential/name edits preserve the binding. URL updates committed while a batch is running serialize on the Vendor row; subsequent work checks the new URL.

## Deletions and future rebuild

A source tombstone reverses any stored snapshot for its exact document ID and removes that snapshot, without needing the old payload. Replayed deletion has no further effect. Source Products and reference entities are conservatively retained unchanged on tombstones, including their current `is_active`, barcodes, FKs and HORMAT Products relationships. A deletion is not interpreted as `StatusIsAktif=0`. Batch deletion counts provide sanitized runtime reporting; a deletion-history UI/domain is not added.

The subsequently authorized [Reset Sync Data operation](VENDOR_RESET_SYNC.md) rebuilds derived stock/snapshots for one selected Vendor while retaining all source/reference entities and IDs. No automatic destructive cleanup exists.

## Verification and operation

Run `npm run build`, then targeted `tests/unit/durable-sync.test.ts`, `vendor-sync`, `couchdb-analysis`, `sync-storage`, `vendors` and `database` suites. Browser Vendor tests cover existing persisted-date presentation. No new interface strings were added; existing PostgreSQL localization remains authoritative.

`VENDOR_SYNC_ENABLED` remains opt-in; enable it only for environments authorized to contact their configured Vendors. Apply migrations before starting. For operator results and intentionally omitted unrelated suites, see [the stage report](../DURABLE_VENDOR_SYNC_REPORT.md).

## Source edit activity timestamp

The owner’s amendment replaces the earlier unresolved `date_last_operation` policy. `uytgeme_tarih` is read only from the decoded document root. It is not present on every source document. Any handled type can advance the date, including unsupported z_waka; no mapper is required. `fatura.Tarihi` and nested dates are irrelevant.

`operation-date.ts` validates calendar/time and explicit ISO offsets (`Z` or signed HH:MM), permitting up to nine fractional digits (seven observed in the legacy source). Missing, malformed, impossible dates and offset-less strings are omitted; UTC for offset-less legacy strings has NOT been established. Deletion tombstones do not supply an invented timestamp. Successfully decoded source strings retain their source offsets; PostgreSQL casts to timestamptz and computes MAX/GREATEST without JS millisecond truncation.

Only the original stream batch contributes. On-demand dependency documents can be newer than the checkpoint and must not advance this date prematurely. Failed decode/processing/SQL writes roll back all progress; replay cannot lower the stored maximum. Empty polls do not manufacture dates. date_last_sync remains server commit time and last_sequence remains authoritative.

For the already initialized development Vendor, a one-time date-only historical scan may initialize the field only when its final CouchDB sequence exactly equals the captured committed PostgreSQL checkpoint and the source binding/checkpoint are revalidated under the Vendor lock. A changed boundary cancels that backfill. It does not reset checkpoint, recompute stock, or change date_last_sync. See [amendment verification](../SOURCE_OPERATION_DATE_REPORT.md).

Explicit reset to text zero now uses the same reference prepass as a null checkpoint, then normal durable replay. See [architecture section 47](ARCHITECTURE.md#47-vendor-reset-sync-data).
