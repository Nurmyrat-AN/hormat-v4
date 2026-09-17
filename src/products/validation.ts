import {sanitizeDescription} from '../content/html.js';
export class ProductError extends Error {constructor(readonly code='PRODUCT_INVALID_REQUEST',readonly status=400){super(code);}}
export interface ProductActor {id:string;sessionHash:string}
export const translationFields=['name','seo_title','seo_description','short_description','description_html'] as const;
export type TranslationField=typeof translationFields[number];
export const actions=['addAmount','addPercent','fixed','removeAmount','removePercent'];
export function object(value:unknown,allowed?:readonly string[]):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value)||allowed&&Object.keys(value).some(k=>!allowed.includes(k)))throw new ProductError();return value as Record<string,unknown>;}
export function id(value:unknown):string{if(typeof value!=='string'||! /^[1-9]\d{0,18}$/.test(value)||BigInt(value)>9223372036854775807n)throw new ProductError();return value;}
export function text(value:unknown,field:TranslationField,required=false):string|null{const max=field==='description_html'?100000:field==='name'||field==='seo_title'?200:2000;if(typeof value!=='string'||[...value].length>max||/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value)||required&&!value.trim())throw new ProductError();const result=field==='description_html'?sanitizeDescription(value):value.trim();return result||null;}
export function slug(value:unknown){if(value===null||value==='')return null;if(typeof value!=='string')throw new ProductError();const s=value.trim().toLowerCase().replace(/\s+/g,'-');if(s.length>120||! /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s))throw new ProductError();return s;}
export function boolean(value:unknown){if(typeof value!=='boolean')throw new ProductError();return value;}
export function priceRule(input:unknown){const f=object(input,['price_action','price_value']);if(f.price_action===null&&f.price_value===null)return {action:null,value:null};if(typeof f.price_action!=='string'||!actions.includes(f.price_action)||typeof f.price_value!=='string'||f.price_value.length>128||! /^\d+(?:\.\d+)?$/.test(f.price_value))throw new ProductError();return {action:f.price_action,value:f.price_value};}
