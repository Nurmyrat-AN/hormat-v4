export class LanguageError extends Error {constructor(readonly code:string,readonly status=400){super(code);}}
export function object(value:unknown,allowed:string[]){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!allowed.includes(k)))throw new LanguageError('LANGUAGE_INVALID_REQUEST');return value as Record<string,unknown>;}
export function code(value:unknown){if(typeof value!=='string'||value.length>35||!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(value))throw new LanguageError('LANGUAGE_INVALID_REQUEST');return value;}
export function name(value:unknown){if(typeof value!=='string'||!value.trim()||[...value.trim()].length>200||/[\x00-\x1f\x7f]/.test(value))throw new LanguageError('LANGUAGE_INVALID_REQUEST');return value.trim();}
export function order(value:unknown){if(typeof value!=='number'||!Number.isInteger(value)||value< -2147483648||value>2147483647)throw new LanguageError('LANGUAGE_INVALID_REQUEST');return value;}
export function boolean(value:unknown){if(typeof value!=='boolean')throw new LanguageError('LANGUAGE_INVALID_REQUEST');return value;}
