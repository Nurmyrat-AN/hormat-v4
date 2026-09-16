export class CurrencyError extends Error {constructor(readonly code:string,readonly status=400){super(code);}}
export function object(value:unknown,allowed?:string[]):Record<string,unknown>{
 if(!value||typeof value!=='object'||Array.isArray(value)||(allowed&&Object.keys(value).some(k=>!allowed.includes(k))))throw new CurrencyError('CURRENCY_INVALID_REQUEST');
 return value as Record<string,unknown>;
}
export function text(value:unknown,empty=false){if(typeof value!=='string'||[...value.trim()].length>200||/[\x00-\x1f\x7f]/.test(value)||(!empty&&!value.trim()))throw new CurrencyError('CURRENCY_INVALID_REQUEST');return value.trim();}
export function id(value:string){if(!/^[1-9]\d{0,18}$/.test(value)||BigInt(value)>9223372036854775807n)throw new CurrencyError('CURRENCY_NOT_FOUND',404);return value;}
/** Decimal transport stays textual; NULL is administratively unconfigured. */
export function rate(value:unknown):string|null{
 if(value===null)return null;
 if(typeof value!=='string'||value.length>128||!/^\d+(?:\.\d+)?$/.test(value)||!/[1-9]/.test(value))throw new CurrencyError('CURRENCY_INVALID_RATE');
 const [integer,fraction='']=value.split('.'),tail=fraction.replace(/0+$/,'');return BigInt(integer).toString()+(tail?'.'+tail:'');
}
export function sortOrder(value:unknown){if(typeof value!=='number'||!Number.isInteger(value)||value < -2147483648||value>2147483647)throw new CurrencyError('CURRENCY_INVALID_REQUEST');return value;}
export function boolean(value:unknown){if(typeof value!=='boolean')throw new CurrencyError('CURRENCY_INVALID_REQUEST');return value;}
export function filters(input:unknown,frontend:boolean){const f=object(input,frontend?['query','visibility','page']:['query','page']),query=f.query??'',page=f.page??'1',visibility=f.visibility??'all';if(typeof query!=='string'||query.length>200||typeof page!=='string'||!/^\d{1,7}$/.test(page)||Number(page)<1||!['all','visible','hidden'].includes(visibility as string))throw new CurrencyError('CURRENCY_INVALID_REQUEST');return {query:query.trim(),page:Number(page),visible:visibility==='all'?null:visibility==='visible'};}
