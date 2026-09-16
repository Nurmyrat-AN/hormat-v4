import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {VendorEvents} from '../../src/vendors/events.js';
import {syncOptions} from '../../src/vendors/sync/config.js';
import {VendorSyncManager} from '../../src/vendors/sync/manager.js';
import {BatchScheduler} from '../../src/vendors/sync/scheduler.js';
import {nanoTransport, type ChangesTransport, type ChangesBatch} from '../../src/vendors/sync/transport.js';
import {processBatch, retryDelay} from '../../src/vendors/sync/worker.js';
import type {SyncVendor} from '../../src/vendors/sync/repository.js';
const options = {...syncOptions({}), enabled:true, retryMinMs:10, retryMaxMs:50};
const vendor=(id:string):SyncVendor=>({id,url:'http://example.invalid/db',username:'reader',password_encrypted:'encrypted-test',is_active:true,last_sequence:null});
async function until(check:()=>boolean){for(let n=0;n<300&&!check();n++)await delay(5);assert.ok(check(),'Condition did not converge');}
function harness(count=5){
 const rows=new Map(Array.from({length:count},(_,i)=>[String(i+1),vendor(String(i+1))]));
 const events=new VendorEvents(),logs:unknown[]=[],starts:string[]=[],requests:{id:string;since:string|number}[]=[];
 const transport=(row:SyncVendor):ChangesTransport=>{
  starts.push(row.id);let first=true;
  return {async changes(since,signal){requests.push({id:row.id,since});if(first){first=false;return {results:[{id:'doc',doc:{private:'never log'}}],last_seq:'1-opaque'};}
   await delay(100000,undefined,{signal});throw Error('aborted');},async close(){}};
 };
 const repository={async activeIds(){return [...rows.values()].filter(v=>v.is_active).map(v=>v.id);},async get(id:string){const row=rows.get(id);return row?{...row}:undefined;}};
 return {rows,events,logs,starts,requests,transport,repository};
}
test('configuration defaults, opt-in and strict ranges; bounded jitter',()=>{
 assert.equal(syncOptions({}).enabled,false);assert.equal(syncOptions({}).batchSize,100);
 for(const env of [{VENDOR_SYNC_ENABLED:'yes'},{VENDOR_SYNC_BATCH_SIZE:'0'},{VENDOR_SYNC_MAX_CONCURRENT_BATCHES:'101'},{VENDOR_SYNC_RETRY_MIN_MS:'4000',VENDOR_SYNC_RETRY_MAX_MS:'2000'},{VENDOR_SYNC_LONGPOLL_TIMEOUT_MS:'NaN'}])assert.throws(()=>syncOptions(env));
 assert.equal(retryDelay(1,options,()=>0),10);assert.equal(retryDelay(1,options,()=>0.9),19);assert.equal(retryDelay(100,options,()=>0.99),49);
});
test('5 independent active listeners, inactive excluded, repeated start and restart, safe diagnostics',async()=>{
 const h=harness();h.rows.set('6',{...vendor('6'),is_active:false});
 const manager=new VendorSyncManager(h.repository,{decryptSecret:()=> 'test-secret'},h.events,options,h.transport,processBatch,(e,f)=>h.logs.push({e,...f}));
 try{await Promise.all([manager.start(),manager.start()]);await until(()=>manager.getStatus().every(s=>s.currentSequence==='1-opaque'));
 assert.equal(manager.getStatus().length,5);assert.equal(h.starts.length,5);
 assert.ok(!JSON.stringify([manager.getStatus(),h.logs]).includes('secret'));assert.ok(!JSON.stringify(h.logs).includes('private'));
 await manager.stop();assert.equal(manager.getStatus().length,0);await manager.start();await until(()=>h.starts.length===10);
 }finally{await manager.stop();}
});
test('100 Vendors: global bound, FIFO progress, per-Vendor single-flight, queued cancellation',async()=>{
 const h=harness(100);let active=0,max=0;const processing=new Set<string>(),seen=new Set<string>();
 const manager=new VendorSyncManager(h.repository,{decryptSecret:()=> 'secret'},h.events,options,h.transport,async(id,batch,signal)=>{
 assert.ok(!processing.has(id));processing.add(id);active++;max=Math.max(max,active);
 try{await delay(3,undefined,{signal});seen.add(id);return await processBatch(id,batch,signal);}finally{processing.delete(id);active--;}
 },()=>{});
 try{await manager.start();await until(()=>seen.size===100);assert.equal(max,5);assert.equal(h.starts.length,100);
 await Promise.all(Array.from({length:20},()=>manager.start()));assert.equal(h.starts.length,100);
 }finally{await manager.stop();}assert.equal(active,0);
 const scheduler=new BatchScheduler(1),hold=new AbortController(),queued=new AbortController();
 const first=scheduler.run(hold.signal,()=>delay(30));let ran=false;
 const second=scheduler.run(queued.signal,async()=>{ran=true;});queued.abort();await assert.rejects(second);await first;assert.equal(ran,false);
});
test('lifecycle active create/deactivate/reactivate, name no reconnect, credentials preserve and URL resets memory',async()=>{
 const h=harness(1);const manager=new VendorSyncManager(h.repository,{decryptSecret:()=> 'secret'},h.events,options,h.transport,processBatch,()=>{});
 const change=async(fields:string[])=>{h.events.publish({vendorId:'1',changeType:'update',changedFields:fields as any});await manager.refresh('1');};
 try{await manager.start();await until(()=>manager.getStatus()[0]?.currentSequence==='1-opaque');
 await change(['name']);assert.equal(h.starts.length,1);
 h.rows.get('1')!.username='new';await change(['username']);await until(()=>h.starts.length===2);assert.equal(h.requests.filter(r=>r.id==='1')[2].since,'1-opaque');
 h.rows.get('1')!.password_encrypted='replacement';await change(['password']);await until(()=>h.starts.length===3);
 h.rows.get('1')!.url='http://example.invalid/other';await change(['url']);await until(()=>h.starts.length===4);assert.ok(h.requests.slice(-2).some(r=>r.since==='0'));
 h.rows.get('1')!.is_active=false;await change(['is_active']);assert.equal(manager.getStatus().length,0);
 h.rows.get('1')!.is_active=true;await change(['is_active']);assert.equal(manager.getStatus().length,1);
 h.rows.set('2',vendor('2'));h.events.publish({vendorId:'2',changeType:'create',changedFields:[]});await manager.refresh('2');assert.equal(manager.getStatus().length,2);
 h.rows.set('3',{...vendor('3'),is_active:false});await manager.refresh('3');assert.equal(manager.getStatus().length,2);
 }finally{await manager.stop();}
});
test('rapid edits coalesce authoritative reloads; stop cancels initialization and pending reload',async()=>{
 const h=harness(1);let release:()=>void=()=>{};let block=false;
 const repository={...h.repository,async get(id:string){if(block)await new Promise<void>(r=>{release=r;});return h.repository.get(id);}};
 const manager=new VendorSyncManager(repository,{decryptSecret:()=> 'secret'},h.events,options,h.transport,processBatch,()=>{});
 try{await manager.start();block=true;const refresh=manager.refresh('1');
 for(let i=0;i<20;i++){h.rows.get('1')!.username='reader'+i;void manager.refresh('1');}
 block=false;release();await refresh;assert.equal(h.starts.length,2);
 block=true;const pending=manager.refresh('1');const stopped=manager.stop();block=false;release();await Promise.all([pending,stopped]);assert.equal(manager.getStatus().length,0);
 }finally{await manager.stop();}
});
test('failed processing never advances sequence; reconnect resumes last success, failures isolated',async()=>{
 const h=harness(2);const attempts:(string|number)[]=[],logs:any[]=[];let processed=0;
 const manager=new VendorSyncManager(h.repository,{decryptSecret:()=> 'secret'},h.events,options,(row)=>row.id==='2'?h.transport(row):{
 async changes(since,signal){attempts.push(since);if(attempts.length===3)throw Error('password must never appear');if(attempts.length>4){await delay(100000,undefined,{signal});throw Error();}return {results:[{id:'doc'}],last_seq:attempts.length===4?'2-opaque':'1-opaque'};},async close(){}},
 async(id,batch,signal)=>{if(id==='1'&&processed++===0)throw Error('sensitive payload');return processBatch(id,batch,signal);},(e,f)=>logs.push({e,...f}));
 try{await manager.start();await until(()=>manager.getStatus().find(s=>s.vendorId==='1')?.currentSequence==='2-opaque');
 assert.deepEqual(attempts.slice(0,4),['0','0','1-opaque','1-opaque']);assert.equal(manager.getStatus().find(s=>s.vendorId==='2')?.currentSequence,'1-opaque');
 assert.equal(logs.filter(l=>l.e==='retry').length,2);assert.ok(logs.filter(l=>l.e==='retry').every(l=>l.waitMs>=10));assert.ok(!JSON.stringify(logs).includes('sensitive'));
 }finally{await manager.stop();}
});
test('decryption error is isolated, no useless retries; replacement recovers; disabled manager does nothing',async()=>{
 const h=harness(2);h.rows.get('1')!.password_encrypted='broken';let decryptions=0;
 const manager=new VendorSyncManager(h.repository,{decryptSecret:(value)=>{decryptions++;if(value==='broken')throw Error('secret');return 'secret';}},h.events,options,h.transport,processBatch,()=>{});
 try{await manager.start();await until(()=>manager.getStatus().some(s=>s.lastError==='CREDENTIAL_DECRYPTION'));await delay(80);assert.equal(decryptions,2);assert.equal(h.starts.length,1);
 h.rows.get('1')!.password_encrypted='fixed';await manager.refresh('1');await until(()=>h.starts.length===2);
 }finally{await manager.stop();}
 const disabled=new VendorSyncManager({async activeIds(){throw Error('must not read');},async get(){throw Error('must not read');}},{decryptSecret:()=>{throw Error();}},h.events,{...options,enabled:false},()=>{throw Error();});
 await disabled.start();await disabled.refresh('1');await disabled.stop();assert.equal(disabled.getStatus().length,0);
});
test('batch inspection tolerates missing/deleted docs and classifies system docs',async()=>{
 const counts=await processBatch('1',{last_seq:'opaque',results:[{id:'one',doc:{_id:'one'}},{id:'two',deleted:true},{id:'three',doc:{_deleted:true}},{id:'_design/test',doc:{views:{}}},{id:'missing'}]},new AbortController().signal);
 assert.deepEqual(counts,{changes:5,documents:2,deletions:2,designDocuments:1});
});
test('Nano local HTTP: batch query, full encoded proxy path, isolated auth, abort and resource close',async()=>{
 const received:{path:string;auth:boolean}[]=[];let closed=false;
 const server=createServer((req,res)=>{received.push({path:req.url!,auth:req.headers.authorization==='Basic '+Buffer.from('reader:test-password').toString('base64')});
 if(received.length===1){res.setHeader('content-type','application/json');res.end(JSON.stringify({last_seq:'opaque:2',results:[{id:'a',doc:{_id:'a'}},{id:'gone',deleted:true}]}));}
 else{res.on('close',()=>{closed=true;});}});
 server.listen(0,'127.0.0.1');await once(server,'listening');const port=(server.address() as any).port;
 const connection=nanoTransport({...vendor('1'),url:`http://127.0.0.1:${port}/proxy/db%2Fname/`},'test-password',options);
 try{const result=await connection.changes('opaque:1',new AbortController().signal);assert.equal(result.results.length,2);
 const url=new URL(received[0].path,'http://local');assert.equal(url.pathname,'/proxy/db%2Fname/_changes');assert.equal(url.searchParams.get('feed'),'longpoll');assert.equal(url.searchParams.get('include_docs'),'true');assert.equal(url.searchParams.get('limit'),'100');assert.equal(url.searchParams.get('since'),'opaque:1');assert.equal(received[0].auth,true);
 const abort=new AbortController();const request=connection.changes('opaque:2',abort.signal);await until(()=>received.length===2);abort.abort();await assert.rejects(request);await until(()=>closed);
 }finally{await connection.close();server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));}
});

