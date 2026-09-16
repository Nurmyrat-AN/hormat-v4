# CouchDB document analysis — actual decoded inventory

## Outcome and coverage

Analyzed **Vendor 97**, database **elitedb**, using the database URL explicitly provided by the owner. Stored Vendor URL remained unchanged (it currently points at the server root); the full database URL was an in-memory analysis override. Existing encrypted credentials were reused server-side.

The final scan reached an empty `_changes` batch (**caught up**). It inspected **225,026 changes**, matching database metadata of **225,018 live documents + 8 deleted documents** at scan start. Duration: **226.417 seconds**. One active Vendor existed; global totals therefore equal this Vendor's totals. This is feed coverage at the observed point, not a transactional snapshot or a claim about other Vendors.

The initial structural discovery pass covered the first 100,000 changes and is **not added** to the final counts. It exposed `$dokuman_tipi`; the second pass classified decoded content using that actual field, starting again from zero in memory. No type was inferred from the encrypted wrapper or mapped to PostgreSQL.

| Decoder result | Count |
| --- | ---: |
| success (encrypted) | 220,791 |
| not_required (unencrypted) | 4,227 |
| failed | 0 |
| deleted | 8 |
| missing included document | 0 |
| merged payload changes outer identity | 0 |

Encryption ratio among live decoded/unencrypted documents: **98.1215%**. Deleted changes are separate and not assumed inactive. There are no failure examples because no decode failed. Bounded deleted IDs and safe source examples appear in the appendix; no payload/ciphertext/key/credential values are included.

## Actual discriminator and type counts

`$dokuman_tipi` is a string present on **225,015 / 225,018 live documents** (all observed non-design documents). The remaining three documents are `_design/aishfiltercache`, `_design/aishfilterdraft`, `_design/aish2020`, grouped by structure. There are **16 actual top-level type values**, plus two design-document shapes. Numeric `type2020` appears on encrypted records but is not the primary classification source. Nested documents also have `$dokuman_tipi` (see transaction section).

| Actual type | Count | Encrypted | Unencrypted |
| --- | ---: | ---: | ---: |
| `z_waka` | 147,502 | 147,502 | 0 |
| `zarf` | 53,969 | 49,769 | 4,200 |
| `urun` | 11,960 | 11,960 | 0 |
| `z_garalama` | 6,014 | 6,014 | 0 |
| `kagent` | 5,308 | 5,294 | 14 |
| `kimlik_umum` | 132 | 132 | 0 |
| `defter` | 45 | 44 | 1 |
| `terminal` | 38 | 38 | 0 |
| `depo` | 33 | 33 | 0 |
| `olc_umum` | 5 | 0 | 5 |
| `z_kurs_walyuta` | 3 | 3 | 0 |
| `Design-document structural group` | 2 | 0 | 2 |
| `z_walyuta` | 2 | 0 | 2 |
| `Design-document structural group` | 1 | 0 | 1 |
| `rapor_ozel` | 1 | 0 | 1 |
| `printer_umum` | 1 | 0 | 1 |
| `swerka_gulp` | 1 | 1 | 0 |
| `ayar_umum` | 1 | 1 | 0 |

## Complete observed field inventory

[Per-type field inventory](COUCHDB_FIELD_INVENTORY.md) provides every observed field/path within the stated bounds, document presence count/percentage, missing count, null/type frequencies, safe examples, numerical observations, reference matches and source ID examples. It includes all 18 classified groups, not just product/transaction candidates. Top-level fields are covered; nested arrays are limited to their first 100 elements and depth five. `zarf`, `terminal`, `z_kurs_walyuta`, `swerka_gulp` reached a nested bound, so their nested statistics must not be treated as exhaustive element counts.

Examples intentionally suppress free text, names, customer details and secret values. Empty example arrays mean “not exported/no eligible safe sample”, not “the source field is empty”. Redacted IDs are explicitly marked. Field/type metadata is retained even for sensitive fields, but no values/nested secret contents are exported. The JSON aggregate is local, mode 0600 and git-ignored; the Markdown appendix contains reviewed aggregate evidence and safe IDs.

## Candidate mapping — discussion only

