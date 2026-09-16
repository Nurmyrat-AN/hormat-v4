import {writeFile} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
import {config} from '../../config/env.js';
import {pool} from '../../database/pool.js';
import {VendorCredentials} from '../credentials.js';
import {VendorEvents} from '../events.js';
import {VendorSyncRepository} from '../sync/repository.js';
import {VendorSyncManager} from '../sync/manager.js';
import {nanoTransport} from '../sync/transport.js';
import {processBatch} from '../sync/worker.js';
import {DocumentInventory} from './inventory.js';
import {initializeLegacyDecoder} from './legacy.js';
const repository=new VendorSyncRepository();
const inventories=new Map<string,DocumentInventory>(),done=new Map<string,string>();
function bounded(name:string,fallback:number,max:number){const value=process.env[name]??String(fallback);if(!/^\d+$/.test(value)||+value<1||+value>max)throw Error('Invalid analysis limit');return +value;}
const limit=bounded('COUCHDB_ANALYSIS_LIMIT',100000,2000000),deadlineMs=bounded('COUCHDB_ANALYSIS_DEADLINE_MS',180000,600000);
const options={...config.vendorSync,enabled:true,batchSize:1000,longpollTimeoutMs:1000};
const tables=['warehouses','currencies','measures','source_products','product_barcodes','product_stocks','products'];
async function snapshot(){return {vendors:(await pool.query('SELECT id,last_sequence,date_last_sync,date_last_operation FROM vendors ORDER BY id')).rows,counts:await Promise.all(tables.map(async table=>({table,count:(await pool.query(`SELECT count(*)::text AS n FROM ${table}`)).rows[0].n})))};}
let manager:VendorSyncManager|undefined;
try{
 initializeLegacyDecoder();
 const ids=(await repository.activeIds()).filter(id=>!process.env.COUCHDB_ANALYSIS_VENDOR_ID||id===process.env.COUCHDB_ANALYSIS_VENDOR_ID);
 if(process.env.COUCHDB_ANALYSIS_URL&&(!process.env.COUCHDB_ANALYSIS_VENDOR_ID||ids.length!==1))throw new Error('URL override requires one active Vendor');
 const before=await snapshot();
 const metadata:Record<string,unknown>={};
 for(const id of ids){const row=(await repository.get(id))!;const transport=nanoTransport({...row,url:process.env.COUCHDB_ANALYSIS_URL??row.url},new VendorCredentials(config.vendors.credentialsKey).decryptSecret(row.password_encrypted),options);try{metadata[id]=await transport.info!();}finally{await transport.close();}}
 for(const id of ids)inventories.set(id,new DocumentInventory(id,process.env.COUCHDB_ANALYSIS_TYPE_FIELD));
 manager=new VendorSyncManager({activeIds:async()=>ids,get:async id=>{const row=await repository.get(id);return row?{...row,url:process.env.COUCHDB_ANALYSIS_URL??row.url,last_sequence:null,is_active:row.is_active&&!done.has(id)}:undefined;}},new VendorCredentials(config.vendors.credentialsKey),new VendorEvents(),options,undefined,
 async(id,batch,signal)=>{const inventory=inventories.get(id)!;inventory.inspect(batch);if(!batch.results.length||inventory.stats.total>=limit){done.set(id,batch.results.length?'document limit':'caught up');setImmediate(()=>{void manager!.refresh(id);});}return processBatch(id,batch,signal);},()=>{});
 const start=Date.now();await manager.start();
 while(done.size<ids.length&&Date.now()-start<deadlineMs){await delay(500);for(const status of manager.getStatus())if(status.connectionState==='error')done.set(status.vendorId,status.lastError??'worker error');}
 const statuses=manager.getStatus().map(s=>({vendorId:s.vendorId,state:s.connectionState,error:s.lastError}));await manager.stop();
 const after=await snapshot();const unchanged=JSON.stringify(before)===JSON.stringify(after);
 const report={generatedAt:new Date().toISOString(),durationMs:Date.now()-start,limitPerVendor:limit,deadlineMs,discriminator:process.env.COUCHDB_ANALYSIS_TYPE_FIELD??null,coverage:ids.map(id=>({vendorId:id,result:done.get(id)??'time limit',status:statuses.find(s=>s.vendorId===id)})),databaseUnchanged:unchanged,metadata,vendors:[...inventories.values()].map(i=>i.report())};
 await writeFile('docs/COUCHDB_DOCUMENT_INVENTORY.json',JSON.stringify(report,null,2)+'\n',{mode:0o600});
 console.info(JSON.stringify({vendors:ids.length,inspected:report.vendors.reduce((n,v)=>n+v.stats.total,0),databaseUnchanged:unchanged,coverage:report.coverage}));
 if(!unchanged)process.exitCode=1;
 else if(report.coverage.some(item=>!['caught up','document limit'].includes(item.result)))process.exitCode=2;
}catch{console.error('CouchDB analysis failed; no sensitive error details emitted.');process.exitCode=1;}
finally{await manager?.stop();await pool.end();}