test('malformed batches do not advance; permanent URL failure stays isolated; backoff stops promptly',async()=>{
 const h=harness(3);const logs:any[]=[];
 const manager=new VendorSyncManager(h.repository,{decryptSecret:()=> 'secret'},h.events,options,(row)=>{
 if(row.id==='1')return nanoTransport({...row,url:'file:///bad'},'test',options);
 if(row.id==='2')return {async changes(){return {last_seq:'must-not-advance',results:[null]} as any;},async close(){}};
 return h.transport(row);
 },processBatch,(e,f)=>logs.push({e,...f}));
 try{await manager.start();await until(()=>logs.some(l=>l.code==='INVALID_BATCH'));
 assert.equal(manager.getStatus().find(s=>s.vendorId==='1')?.lastError,'INVALID_URL');
 assert.equal(manager.getStatus().find(s=>s.vendorId==='2')?.currentSequence,'0');
 assert.equal(manager.getStatus().find(s=>s.vendorId==='3')?.currentSequence,'1-opaque');
 const count=logs.length;await manager.stop();await delay(60);assert.equal(logs.slice(count).filter(l=>l.e==='retry').length,0);
 }finally{await manager.stop();}
});
test('Nano reports safe authentication errors without leaking CouchDB response bodies',async()=>{
 const server=createServer((_req,res)=>{res.writeHead(401,{'content-type':'application/json'});res.end(JSON.stringify({error:'unauthorized',reason:'sensitive-test-secret'}));});
 server.listen(0,'127.0.0.1');await once(server,'listening');
 const connection=nanoTransport({...vendor('1'),url:`http://127.0.0.1:${(server.address() as any).port}/db`},'secret',options);
 try{await assert.rejects(connection.changes('0',new AbortController().signal),(error:any)=>{assert.equal(error.code,'AUTHENTICATION');assert.ok(!JSON.stringify(error).includes('sensitive'));return true;});}
 finally{await connection.close();server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));}
});