These are interpretations of decoded field combinations and reference matches, **not approved mappings**.

| Actual type | Possible meaning | Evidence | Confidence / uncertainty |
| --- | --- | --- | --- |
| `urun` | Source Product candidate | Adi, multiple price fields, OlcuBirimi, idFiyatWalyutasy, barcode array, status, OzelKod1–5; transaction product IDs match | High structural confidence; exact price/status/property mapping unresolved |
| `depo` | Warehouse candidate | Adi/location-like metadata; `zarf.lst_fatura[].id_depo1/2` match IDs | High structural confidence; roles of depot1/depot2 need confirmation |
| `olc_umum` | Measure candidate | Adi, simple reference structure; product supplementary olcuId values match | High candidate confidence; base OlcuBirimi resolution still needs confirmation |
| `z_walyuta` | Currency candidate | Adi, TenneAdi, rounding fields; product idFiyatWalyutasy match | High candidate confidence; one referenced default ID absent |
| `zarf` | Transaction envelope candidate | fatura/kasa arrays; product and warehouse references, quantities, totals, dates | High structural confidence; posting/direction/reversal rules unresolved |
| nested `fatura` | Transaction header candidate inside zarf | Tipi, Tarihi, depot1/depot2, status, lstKalems | High structure confidence; numeric type meanings unknown |
| nested `fatura_kalemi` | Transaction line candidate | Id_Urun, quantities, units, price/total fields | High structure confidence; signs/conversions require business review |
| nested `kasa_islemi` | Cash/payment operation candidate | Occurs in lst_kasa and nested payment object | Candidate only; do not assume stock effects |
| `z_waka` | Change/audit-like event | id_objenin, before/after strings, tip_waka, timestamps | Medium/high; not treated as authoritative stock movement |
| `z_garalama` | Draft-like document candidate | FAKTURA/HARYTLAR/KABULEDICI strings and TIPGARALAMANYN | Medium; serialized contents intentionally not recursively JSON-parsed |
| `kagent` | Counterparty/person/account-like reference | Adi, contact/account fields | Medium; no target mapping approved |
| `defter` | Ledger/account-like reference | ParentId, IdWalyuta, limits | Medium; no mapping approved |
| `z_kurs_walyuta` | Exchange-rate history candidate | IdWalyuta_From/To, RateCurrent, hangiTarihte | High structural confidence; no new exchange-rate domain |
| `terminal` | Terminal/access configuration candidate | permission structures and terminal settings | Medium/high; sensitive values suppressed, no mapping |
| `kimlik_umum` | Template/reference candidate | Adi, Sablon | Low/medium; exact meaning unresolved |
| `rapor_ozel` | Custom report candidate | JsonRapor, Tipi | Medium; not mapped |
| `printer_umum` | Printer configuration candidate | Name, Path, Settings | Medium; not mapped |
| `swerka_gulp` | Reconciliation/locking candidate | lstGulplar_Acyk/Yapyk | Low; owner explanation needed |
| `ayar_umum` | Application settings candidate | Numerous configuration fields | Medium/high; secret values excluded, not mapped |

## Product candidate: `urun`

All 11,960 documents contain string `Adi`, string `OlcuBirimi`, string `idFiyatWalyutasy`, numeric prices and numeric `StatusIsAktif`. The source uses multiple prices; selecting one would be a business decision.

| Field | Observed range | Zero values | Negative values | Max observed decimal places |
| --- | ---: | ---: | ---: | ---: |
| temelAlisFiyati | 0–9500 | 203 | 0 | 4 |
| temelSatisFiyati | 0–10000 | 241 | 0 | 4 |
| minimumSatisFiyati | 0–5000 | 1310 | 0 | 4 |
| price4th | 0–1275 | 11256 | 0 | 2 |

These four fields are present as JSON numbers on every observed product; no null/missing values were observed for them. Exact PostgreSQL NUMERIC remains unscaled pending mapping/rounding decisions. Parsed JS-number precision is not evidence of the original textual decimal encoding.

`StatusIsAktif` is numeric, with observed minimum 0, maximum 100 and 4,973 zeros. It is **not a boolean**; no conversion rule to is_active was chosen. `_deleted` remains a separate CouchDB concept.

