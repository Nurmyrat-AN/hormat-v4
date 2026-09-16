# Sync storage + CouchDB decode/document analysis — completion report

## Outcome

The exact compatibility blob was received and integrated without changing the supplied legacy algorithm. A real Nano/SyncManager batch analysis of Vendor 97's owner-specified `elitedb` reached the end of `_changes`.

**225,026 changes: 220,791 decoded, 4,227 unencrypted, 8 deleted, 0 failed.** These totals match metadata of 225,018 live documents and 8 deleted documents. `$dokuman_tipi` is the observed discriminator: 16 actual top-level type values plus three design documents. The initial 100,000-change discovery pass is not added to final counts.

- [Actual findings, candidate mapping table and unresolved business questions](docs/COUCHDB_DOCUMENT_ANALYSIS.md).
- [Detailed per-type field/path inventory, presence/types/numeric observations and reference evidence](docs/COUCHDB_FIELD_INVENTORY.md).
- [Tooling, bounds and security](docs/COUCHDB_ANALYSIS.md).
- [Approved schema decisions](docs/SYNC_STORAGE.md).

## Storage and safety

Migration 027 created exactly warehouses, currencies, measures, source_products, product_barcodes, product_stocks and minimal products. All seven remain empty. Internal identity IDs and same-Vendor FKs are separate from opaque string source IDs; no numeric/UUID conversion of source identity. NUMERIC avoids prematurely choosing monetary/quantity rounding. Deletes use RESTRICT; indexes support approved lookups/relationships.

No source mapper, stock calculation, target rows, source business deletion, checkpoint/date advancement, Source Products UI/API/permissions or Products business fields were implemented. Stock remains a future transaction-derived calculation. Before/after real-run checks confirmed unchanged Vendor sync fields and target counts.

Vendor 97's stored URL still points to server root. The supplied full database URL was applied only as an analysis-run override; the existing Vendor row was not edited. Credentials stayed server-side. Ordinary enabled runtime sync still needs a database URL configured through the normal Vendor workflow.

## Decoder and analysis

- Exact AES-256-CBC, zero IV, key normalization, dictionary/key derivation and raw+payload merge retained; environment override preserved.
- One initialization before analysis; invalid dictionary uses a fixed safe startup error. Main disabled CRUD does not depend on dictionary initialization.
- Analysis uses existing Nano `_changes`, include_docs, single-flight worker and scheduler. No normal per-document refetch; only one additional database-info query for count/coverage metadata.
- First pass uses structural fingerprints; second selects the observed `$dokuman_tipi` and reads decoded content before classification.
- Vendor-scoped identity, bounded failure/deletion/source examples, nested shapes, type/presence statistics, same-Vendor sampled reference evidence. No raw document dumps or keys/credentials/ciphertext exported.
- Source-specific contact/address/GPS/salary and credential fields retain schema metadata only; their values/numeric ranges are suppressed in report artifacts.
- Full top-level feed coverage was achieved; nested depth/array bounds still apply. Candidate interpretations are not approved mappings. Numeric JS observations are not a definitive decimal-rounding contract.

## Tests and build

- Added four decoder/inventory tests: authoritative initialization and safe invalid override; synthetic CBC compatibility/merge/status/key semantics; Vendor-scoped IDs/references/nested stats; sensitive-field suppression and exponent precision.
- Added Nano metadata-projection test with local HTTP simulator.
- Ran decoder/inventory, sync-storage, VendorSyncManager, Vendors encryption/lifecycle and database/application-startup suites: 40 passing tests before the extra metadata case; then 18 passing decoder/adapter tests including that extra case. Runs overlap: **41 distinct targeted tests verified**.
- Rechecked decoder/adapter tests after final report-sanitization adjustment.
- `npm run build`: passed, including the final source; compiled code was used for real analysis.
- Existing schema-stage tests remain preserved. The prior RESTRICT error-code expectation was fixed; schema behavior correctly prevented deletion.
- `git diff --check`: passed.

Deep Media/Profile/Users and full historical browser regression were intentionally not rerun: no such domain, UI, authentication or shared permission behavior changed. Relevant Nano/worker/service/storage/startup paths were checked. No “full regression” claim is made. Automated tests use synthetic/local/isolated sources; real source access was the separately requested read-only analysis.

## Files introduced/updated across this stage

- Migration 027; sync-storage test and existing migration/Vendor no-write assertions.
- `src/vendors/analysis/legacy.ts`, `inventory.ts`, `run.ts`.
- Nano transport's safe read-only metadata method.
- `tests/unit/couchdb-analysis.test.ts`, Nano metadata test.
- `scripts/render-couchdb-analysis.mjs`.
- `.env.example`, `.gitignore` (local aggregate JSON ignored).
- Architecture section 44, storage/analysis guide, actual findings and field appendix, this report.

No unresolved runtime test failure is known. Mapping/stock/date/status/source-reference business decisions remain explicitly listed for the owner's review. Durable synchronization was not started.