test('three global slots, busy Vendor fairness, ordered A/B processing and persisted-X restart',async()=>{
 const h=harness(6);h.rows.get('1')!.last_sequence='X';
 const order:string[]=[],since:(string|number)[]=[],seen=new Set<string>();let active=0,max=0;
 let release:()=>void=()=>{};const gate=new Promise<void>(r=>{release=r;});let held=true;
 const manager=new VendorSyncManager(h.repository,{decryptSecret:()=> 'secret'},h.events,{...options,maxConcurrentBatches:3},row=>{
 let request=0;return {async changes(sequence,signal){if(row.id==='1')since.push(sequence);request++;
 if(request> (row.id==='1'?12:1)){await delay(100000,undefined,{signal});throw Error();}
 return {results:[{id:row.id+':'+request}],last_seq:row.id==='1'?'Z'+request:'done'};},async close(){}};
 },async(id,batch,signal)=>{active++;max=Math.max(max,active);order.push('start:'+batch.results[0].id);
 try{if(id==='1'&&held){held=false;await gate;}else await delay(2,undefined,{signal});seen.add(id);return await processBatch(id,batch,signal);}
 finally{order.push('finish:'+batch.results[0].id);active--;}
 },()=>{});
 try{await manager.start();await until(()=>order.includes('start:1:1'));await until(()=>seen.size===5);
 assert.deepEqual(since,['X']);assert.equal(manager.getStatus().find(s=>s.vendorId==='1')!.currentSequence,'X');
 release();await until(()=>manager.getStatus().find(s=>s.vendorId==='1')!.currentSequence==='Z12');
 assert.equal(max,3);assert.equal(seen.size,6);assert.ok(order.indexOf('finish:1:1')<order.indexOf('start:1:2'));
 assert.deepEqual(since.slice(0,3),['X','Z1','Z2']);assert.ok(order.indexOf('start:6:1')<order.indexOf('start:1:12'));
 await manager.stop();const offset=since.length;await manager.start();await until(()=>since.length>offset);assert.equal(since[offset],'X');
 }finally{release();await manager.stop();}assert.equal(active,0);
});

