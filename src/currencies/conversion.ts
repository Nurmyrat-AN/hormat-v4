import type {Pool,PoolClient} from 'pg';
import {pool} from '../database/pool.js';
import {rate,CurrencyError} from './validation.js';
/** Sole normalization rule: missing configuration has an effective rate of 1.
 * PostgreSQL NUMERIC owns multiplication/division, including its division scale.
 * Returns a decimal string; no storefront rounding or Product integration.
 */
export async function convertPrice(sourcePrice:string,vendorRate:string|null|undefined,frontendRate:string|null|undefined,database:Pool|PoolClient=pool):Promise<string>{
 if(typeof sourcePrice!=='string'||sourcePrice.length>128||! /^-?\d+(?:\.\d+)?$/.test(sourcePrice))throw new CurrencyError('CURRENCY_INVALID_PRICE');
 const vendor=rate(vendorRate??null),frontend=rate(frontendRate??null);
 const result=(await database.query<{value:string}>('SELECT ($1::numeric * COALESCE($2::numeric,1) / COALESCE($3::numeric,1))::text AS value',[sourcePrice,vendor,frontend])).rows[0].value;
 return result.includes('.')?result.replace(/0+$/,'').replace(/\.$/,''):result;
}
