export class TranslationError extends Error {
 constructor(readonly code:string,readonly status=400){super(code);}
}
export function object(input:unknown,allowed?:string[]):Record<string,unknown>{
 if(!input||typeof input!=='object'||Array.isArray(input))throw new TranslationError('TRANSLATION_INVALID');
 const value=input as Record<string,unknown>;
 if(allowed&&Object.keys(value).some(key=>!allowed.includes(key)))throw new TranslationError('TRANSLATION_INVALID');
 return value;
}
export const usable=(value:unknown):value is string=>typeof value==='string'&&Boolean(value.trim());
export const prefix=(key:string)=>key.split('.').slice(0,key.startsWith('cpanel.')?2:1).join('.');
