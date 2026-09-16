import {decodeDocument} from '../analysis/legacy.js';
import {SyncFailure, type ChangesBatch} from './transport.js';
export type Document = Record<string, unknown>;
export interface SourceDocument {id:string; type:string; data:Document; deleted:boolean}
export function object(value:unknown):Document {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new SyncFailure('MALFORMED_SOURCE');
  return value as Document;
}
export function text(value:unknown):string {
  if(typeof value !== 'string' || !value.length || value.includes('\0')) throw new SyncFailure('MALFORMED_SOURCE');
  return value;
}
export function array(value:unknown):unknown[] {
  if(!Array.isArray(value)) throw new SyncFailure('MALFORMED_SOURCE');
  return value;
}
/** No arithmetic on JS numbers: decimal strings go directly to PostgreSQL NUMERIC. */
export function decimal(value:unknown):string {
  if(typeof value !== 'number' && typeof value !== 'string') throw new SyncFailure('MALFORMED_SOURCE');
  const result=String(value);
  if(result.length>100 || !/^-?\d+(?:\.\d+)?(?:e[+-]?\d{1,3})?$/i.test(result)) throw new SyncFailure('MALFORMED_SOURCE');
  return result;
}
export function decodeBatch(batch:ChangesBatch):SourceDocument[] {
  if(!batch || !Array.isArray(batch.results) || batch.results.length>10000 ||
    !(typeof batch.last_seq==='string' && batch.last_seq.length>0 || typeof batch.last_seq==='number' && Number.isSafeInteger(batch.last_seq)))throw new SyncFailure('INVALID_BATCH');
  const documents=new Map<string,SourceDocument>();
  for(const change of batch.results){
    if(!change || typeof change!=='object')throw new SyncFailure('INVALID_BATCH');
    const id=text(change.id);
    if(id.startsWith('_design/')||id.startsWith('_local/'))continue;
    if(change.deleted!==undefined && typeof change.deleted!=='boolean')throw new SyncFailure('INVALID_BATCH');
    if(change.doc?._deleted!==undefined && typeof change.doc._deleted!=='boolean')throw new SyncFailure('MALFORMED_SOURCE');
    if(change.deleted===true || change.doc?._deleted===true){documents.set(id,{id,type:'',data:{},deleted:true});continue;}
    const result=decodeDocument(object(change.doc));
    if(!result.decoded || result.status==='failed')throw new SyncFailure('DECODE_FAILED');
    const data=result.decoded;
    if(text(data._id)!==id)throw new SyncFailure('MALFORMED_SOURCE');
    documents.set(id,{id,type:typeof data.$dokuman_tipi==='string'?data.$dokuman_tipi:'',data,deleted:false});
  }
  return [...documents.values()];
}
export const referenceTables={depo:'warehouses',olc_umum:'measures',z_walyuta:'currencies',ayar_umum:'currencies'} as const;
export type ReferenceTable='warehouses'|'measures'|'currencies'|'source_products';
export interface Need {table:ReferenceTable; id:string}
export interface Effect {warehouse_1_effect:number;warehouse_2_effect:number}
export interface RawMovement {document:string; product:string; warehouse:string; quantity:string; effect:number}
export function movements(doc:SourceDocument,effects:Map<number,Effect>):RawMovement[]{
  if(doc.deleted || doc.type!=='zarf')return [];
  const result:RawMovement[]=[];
  for(const item of array(doc.data.lst_fatura)){
    const f=object(item);
    // The actual source uses numeric 0/1, not truthiness or another cancellation flag.
    if(f.sluj_isYanlis===1)continue;
    if(typeof f.Tipi!=='number' || !Number.isInteger(f.Tipi))throw new SyncFailure('MALFORMED_SOURCE');
    const effect=effects.get(f.Tipi);if(!effect)throw new SyncFailure('UNKNOWN_TRANSACTION_TYPE');
    for(const item of array(f.lstKalems)){
      const line=object(item),product=text(line.Id_Urun),quantity=decimal(line.esasOlc_SayisiToplam);
      for(const n of [1,2] as const){const sign=effect[`warehouse_${n}_effect`];
        if(sign){result.push({document:doc.id,product,warehouse:text(f[`id_depo${n}`]),quantity,effect:sign});if(result.length>100000)throw new SyncFailure('BATCH_LIMIT');}
      }
    }
  }
  return result;
}
export function dependencies(docs:SourceDocument[],effects:Map<number,Effect>):Need[]{
  const result:Need[]=[];
  for(const doc of docs){
    if(doc.deleted)continue;
    if(doc.type==='urun'){
      result.push({table:'currencies',id:text(doc.data.idFiyatWalyutasy)},{table:'measures',id:text(doc.data.OlcuBirimi)});
    }
    for(const m of movements(doc,effects))result.push({table:'source_products',id:m.product},{table:'warehouses',id:m.warehouse});
  }
  if(result.length>100000)throw new SyncFailure('BATCH_LIMIT');
  return result;
}
