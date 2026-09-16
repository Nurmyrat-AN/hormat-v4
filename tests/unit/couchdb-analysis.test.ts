import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {createCipheriv} from 'node:crypto';
import {initializeKeys,initializeLegacyDecoder,normalizeAesKey,verKeyForDto,decodeDocument} from '../../src/vendors/analysis/legacy.js';
import {DocumentInventory} from '../../src/vendors/analysis/inventory.js';
function encrypt(key:string,value:unknown){const cipher=createCipheriv('aes-256-cbc',Buffer.from(normalizeAesKey(key),'utf8'),Buffer.alloc(16));return cipher.update(JSON.stringify(value),'utf8','base64')+cipher.final('base64');}
after(()=>initializeKeys());
test('exact supplied compatibility dictionary initializes; bad override fails safely',()=>{
 assert.equal(initializeKeys(),true);const before=process.env.LEGACY_KEY_DICTIONARY_BLOB;
 try{process.env.LEGACY_KEY_DICTIONARY_BLOB='bad-secret-marker';assert.throws(initializeLegacyDecoder,{message:'Legacy decoder initialization failed. Check compatibility material.'});}
 finally{if(before===undefined)delete process.env.LEGACY_KEY_DICTIONARY_BLOB;else process.env.LEGACY_KEY_DICTIONARY_BLOB=before;}
});
test('legacy fixture: key derivation, exact string IDs, CBC object merge, delete/unencoded/failure semantics',()=>{
 initializeKeys(encrypt('LEGIT',{_key2020:'0123456789abcdefSYNTHETIC-KEY'}));
 for(const id of ['123','000123','abc-123','ABC_001']){
 const raw={_id:id,_rev:'1-test',load:encrypt(verKeyForDto(id),{type:'Fixture',reference:'00123',value:2})};
 const result=decodeDocument(raw);assert.equal(result.status,'success');assert.equal(result.decoded!._id,id);assert.equal(result.decoded!.reference,'00123');assert.ok(!Object.hasOwn(result.decoded!,'load'));
 }
 assert.equal(verKeyForDto('prefix-123'),verKeyForDto('other-123'));
 const raw={_id:'00123',nested:{value:'untouched'}};const plain=decodeDocument(raw);assert.equal(plain.status,'not_required');(plain.decoded!.nested as any).value='changed';assert.equal(raw.nested.value,'untouched');
 assert.equal(decodeDocument({_deleted:true,load:'bad'}).status,'deleted');
 for(const raw of [{_id:12,load:'bad'},{_id:'id',load:12},{_id:'id',load:'bad'},{_id:'id',load:encrypt(verKeyForDto('id'),[]) }])assert.equal(decodeDocument(raw).status,'failed');
 const merged=decodeDocument({_id:'outer',load:encrypt(verKeyForDto('outer'),{_id:'inner'})});assert.equal(merged.decoded!._id,'inner');
});
test('inventory classifies decoded content, counts failures/deletions, preserves Vendor-scoped references, nested shapes',()=>{
 initializeKeys(encrypt('LEGIT',{_key2020:'0123456789abcdefSYNTHETIC-KEY'}));
 const first=new DocumentInventory('1','type');const second=new DocumentInventory('2','type');
 first.inspect({last_seq:'opaque',results:[{id:'00123',doc:{_id:'00123',type:'Reference'}},{id:'000123',doc:{_id:'000123',load:encrypt(verKeyForDto('000123'),{type:'Transaction',items:[{productid:'00123',quantity:'-1.25'}],password:'never-report'})}},{id:'bad',doc:{_id:'bad',load:'ciphertext-never-report'}},{id:'gone',deleted:true},{id:'missing'}]});
 second.inspect({last_seq:'opaque',results:[{id:'00123',doc:{_id:'00123',type:'Different'}}]});
 const report=first.report();assert.equal(report.stats.success,1);assert.equal(report.stats.not_required,1);assert.equal(report.stats.deleted,1);assert.equal(report.stats.failed,1);assert.equal(report.stats.missing,1);
 assert.ok(report.families['type=Transaction']);assert.equal(report.families['type=Transaction'].fields['items[].quantity'].numeric!.negative,1);
 assert.equal(report.references.find(r=>r.field.endsWith('productid'))!.matches[0].id,'00123');assert.equal(second.report().families['type=Different'].count,1);
 assert.ok(!JSON.stringify(report).includes('never-report'));assert.ok(!JSON.stringify(report).includes('ciphertext'));
});
test('field metadata excludes sensitive values, exponent precision, source override identity remains outer',()=>{
 const inventory=new DocumentInventory('1','type');
 inventory.inspect({last_seq:'0',results:[{id:'000123',doc:{_id:'000123',type:'Fixture',amount:1e-7,Password:'private-do-not-report',CepTel:'123456789',obj:{token:'private-do-not-report'},referenceid:'00123'}}]});
 const f=inventory.report().families['type=Fixture'];assert.equal(f.fields.Password.presence,1);assert.deepEqual(f.fields.Password.examples,[]);assert.equal(f.fields.CepTel.numeric,undefined);assert.equal(f.fields.amount.numeric!.maxDecimalPlaces,7);assert.ok(!JSON.stringify(inventory.report()).includes('private-do-not-report'));
});
