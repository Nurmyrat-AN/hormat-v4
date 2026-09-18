import {initializeLegacyDecoder} from '../analysis/legacy.js';
import {sourceEditTimestamps} from './operation-date.js';
import {DurableSyncRepository} from './durable-repository.js';
import {decodeBatch,dependencies,referenceTables} from './mapping.js';
import {SyncFailure} from './transport.js';
import {processBatch,type BatchProcessor,type BatchPreparation} from './worker.js';
/** Bounded reference bootstrap + bulk dependency reads, using the same worker/transport. */
export class DurableSync {
  private initialized=false;
  constructor(readonly repository=new DurableSyncRepository()){}
  readonly prepare:BatchPreparation=async(vendor,transport,signal,schedule=task=>task())=>{
    if(!this.initialized){initializeLegacyDecoder();this.initialized=true;}
    const sequence=await this.repository.bind(vendor);
    if(sequence!==null && sequence!=='0')return sequence;
    // This prepass NEVER advances the checkpoint. A normal full pass still starts at 0.
    // Changes concurrent with this scan are consequently consumed by that full pass/tail.
    let since:string|number='0';
    for(let page=0;page<100000;page++){
      signal.throwIfAborted();
      const batch=await transport.changes(since,signal);
      const docs=decodeBatch(batch).filter(d=>!d.deleted&&Object.hasOwn(referenceTables,d.type));
      if(docs.length)await schedule(()=>this.repository.commit(vendor,docs,signal,undefined,true));
      if(!batch.results.length)return '0';
      if(String(batch.last_seq)===String(since))throw new SyncFailure('INVALID_BATCH');
      since=batch.last_seq;
    }
    throw new SyncFailure('BATCH_LIMIT');
  };
  readonly process:BatchProcessor=async(id,batch,signal,context)=>{
    if(!context)throw new SyncFailure('PROCESSING');
    const docs=decodeBatch(batch), all=new Map(docs.map(d=>[d.id,d]));
    const effects=await this.repository.effects();
    // zarf -> product -> currency/measure is at most two dependency edges.
    for(let round=0;round<3;round++){
      const supplied=new Set<string>();
      for(const d of all.values()){
        if(d.deleted)continue;
        const table=d.type==='urun'?'source_products':referenceTables[d.type as keyof typeof referenceTables];
        if(table)supplied.add(JSON.stringify([table,d.type==='ayar_umum'?'z_walyuta-1':d.id]));
      }
      const needs=dependencies([...all.values()],effects).filter(n=>!supplied.has(JSON.stringify([n.table,n.id])));
      const missing=await this.repository.missing(id,needs);
      if(!missing.length)break;
      if(!context.transport.fetchDocuments)throw new SyncFailure('MISSING_DEPENDENCY');
      // The reserved main currency is supplied by settings, not necessarily a z_walyuta document.
      // Fetch both identities in the same bounded round, including after bootstrap/checkpoint resume.
      const ids=[...new Set(missing.flatMap(n=>n.table==='currencies' && n.id==='z_walyuta-1'
        ? [n.id,'ayar_umum-1'] : [n.id]))];if(ids.length>10000)throw new SyncFailure('BATCH_LIMIT');
      let added=0;
      // Requests stay bounded; never fetch one document per request.
      for(let offset=0;offset<ids.length;offset+=500){
        const changes=await context.transport.fetchDocuments(ids.slice(offset,offset+500),signal);
        for(const d of decodeBatch({results:changes,last_seq:'dependency'})){
          if(!ids.includes(d.id))throw new SyncFailure('INVALID_BATCH');
          if(d.deleted || !['urun','depo','olc_umum','z_walyuta','ayar_umum'].includes(d.type))continue;
          if(!all.has(d.id)){all.set(d.id,d);added++;}
        }
      }
      if(!added)throw new SyncFailure('MISSING_DEPENDENCY');
    }
    await this.repository.commit(context.vendor,[...all.values()],signal,{since:context.since,next:batch.last_seq,operationDates:sourceEditTimestamps(docs)});
    return processBatch(id,batch,signal);
  };
}