test('duplicate Vendor refresh while retrying creates one retry loop; outage recovery clears state',async()=>{
 const h=harness(4);const logs:any[]=[];const attempts=new Map<string,number>();let recovered=false;
 const manager=new VendorSyncManager(h.repository,{decryptSecret:()=> 'secret'},h.events,options,row=>{
 if(row.id==='4')return h.transport(row);
 return {async changes(_since,signal){attempts.set(row.id,(attempts.get(row.id)??0)+1);
 if(!recovered)throw Object.assign(Error('private connection information'),{code:['ETIMEDOUT','ECONNREFUSED','ENOTFOUND'][Number(row.id)-1]});
 if((attempts.get(row.id)??0)>20){await delay(100000,undefined,{signal});throw Error();}
 return {results:[],last_seq:'recovered'};},async close(){}};
 },processBatch,(e,f)=>logs.push({e,...f}));
 try{await manager.start();await until(()=>logs.filter(l=>l.e==='retry').length>=6);
 const started=logs.filter(l=>l.e==='started').length;await Promise.all(Array.from({length:30},()=>manager.refresh('1')));
 assert.equal(logs.filter(l=>l.e==='started').length,started);assert.equal(manager.getStatus().length,4);
 assert.ok(logs.filter(l=>l.e==='retry').every(l=>l.waitMs>=10&&l.waitMs<=50));
 assert.equal(manager.getStatus().find(s=>s.vendorId==='4')!.currentSequence,'1-opaque');
 recovered=true;await until(()=>manager.getStatus().filter(s=>s.vendorId!=='4').every(s=>s.currentSequence==='recovered'&&s.retryAttempt===0&&s.lastError===null));
 assert.ok(!JSON.stringify([logs,manager.getStatus()]).includes('private'));
 }finally{await manager.stop();}
 const count=logs.length;await manager.refresh('1');await delay(60);assert.equal(logs.length,count);
 // Deterministic random samples prove exponential cap growth and diverse bounded delays without long waits.
 const caps=[1,2,3,10].map(n=>retryDelay(n,options,()=>0.999));assert.deepEqual(caps,[19,39,49,49]);
 assert.ok(new Set(Array.from({length:100},(_,i)=>retryDelay(5,options,()=>i/100))).size>20);
});

