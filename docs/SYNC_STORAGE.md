# Synchronization storage foundation — analysis stage

> Current runtime: [durable source synchronization](DURABLE_VENDOR_SYNC.md) supersedes the historical stage boundaries below.

The owner explicitly authorized seven storage tables in migration `027_sync_storage.sql`, before document mapping. This supersedes the earlier listener-stage prohibition on creating Source Products storage only for this scope. No Source Products/Products UI, permissions, repositories, mapping or synchronization writes are authorized by this schema alone.

## Identity and ownership

All CouchDB IDs are opaque strings. Never use Number, parseInt, BigInt or UUID parsing for a CouchDB ID/reference. Preserve padding and case exactly. `source_id` uses PostgreSQL TEXT with C collation; UNIQUE(vendor_id, source_id) is scoped to the originating Vendor. Internal PK/FKs use the existing bigint generated-always identity convention. Internal IDs are distinct from source IDs.

## Tables

- `warehouses`, `currencies`, `measures`: internal id, vendor_id, source_id, name, timestamps.
- `source_products`: those identity/name fields, nullable exact NUMERIC price, nullable internal measure_id/currency_id, is_active default true, five nullable TEXT property fields, timestamps. Property semantics remain unspecified.
- `product_barcodes`: internal id, vendor_id, internal product_id, opaque TEXT barcode, timestamps; unique product_id/barcode.
- `product_stocks`: internal id, vendor_id, internal product_id/warehouse_id, exact non-null NUMERIC stock, timestamps; unique product_id/warehouse_id. No zero default or positivity constraint is invented.
- `products`: ONLY id, non-null source_product_id, created_at, updated_at. Multiple Products may refer to one Source Product for future counts. No Products business fields/domain.

There was no existing monetary precision convention. Unconstrained NUMERIC preserves decimal precision without introducing rounding/scale assumptions before source analysis. Nullable price/dimension references represent unknown/unmapped values without inventing a zero price. Names and source IDs are non-null; no additional normalization/blank-name business rule is imposed.

All deletes use RESTRICT; there are no cascades. Composite Vendor/internal-ID foreign keys prevent cross-Vendor product/dimension/stock/barcode links. Supporting unique Vendor/id constraints exist for those FKs. Unique source and barcode/stock keys cover their leading-column lookup needs; secondary indexes cover measure, currency, warehouse, vendor ownership of child rows, and products.source_product_id. No speculative full-text/JSON indexes.

Timestamps and update triggers follow the existing HORMAT convention. Migration contains no source-data seeds.

## Explicit non-mapping boundary

**Stock will be calculated from transaction documents in a separately approved stage.** Never populate product_stocks merely because a decoded document resembles a stock record.

No real source document is mapped or inserted into these tables yet. No sync checkpoint/timestamp updates. Decoder/inventory work must analyze actual decoded documents before the owner chooses each type-to-table mapping. Legacy AES-CBC compatibility, once supplied, stays separate from modern Vendor AES-GCM credentials, authentication and sessions.

## Decoder and real inventory

The exact compatibility blob was subsequently supplied and integrated with its original legacy algorithm. See [analysis tooling](COUCHDB_ANALYSIS.md) and [actual analysis report](COUCHDB_DOCUMENT_ANALYSIS.md). Table mappings remain unapproved. The requirements continuation still ends at the heading for section 50, but the received analysis and storage rules are implemented within the stated boundaries.