`OzelKod1` through `OzelKod5` are present as strings on all 11,960 products. `aux_1`–`aux_5`, `lst_props`, `renki`, `gornusi` are additional possible property-related fields. None is assigned to property_1–property_5. Numeric-looking property strings remain string fields; numerical-shape observations do not define their semantics.

Sanitized representative shape (values replaced, field names are real):

```json
{
  "_id": "<opaque original source ID>",
  "$dokuman_tipi": "urun",
  "Adi": "<redacted string>",
  "OlcuBirimi": "<source string; resolution not yet approved>",
  "idFiyatWalyutasy": "<opaque currency reference>",
  "temelAlisFiyati": "<number>",
  "temelSatisFiyati": "<number>",
  "StatusIsAktif": "<numeric status>",
  "OzelKod1": "<string>",
  "OzelKod2": "<string>",
  "OzelKod3": "<string>",
  "OzelKod4": "<string>",
  "OzelKod5": "<string>",
  "lst_Barkodlar": ["<barcode string>"],
  "lst_EkOlculer": ["<supplementary unit object, where present>"]
}
```

## Barcode conclusion

The observed product barcode representation is **embedded**: `urun.lst_Barkodlar` is an array on every product, with 11,960 string element observations across 11,960 products. No separate barcode top-level type was discovered in this scan. The containing `urun._id` supplies ownership; there is no separate barcode-document product FK to map.

`kagent` also has a similarly named barcode array; it must not automatically become product_barcodes. This is evidence about the analyzed Vendor, not a universal rule for all suppliers. No barcode mapper was implemented.

## Reference evidence and gaps

- `zarf.lst_fatura[].lstKalems[].Id_Urun`: sampled IDs resolve to `urun` in the same Vendor. Up to 100 distinct reference values were sampled; representative matches are in the appendix.
- `zarf.lst_fatura[].id_depo1`: 25 distinct sampled values; matches to `depo`.
- `zarf.lst_fatura[].id_depo2`: 28 distinct sampled values; matches to `depo`.
- `urun.idFiyatWalyutasy`: two distinct values observed. `z_walyuta-66qy7_5b821bd3-346f-4297-98f2-41133adcbe5d` matches a live currency document. `z_walyuta-1` does not match a live document in this inventory. Do not synthesize a currency; ask whether it is a legacy/system default.
- `urun.lst_EkOlculer[].olcuId`: nine distinct sampled values, with examples matching the five observed `olc_umum` documents. Supplementary measure objects occur in 122 products. Not all sampled values are proven live references.
- `urun.OlcuBirimi` is a string and a plausible base-measure reference, but its name was not captured by the generic ID/reference sampler. Its exact resolution is an explicitly unresolved question, not an asserted FK match.

No IDs were globally merged across Vendors, cast to integers, UUID-parsed or used as PostgreSQL internal FKs.

## Transactions and future stock calculation

The main structural candidate is **`zarf`**, containing:

```text
zarf
  lst_fatura[]                 nested type: fatura
    Tipi                      numeric transaction type candidate
    Tarihi                    string business-date candidate
    id_depo1 / id_depo2        string warehouse references
    StatusIsAktif             numeric status
    lstKalems[]               nested type: fatura_kalemi
      Id_Urun                 string product reference
      Id_ekOlcu               supplementary measure reference candidate
      esasOlc_SayisiToplam     numeric base-quantity candidate
      ekOlcu_Sayisi            numeric supplementary-quantity candidate
      ekOlcu_TemeleOrani       conversion-ratio candidate
      AkisTipi                numeric flow/direction candidate
      Fiyat_Toplam             numeric line total
      yaramlylykMohleti        string date-like field
    nakitYaParcaOdeme          nested type: kasa_islemi
  lst_kasa[]                  nested type: kasa_islemi
```

There were **33,664 parent zarf documents containing fatura/line observations** and **68,040 inspected line objects**. Nested bounds apply: these are inspected occurrences, not a guarantee of exhaustive line counts for every large array. `lst_kasa[]` was observed in 20,305 parent envelopes.

