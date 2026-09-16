import type {Pool,PoolClient} from 'pg';
import {pool} from '../../database/pool.js';
import type {SyncVendor} from './repository.js';
import {SyncFailure} from './transport.js';
import {array, decimal, text, movements, referenceTables, type SourceDocument, type Need, type Effect, type ReferenceTable} from './mapping.js';
const tables:ReferenceTable[]=['warehouses','measures','currencies','source_products'];
export class DurableSyncRepository {
  constructor(readonly database:Pool=pool){}
  private async locked(client:PoolClient,vendor:SyncVendor){
    const row=(await client.query('SELECT url,is_active,last_sequence FROM vendors WHERE id=$1 FOR UPDATE',[vendor.id])).rows[0];
    if(!row?.is_active)throw new SyncFailure('VENDOR_PAUSED',true);
    if(row.url!==vendor.url)throw new SyncFailure('SOURCE_CHANGED',true);
    const binding=(await client.query('SELECT source_url FROM vendor_sync_sources WHERE vendor_id=$1',[vendor.id])).rows[0];
    if(binding && binding.source_url!==vendor.url)throw new SyncFailure('SOURCE_CHANGED',true);
    // A legacy checkpoint with no binding cannot be proven to belong to this URL.
    if(!binding && row.last_sequence!==null)throw new SyncFailure('SOURCE_CHANGED',true);
    if(!binding)await client.query('INSERT INTO vendor_sync_sources(vendor_id,source_url) VALUES($1,$2)',[vendor.id,vendor.url]);
    return row.last_sequence as string|null;
  }
  async bind(vendor:SyncVendor):Promise<string|null>{
    const c=await this.database.connect();try{await c.query('BEGIN');const s=await this.locked(c,vendor);await c.query('COMMIT');return s;}
    catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
  }
  async effects():Promise<Map<number,Effect>>{
    return new Map((await this.database.query("SELECT type_code,warehouse_1_effect,warehouse_2_effect FROM transaction_types WHERE transaction_kind='fatura'")).rows.map(r=>[r.type_code,r]));
  }
  async missing(vendorId:string,needs:Need[]):Promise<Need[]>{
    const result:Need[]=[];
    for(const table of tables){const ids=[...new Set(needs.filter(n=>n.table===table).map(n=>n.id))];if(!ids.length)continue;
      const found=new Set((await this.database.query(`SELECT source_id FROM ${table} WHERE vendor_id=$1 AND source_id=ANY($2::text[])`,[vendorId,ids])).rows.map(r=>r.source_id));
      result.push(...ids.filter(id=>!found.has(id)).map(id=>({table,id})));
    }
    return result;
  }
  /** One Vendor row lock serializes duplicate workers/processes and document snapshot replacement. */
  async commit(vendor:SyncVendor,docs:SourceDocument[],signal:AbortSignal,checkpoint?:{since:string|number;next:string|number;operationDates?:string[]},bootstrap=false):Promise<void>{
    const c=await this.database.connect();
    try{
      await c.query('BEGIN');
      await c.query("SET LOCAL lock_timeout='10s'");
      await c.query("SET LOCAL statement_timeout='60s'");
      const sequence=await this.locked(c,vendor);
      if(bootstrap && sequence!==null && sequence!=='0')throw new SyncFailure('STALE_CHECKPOINT');
      if(checkpoint && (sequence??'0')!==String(checkpoint.since))throw new SyncFailure('STALE_CHECKPOINT');
      signal.throwIfAborted();
      await this.references(c,vendor.id,docs);
      await this.products(c,vendor.id,docs);
      const effects=new Map<number,Effect>((await c.query("SELECT type_code,warehouse_1_effect,warehouse_2_effect FROM transaction_types WHERE transaction_kind='fatura'")).rows.map(r=>[r.type_code,r]));
      await this.stocks(c,vendor.id,docs,effects);
      signal.throwIfAborted();
      if(checkpoint)await c.query(`WITH operation AS (
        SELECT max(stamp::timestamptz) value FROM unnest($3::text[]) AS stamp
      ) UPDATE vendors SET
        date_last_sync=CASE WHEN last_sequence IS DISTINCT FROM $2 THEN clock_timestamp() ELSE date_last_sync END,
        last_sequence=$2,date_last_operation=greatest(date_last_operation,operation.value)
      FROM operation WHERE id=$1 AND (last_sequence IS DISTINCT FROM $2 OR
        (operation.value IS NOT NULL AND (date_last_operation IS NULL OR date_last_operation<operation.value)))`,
      [vendor.id,String(checkpoint.next),checkpoint.operationDates??[]]);
      await c.query('COMMIT');
    }catch(error){await c.query('ROLLBACK');if(error instanceof SyncFailure)throw error;throw new SyncFailure('PROCESSING');}
    finally{c.release();}
  }
  private async references(c:PoolClient,vendor:string,docs:SourceDocument[]){
    // Main currency wins over a normal document with the reserved same source ID.
    const ordered=[...docs].sort((a,b)=>Number(a.type==='ayar_umum')-Number(b.type==='ayar_umum'));
    for(const table of ['currencies','measures','warehouses'] as const){
      const rows=new Map<string,{source_id:string;name:string}>();
      for(const d of ordered){if(d.deleted || referenceTables[d.type as keyof typeof referenceTables]!==table)continue;
        const source_id=d.type==='ayar_umum'?'z_walyuta-1':d.id;
        rows.set(source_id,{source_id,name:text(d.type==='ayar_umum'?d.data.paraAdi:d.data.Adi)});
      }
      if(rows.size)await c.query(`INSERT INTO ${table}(vendor_id,source_id,name)
        SELECT $1,r.source_id,r.name FROM jsonb_to_recordset($2::jsonb) AS r(source_id text,name text)
        ORDER BY r.source_id COLLATE "C" ON CONFLICT(vendor_id,source_id) DO UPDATE SET name=EXCLUDED.name`,[vendor,JSON.stringify([...rows.values()])]);
    }
  }
  private async resolve(c:PoolClient,table:ReferenceTable,vendor:string,ids:string[]){
    return new Map<string,string>((await c.query(`SELECT source_id,id FROM ${table} WHERE vendor_id=$1 AND source_id=ANY($2::text[])`,[vendor,[...new Set(ids)]])).rows.map(r=>[r.source_id,r.id]));
  }
  private required(map:Map<string,string>,key:string){const id=map.get(key);if(!id)throw new SyncFailure('MISSING_DEPENDENCY');return id;}
  private async products(c:PoolClient,vendor:string,docs:SourceDocument[]){
    const products=docs.filter(d=>!d.deleted&&d.type==='urun');if(!products.length)return;
    const currencies=await this.resolve(c,'currencies',vendor,products.map(d=>text(d.data.idFiyatWalyutasy)));
    const measures=await this.resolve(c,'measures',vendor,products.map(d=>text(d.data.OlcuBirimi)));
    const rows=products.map(d=>{
      const data=d.data,properties:Record<string,string|null>={};
      for(let n=1;n<=5;n++){const value=data[`OzelKod${n}`];if(value!==undefined&&value!==null&&typeof value!=='string')throw new SyncFailure('MALFORMED_SOURCE');properties[`property_${n}`]=(value as string|null|undefined)??null;}
      const barcodes=array(data.lst_Barkodlar);if(barcodes.some(b=>typeof b!=='string'||b.includes('\0')))throw new SyncFailure('MALFORMED_SOURCE');
      return {source_id:d.id,name:text(data.Adi),price:decimal(data.temelSatisFiyati),is_active:data.StatusIsAktif===1,
        currency_id:this.required(currencies,text(data.idFiyatWalyutasy)),measure_id:this.required(measures,text(data.OlcuBirimi)),...properties,barcodes:[...new Set(barcodes)]};
    });
    await c.query(`INSERT INTO source_products(vendor_id,source_id,name,price,is_active,currency_id,measure_id,property_1,property_2,property_3,property_4,property_5)
      SELECT $1,r.source_id,r.name,r.price,r.is_active,r.currency_id,r.measure_id,r.property_1,r.property_2,r.property_3,r.property_4,r.property_5
      FROM jsonb_to_recordset($2::jsonb) AS r(source_id text,name text,price numeric,is_active boolean,currency_id bigint,measure_id bigint,property_1 text,property_2 text,property_3 text,property_4 text,property_5 text)
      ORDER BY r.source_id COLLATE "C" ON CONFLICT(vendor_id,source_id) DO UPDATE SET name=EXCLUDED.name,price=EXCLUDED.price,is_active=EXCLUDED.is_active,
      currency_id=EXCLUDED.currency_id,measure_id=EXCLUDED.measure_id,property_1=EXCLUDED.property_1,property_2=EXCLUDED.property_2,property_3=EXCLUDED.property_3,property_4=EXCLUDED.property_4,property_5=EXCLUDED.property_5`,[vendor,JSON.stringify(rows)]);
    await c.query('DELETE FROM product_barcodes WHERE vendor_id=$1 AND product_id IN (SELECT id FROM source_products WHERE vendor_id=$1 AND source_id=ANY($2::text[]))',[vendor,rows.map(r=>r.source_id)]);
    await c.query(`INSERT INTO product_barcodes(vendor_id,product_id,barcode)
      SELECT $1,p.id,b.value FROM jsonb_to_recordset($2::jsonb) AS r(source_id text,barcodes jsonb)
      JOIN source_products p ON p.vendor_id=$1 AND p.source_id=r.source_id CROSS JOIN LATERAL jsonb_array_elements_text(r.barcodes) b`,[vendor,JSON.stringify(rows)]);
  }
  private async stocks(c:PoolClient,vendor:string,docs:SourceDocument[],effects:Map<number,Effect>){
    // Any tombstone reconciles existing snapshots by its opaque ID; no deleted payload is needed.
    const changed=docs.filter(d=>d.deleted||d.type==='zarf');if(!changed.length)return;
    const raw=changed.flatMap(d=>movements(d,effects));if(raw.length>100000)throw new SyncFailure('BATCH_LIMIT');
    const products=await this.resolve(c,'source_products',vendor,raw.map(m=>m.product));
    const warehouses=await this.resolve(c,'warehouses',vendor,raw.map(m=>m.warehouse));
    const rows=raw.map(m=>({source_document_id:m.document,product_id:this.required(products,m.product),warehouse_id:this.required(warehouses,m.warehouse),quantity:m.quantity,effect:m.effect}));
    // PostgreSQL performs ALL sums, multiplication and subtraction using exact NUMERIC.
    await c.query(`CREATE TEMP TABLE sync_new_movements ON COMMIT DROP AS
      SELECT source_document_id,product_id,warehouse_id,sum(quantity*effect) AS stock_delta
      FROM jsonb_to_recordset($1::jsonb) AS r(source_document_id text,product_id bigint,warehouse_id bigint,quantity numeric,effect integer)
      GROUP BY source_document_id,product_id,warehouse_id`,[JSON.stringify(rows)]);
    await c.query(`INSERT INTO product_stocks(vendor_id,product_id,warehouse_id,stock)
      SELECT $1,product_id,warehouse_id,sum(stock_delta) FROM (
        SELECT product_id,warehouse_id,stock_delta FROM sync_new_movements
        UNION ALL SELECT product_id,warehouse_id,-stock_delta FROM source_stock_movements WHERE vendor_id=$1 AND source_document_id=ANY($2::text[])
      ) deltas GROUP BY product_id,warehouse_id ORDER BY product_id,warehouse_id
      ON CONFLICT(product_id,warehouse_id) DO UPDATE SET stock=product_stocks.stock+EXCLUDED.stock`,[vendor,changed.map(d=>d.id)]);
    await c.query('DELETE FROM source_stock_movements WHERE vendor_id=$1 AND source_document_id=ANY($2::text[])',[vendor,changed.map(d=>d.id)]);
    await c.query(`INSERT INTO source_stock_movements(vendor_id,source_document_id,product_id,warehouse_id,stock_delta)
      SELECT $1,source_document_id,product_id,warehouse_id,stock_delta FROM sync_new_movements ORDER BY source_document_id COLLATE "C",product_id,warehouse_id`,[vendor]);
  }
}
