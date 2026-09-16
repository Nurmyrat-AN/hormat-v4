# CouchDB decoded inventory — analysis tooling

`src/vendors/analysis/legacy.ts` contains the exact user-supplied compatibility blob and legacy CBC algorithm. It preserves zero IV, `LEGIT` dictionary decryption, legacy padding/truncation, `_key2020` suffix derivation, raw+payload merge and removal of load. `LEGACY_KEY_DICTIONARY_BLOB` remains an optional override. This module is never used for Vendor credentials, passwords or sessions.

`initializeLegacyDecoder()` initializes once before a bounded analysis run and emits only a fixed initialization failure if invalid. Ordinary disabled synchronization/CPanel CRUD does not initialize it. The legacy decode result preserves its supplied error semantics, but inventory/logs never publish raw error messages, keys, ciphertext or complete documents.

The dedicated CLI injects an analysis processor into the existing VendorSyncManager/Nano layer. It reads active Vendor configuration and encrypted credentials from the existing repository; no separate CouchDB HTTP client, per-document refetch or persistence mapper exists. It starts analysis at zero in memory without modifying stored checkpoints. Main application listener behavior remains unchanged; analysis is an explicit development action, not an unlimited continuous inventory.

```sh
npm run build
node dist/vendors/analysis/run.js
```

Optional `COUCHDB_ANALYSIS_VENDOR_ID` selects an active Vendor. `COUCHDB_ANALYSIS_URL` is allowed only with exactly one selected active Vendor and overrides the URL in memory for this run. It does not save settings. `COUCHDB_ANALYSIS_TYPE_FIELD` permits a second classification pass after a real discriminator has been observed. Without it, documents group by sorted top-level-field structural fingerprint; no business mapping is assumed.

Limits: 1000 changes per batch; default 100000 changes per Vendor and 180 seconds wall-clock for the read phase. Explicit `COUCHDB_ANALYSIS_LIMIT` (up to 2000000) and `COUCHDB_ANALYSIS_DEADLINE_MS` (up to 600000) can extend a controlled run. Additional bounds: nested depth five and first 100 elements of each array; up to 512 distinct families plus a marked overflow family, 1024 field paths per family, bounded examples and reference samples. Coverage/truncation must be considered when interpreting results. This is a changes-feed inventory rather than a transactionally consistent database snapshot. Field presence is per document; nested type counts can count multiple array elements. Numeric ranges are JS-number observations and may be approximate; decoded JSON numbers cannot reveal original lexical precision beyond the representation available after JSON parsing. Source IDs/references are never normalized or numerically coerced for identity.

Inventory stores source identity from the outer change `_id`, even if the legacy payload merge overrides the decoded `_id`; overrides are counted. Deleted/missing/failed documents are tracked separately. Sensitive fields may contribute field-name/type/presence metadata, but never values or nested contents. Safe ID examples remain unchanged; unusual identifiers are hash-redacted. String reference samples are matched only within the same Vendor. Reference-name heuristics and small samples are evidence candidates, not a complete FK relationship graph.

`docs/COUCHDB_DOCUMENT_INVENTORY.json` is a bounded aggregate artifact, mode 0600 and git-ignored because source IDs can still be sensitive. Review it before sharing. No decoded dictionary, credentials or document dumps are written. The human-readable document analysis report states actual observed findings and unresolved questions.

Before/after checks compare Vendor checkpoint/timestamps and all seven target-table counts. The subsystem contains SELECTs only. No stock calculation, mapping, target-row insertion, checkpoint advancement or business deletion is performed. If worker error/time limit prevents coverage, exit code 2 distinguishes an incomplete scan from completed analysis; no-target or zero-document results must never be represented as an actual type inventory.
