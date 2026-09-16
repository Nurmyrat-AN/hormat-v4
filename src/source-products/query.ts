export class SourceQueryError extends Error {constructor(readonly status=400){super('SOURCE_QUERY_FAILED');}}
export interface SourceAccess {hasPermission(key:string):Promise<boolean>}
const fields=['all','name','source_id','barcode','property_1','property_2','property_3','property_4','property_5'];
const filters=['vendor','active','currency','measure','stock','connection','property_1','property_2','property_3','property_4','property_5'];
export function sourceId(value:unknown):string {if(typeof value!=='string'||! /^[1-9]\d{0,18}$/.test(value)||BigInt(value)>9223372036854775807n)throw new SourceQueryError();return value;}
export function sourceQuery(raw:Record<string,unknown>){
 const allowed=['field','query','page','sort',...filters];const out:Record<string,string>={field:'name',query:'',page:'1',sort:'name'};
 for(const [key,value]of Object.entries(raw)){if(!allowed.includes(key)||typeof value!=='string'||value.length>200||/[\x00-\x1f]/.test(value))throw new SourceQueryError();out[key]=value;}
 if(!fields.includes(out.field)||!['name','name_desc'].includes(out.sort)||! /^[1-9]\d{0,6}$/.test(out.page))throw new SourceQueryError();
 for(const key of ['vendor','currency','measure'])if(out[key])sourceId(out[key]);
 for(const [key,values]of Object.entries({active:['','active','inactive'],stock:['','in','out'],connection:['','has','none']}))if(out[key]!==undefined&&!values.includes(out[key]))throw new SourceQueryError();
 return out;
}