Both `esasOlc_SayisiToplam` and `ekOlcu_Sayisi` range from **0.0091 to 9815.5**, with up to four observed decimal places and no observed zero/negative values in inspected lines. `ekOlcu_TemeleOrani` ranges 1–300. `AkisTipi` is always **0** in the inspected lines, so its name alone does not establish incoming/outgoing semantics. Header `Tipi` ranges 101–601; exact numeric meanings are unknown. Never infer warehouse direction from names alone.

Line totals range up to 129,200 and up to six observed decimal places; certain derived price fields show up to 21 decimal places after JSON/JS representation. This may reflect floating-point artifacts; do not freeze a monetary scale from these observations.

Potential cancellation/reversal/status evidence: `yln_tarihi`, `ylnTarihi`, `yln_isci`, `sluj_ylnBellik`, `StatusIsAktif`, confirmation fields `tasdik_*`. Their business semantics and whether a document is posted/draft/cancelled are not confirmed. `gaytargy` is numeric (0–66270), not proven a boolean reversal flag. `z_garalama` contains strings FAKTURA/HARYTLAR/KABULEDICI; they are not assumed to be posted stock movements.

**No source stock field was synchronized. No stock was calculated or persisted.** Stock rules require the owner's transaction-type/direction/conversion/cancellation decisions.

## Operation-date candidates

- Transaction header: `zarf.lst_fatura[].Tarihi`.
- Payment/cash records: `zarf.lst_kasa[].Tarihi` and nested payment Tarihi.
- Generic source-change metadata: `uytgeme_tarih`, `uytgeme_tarih_yen` on products, transactions and event records.
- Confirmation/cancellation candidates: `tasdik_tarihi`, `yln_tarihi`, nested `ylnTarihi`.
- Rate history: `z_kurs_walyuta.hangiTarihte`.

These are observed string fields. No timezone, timestamp validity, epoch/default-date convention or final date_last_operation source was frozen. Vendor date fields remain unchanged.

## Unresolved decisions for review

1. Confirm the candidate mappings and which urun price should feed source_products.price.
2. Define every relevant StatusIsAktif/Tipi value; 0, 1 and 100 must not be treated interchangeably or inferred as active/deleted.
3. Confirm OlcuBirimi resolution, supplementary units and missing/default currency references.
4. Decide OzelKod1–5 versus aux_1–5/other property fields.
5. Define transaction incoming/outgoing direction, depot1/depot2 roles, conversion, posting/cancellation/reversal and draft handling.
6. Identify the authoritative operation date and date/time conventions.
7. Explain serialized string fields such as z_garalama.FAKTURA/HARYTLAR and z_waka.obje_before/obje_after before any additional nested decoding is introduced.
8. Decide durable persistence/checkpoint transaction semantics separately. This analysis does not authorize them.
9. Other Vendors were not present; do not assume their types or data versions match this one.

## Safety, schema and verification

The seven approved tables remain empty. Before/after checks confirmed unchanged last_sequence/date_last_sync/date_last_operation across all Vendors and unchanged target-table counts. No mapper, stock calculator, Source Products UI, Product domain, permission or API was created. Existing stored Vendor URL remains root-only; ordinary enabled sync needs the approved database URL configured through the normal Vendor workflow independently of this temporary analysis override.

Exact legacy compatibility and bounded inventory tests cover deleted/unencoded/encrypted/failed cases, malformed decrypted payloads, string-ID preservation, Vendor boundaries, nested fields, secret suppression, exponent-scale observations and supplied dictionary initialization. Related storage/Vendors/SyncManager/database/startup tests passed: **40 tests**, followed by **18 decoder/adapter tests** after adding the metadata projection test (overlap; **41 distinct targeted tests** in total). `npm run build` passed and compiled code performed the real scan. No complete historical regression is claimed. Deep Media/Profile/Users browser suites were intentionally omitted because no such code/UI/authentication behavior changed.

The initial limited pass and final caught-up pass are real analysis runs, not automated tests against production fixtures. Automated tests use synthetic encrypted documents and isolated/local endpoints only. No raw source documents, decoded dictionary, derived keys, passwords or authorization headers were exported.
