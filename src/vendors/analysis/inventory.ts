import {createHash} from 'node:crypto';
import {decodeDocument} from './legacy.js';
import type {ChangesBatch} from '../sync/transport.js';
const sensitive=/(password|secret|token|authorization|credential|_key|email|phone|address|adres|gps|basicauth|documentupload|(^|\.)(ceptel|tel|telefon|fax|maasi)(\.|$)|^load$)/i;
const typeField=/^(type|doc_?type|doctype|table|entity|model|kind|tip|class)$/i;
const reference=/(^id|id$|_id$|ref|measure|currency|warehouse|product)/i;
export function safeId(id:string):string{return /^[\p{L}\p{N}_:/.-]{1,160}$/u.test(id)?id:'redacted:'+createHash('sha256').update(id).digest('hex').slice(0,16);}
interface Field {presence:number;types:Record<string,number>;examples:Array<string|number|boolean>;numeric?:{min:number;max:number;zero:number;negative:number;maxDecimalPlaces:number}}
interface Family {count:number;encrypted:number;unencrypted:number;ids:string[];fields:Record<string,Field>;truncated:boolean}
export class DocumentInventory {
 readonly stats={total:0,success:0,not_required:0,failed:0,deleted:0,missing:0,identityOverrides:0};
 readonly failures:Array<{id:string;category:string}>=[];
 readonly deletedIds:string[]=[];
 readonly families=new Map<string,Family>();
 readonly ids=new Map<string,string>();
 readonly references=new Map<string,Set<string>>();
 constructor(readonly vendorId:string,readonly discriminator?:string){}
 inspect(batch:ChangesBatch){for(const change of batch.results){
  this.stats.total++;
  if(change.deleted){this.stats.deleted++;if(this.deletedIds.length<10)this.deletedIds.push(safeId(change.id));continue;}
  if(!change.doc){this.stats.missing++;continue;}
  const result=decodeDocument(change.doc);this.stats[result.status]++;
  if(result.status==='deleted'){if(this.deletedIds.length<10)this.deletedIds.push(safeId(change.id));continue;}
  if(result.status==='failed'){if(this.failures.length<10)this.failures.push({id:safeId(change.id),category:'LEGACY_DECODE_FAILED'});continue;}
  const doc=result.decoded!;
  // Supplied decoder merges raw+payload faithfully; analysis identity always remains the outer change ID.
  if(doc._id!==undefined&&doc._id!==change.id)this.stats.identityOverrides++;
  const keys=Object.keys(doc).sort();
  const explicit=this.discriminator?doc[this.discriminator]:undefined;
  let familyKey=this.discriminator&&typeof explicit==='string'&&!sensitive.test(this.discriminator)?`${this.discriminator}=${safeId(explicit)}`:'shape:'+createHash('sha256').update(JSON.stringify(keys)).digest('hex').slice(0,16);
  if(!this.families.has(familyKey)&&this.families.size>=512)familyKey='shape:overflow';
  let family=this.families.get(familyKey);
  if(!family){family={count:0,encrypted:0,unencrypted:0,ids:[],fields:Object.create(null),truncated:familyKey==='shape:overflow'};this.families.set(familyKey,family);}
  family.count++;family[result.encrypted?'encrypted':'unencrypted']++;if(family.ids.length<5)family.ids.push(safeId(change.id));
  this.ids.set(change.id,familyKey);
  const present=new Set<string>();
  const visit=(value:unknown,path:string,depth:number)=>{
   if(!Object.hasOwn(family!.fields,path)){if(Object.keys(family!.fields).length>=1024){family!.truncated=true;return;}family!.fields[path]={presence:0,types:{},examples:[]};}
   const field=family!.fields[path];if(!present.has(path)){field.presence++;present.add(path);}
   const type=value===null?'null':Array.isArray(value)?'array':typeof value;field.types[type]=(field.types[type]??0)+1;
   if(sensitive.test(path))return; // Record field/type/presence, never values or nested secrets.
   const leaf=path.split('.').at(-1)!;
   if(typeof value==='string'&&(typeField.test(leaf)||leaf===this.discriminator||reference.test(leaf))&&field.examples.length<3){const sample=safeId(value);if(!field.examples.includes(sample))field.examples.push(sample);}
   if(typeof value==='boolean'&&field.examples.length<2&&!field.examples.includes(value))field.examples.push(value);
   if(typeof value==='number'||(typeof value==='string'&&/^-?\d+(\.\d+)?$/.test(value)&&!reference.test(leaf)&&leaf!=='_id')){
    const numeric=Number(value);if(Number.isFinite(numeric)&&!reference.test(leaf)&&leaf!=='_id'){
     const [mantissa,exponent='0']=String(value).toLowerCase().split('e');
     const decimal=Math.max(0,(mantissa.split('.')[1]?.length??0)-Number(exponent));
     field.numeric??={min:numeric,max:numeric,zero:0,negative:0,maxDecimalPlaces:0};
     field.numeric.min=Math.min(field.numeric.min,numeric);field.numeric.max=Math.max(field.numeric.max,numeric);
     field.numeric.zero+=Number(numeric===0);field.numeric.negative+=Number(numeric<0);field.numeric.maxDecimalPlaces=Math.max(field.numeric.maxDecimalPlaces,decimal);
    }
   }
   if(typeof value==='string'&&reference.test(leaf)&&leaf!=='_id'){
    const refKey=familyKey+' / '+path;let set=this.references.get(refKey);if(!set){set=new Set();this.references.set(refKey,set);}if(set.size<100)set.add(value);
   }
   if(depth>=5){if(type==='object'||type==='array')family!.truncated=true;return;}
   if(Array.isArray(value)){if(value.length>100)family!.truncated=true;for(const item of value.slice(0,100))visit(item,path+'[]',depth+1);}
   else if(value&&typeof value==='object')for(const [key,item] of Object.entries(value))visit(item,path?path+'.'+key:key,depth+1);
  };
  for(const [key,value] of Object.entries(doc))visit(value,key,0);
 }}
 report(){return {vendorId:this.vendorId,stats:this.stats,failures:this.failures,deletedIds:this.deletedIds,
  families:Object.fromEntries(this.families),references:[...this.references].map(([field,values])=>({field,sampledDistinct:values.size,matches:[...values].filter(id=>this.ids.has(id)).slice(0,10).map(id=>({id:safeId(id),family:this.ids.get(id)}))}))};}
}