test('Nano analysis metadata projects only document counts and releases its connection',async()=>{
 const server=createServer((_req,res)=>{res.setHeader('content-type','application/json');res.end(JSON.stringify({doc_count:3,doc_del_count:1,private:'never-export'}));});
 server.listen(0,'127.0.0.1');await once(server,'listening');
 const connection=nanoTransport({...vendor('1'),url:`http://127.0.0.1:${(server.address() as any).port}/db`},'test',options);
 try{assert.deepEqual(await connection.info!(),{doc_count:3,doc_del_count:1});}
 finally{await connection.close();server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
});

test('Nano dependency lookup uses one authenticated POST with exact opaque keys, projects documents only',async()=>{
 let captured:any;
 const server=createServer(async(req,res)=>{let body='';for await(const chunk of req)body+=chunk;captured={method:req.method,url:req.url,body:JSON.parse(body),auth:req.headers.authorization};res.setHeader('content-type','application/json');res.end(JSON.stringify({rows:[{id:'000123',doc:{_id:'000123',$dokuman_tipi:'urun'}},{key:'missing',error:'not_found'}]}));});
 server.listen(0,'127.0.0.1');await once(server,'listening');const transport=nanoTransport({...vendor('1'),url:`http://127.0.0.1:${(server.address() as any).port}/db`},'fixture',options);
 try{const result=await transport.fetchDocuments!(['000123','ABC','missing'],new AbortController().signal);assert.equal(captured.method,'POST');assert.deepEqual(captured.body,{keys:['000123','ABC','missing']});assert.equal(new URL(captured.url,'http://local').searchParams.get('include_docs'),'true');assert.equal(result.length,1);assert.equal(result[0].id,'000123');assert.ok(captured.auth);}
 finally{await transport.close();server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));}
});
