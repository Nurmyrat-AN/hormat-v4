import {createDecipheriv} from 'node:crypto';
// Authoritative user-supplied compatibility material. Never log the decrypted dictionary.
const compatibilityBlob = 'XvfWxBjBFnPH8kulhXbyrsljrHOGdOV4wNO+frok+Vxkq05aHCm6p5UcupfhF2Y43dgi2AX/W+VoRjLKJ2sIgZ2U9UMT3QTLVFT3/VWakIZko7hgn55grt5D2eDE3MAGEdT/xhj9f7lIOucLWxU6WHDFBwjwCu+gWAE0r88G6vovzSVRI3XS/SDghivTd5yWgs/xJ0gAFVPSLOmNlMssrxFxIcYjMki7dQ0BwjvpPOq6uY2ia/iXe+yf+DDK/yix7uLVOrBObV2hfDhB1KuiBFiYcGLoGH125bm+dKYEqGVcPDQhAjuWzp1r51XJx9UIpjRR/aWfJtFnSqxP5e9uX3tkzJV7ePubc5vIng8qTMIpzGw8iXPQLwnKgyc2rGToKPWdg+VsUs6SsyMKw2iUROQUFiFuzTiUhyG03vHppPho18ktH4UV7fp6MeyCtlJctQdu+EWOkG72y1BFlQx2pXGJq09Gbum39RVw3Cx06IJRMpzqKw+8r7HsU4jXfmF1KrJGENZfNpki9kThbfyM+iI8sgtDd2Rd0hnoqGVN2v2ukRwwwkvkj2vbj7QbU+uWT8QHMk4juLb6fn1ljegjOyEvg3MoLadmlccYWPcQyJRe37Hj14x0VkJClePmvsF0JvimVAkehm6GEg5GjCHy74IbzNi1ZNjkSi27cfWh9GrelWv+IWDJalHNZPLOL68aPJGz1vf4morM0D2A0edZA6I5HV9Y2mchvCKAw29efu4epn0xDVFewuNrVA0MpsF9k6bzp/iXE9Au5pYCfGQWcQ==';
export function normalizeAesKey(key:string){return key.length<32?key.padEnd(32,'1'):key.slice(0,32);}
export function decryptAES(key:string,base64Cipher:string){
 const decipher=createDecipheriv('aes-256-cbc',Buffer.from(normalizeAesKey(key),'utf8'),Buffer.alloc(16,0));
 return decipher.update(base64Cipher,'base64','utf8')+decipher.final('utf8');
}
let dictionary:Record<string,unknown>|undefined;
export function initializeKeys(blob=process.env.LEGACY_KEY_DICTIONARY_BLOB||compatibilityBlob){
 const parsed=JSON.parse(decryptAES('LEGIT',blob)) as Record<string,unknown>;
 if(typeof parsed._key2020!=='string'||!parsed._key2020)throw new Error('Legacy key dictionary has no valid _key2020');
 dictionary=parsed;return true;
}
export function verKeyForDto(id:string){
 if(!dictionary)throw new Error('Decryption keys are not initialized');
 let suffix=id;const index=suffix.indexOf('-');if(index>0)suffix=suffix.substring(index);
 return (dictionary._key2020 as string).substring(16)+suffix;
}
export type DecodeResult={decoded:Record<string,unknown>|null;status:'not_required'|'success'|'failed'|'deleted';error:string|null;encrypted:boolean};
export function decodeDocument(raw:Record<string,unknown>):DecodeResult{
 if(raw._deleted===true)return {decoded:null,status:'deleted',error:null,encrypted:false};
 if(!Object.hasOwn(raw,'load'))return {decoded:structuredClone(raw),status:'not_required',error:null,encrypted:false};
 if(typeof raw._id!=='string'||typeof raw.load!=='string')return {decoded:null,status:'failed',error:'Encrypted document requires string _id and load',encrypted:true};
 try{
  const payload=JSON.parse(decryptAES(verKeyForDto(raw._id),raw.load));
  if(!payload||typeof payload!=='object'||Array.isArray(payload))throw new Error('Decrypted JSON is not an object');
  const decoded={...raw,...payload} as Record<string,unknown>;delete decoded.load;
  return {decoded,status:'success',error:null,encrypted:true};
 }catch(error){return {decoded:null,status:'failed',error:error instanceof Error?error.message:String(error),encrypted:true};}
}
/** Only this safe boundary may be called from server startup. Raw legacy errors are not logged. */
export function initializeLegacyDecoder(){try{initializeKeys();}catch{throw new Error('Legacy decoder initialization failed. Check compatibility material.');}}
