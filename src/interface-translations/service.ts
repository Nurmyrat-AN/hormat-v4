import {TranslationRepository,type TranslationActor} from './repository.js';
import {TranslationError,object,usable,prefix} from './validation.js';
export class TranslationService {
 constructor(readonly repository=new TranslationRepository(),readonly refresh:()=>Promise<void>=async()=>{}){}
 async list(actor:TranslationActor,input:unknown){return this.repository.authorized(actor,['interface_translations.view'],async client=>{
  const f=object(input,['query','prefix','completion','language','page']);
  const query=f.query??'',group=f.prefix??'',completion=f.completion??'all',language=f.language??'',page=Number(f.page??1);
  if(typeof query!=='string'||query.length>200||typeof group!=='string'||typeof language!=='string'||!['all','missing','complete'].includes(completion as string)||!Number.isSafeInteger(page)||page<1)throw new TranslationError('TRANSLATION_INVALID');
  const {languages,rows}=await this.repository.catalog(client);
  if(language&&!languages.some(l=>l.code===language))throw new TranslationError('TRANSLATION_INVALID');
  const entries=rows.map(row=>({...row,missing:languages.filter(l=>!usable(row.values[l.code])).map(l=>l.code)}));
  const groups=[...new Set(rows.map(row=>prefix(row.key)))].sort();
  const matched=entries.filter(row=>(!group||prefix(row.key)===group)&&(!query||[row.key,...Object.values(row.values)].some(value=>value?.toLocaleLowerCase().includes(query.toLocaleLowerCase())))&&(completion==='all'||(completion==='complete'?row.missing.length===0:language?row.missing.includes(language):row.missing.length>0)));
  return {languages,groups,summary:{total:rows.length,complete:entries.filter(row=>!row.missing.length).length,missing:entries.filter(row=>row.missing.length).length},total:matched.length,page,rows:matched.slice((page-1)*50,page*50).map(row=>({...row,values:Object.fromEntries(languages.map(l=>[l.code,row.values[l.code]??null]))}))};
 });}
 async detail(actor:TranslationActor,key:string){return this.repository.authorized(actor,['interface_translations.view'],async client=>{
  const {languages,rows}=await this.repository.catalog(client),row=rows.find(row=>row.key===key);
  if(!row)throw new TranslationError('TRANSLATION_NOT_FOUND',404);
  return {key,languages,values:Object.fromEntries(languages.map(l=>[l.code,row.values[l.code]??null]))};
 });}
 async save(actor:TranslationActor,key:string,input:unknown){
  try{await this.repository.authorized(actor,['interface_translations.update'],async client=>{
   await this.repository.lock(client);
   const f=object(input,['values']),values=object(f.values);
   const {languages,rows}=await this.repository.catalog(client);
   if(!rows.some(row=>row.key===key))throw new TranslationError('TRANSLATION_NOT_FOUND',404);
   if(!Object.keys(values).length)throw new TranslationError('TRANSLATION_INVALID');
   const normalized:Record<string,string|null>={};
   for(const [language,value]of Object.entries(values)){
    if(!languages.some(l=>l.code===language)||value!==null&&(typeof value!=='string'||value.length>20000||value.includes('\0')))throw new TranslationError('TRANSLATION_INVALID');
    normalized[language]=usable(value)?value:null;
   }
   await this.repository.save(client,key,normalized);
  });}catch(error){if(error instanceof TranslationError)throw error;throw new TranslationError('TRANSLATION_SAVE_FAILED',500);}
  try{await this.refresh();return {cacheRefreshed:true};}catch{return {cacheRefreshed:false};}
 }
}
