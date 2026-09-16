import type {PoolClient} from 'pg';
import {LanguagesRepository} from '../languages/repository.js';
export const defaultCurrencyKey='marketplace.default_frontend_currency_id';
export class SettingsError extends Error {constructor(readonly code:string,readonly status=400){super(code);}}
export class SettingsRepository extends LanguagesRepository {
 async getSetting(client:PoolClient,key:string){return (await client.query('SELECT key,value,type FROM settings WHERE key=$1',[key])).rows[0] as {key:string;value:unknown;type:string}|undefined;}
 async setSetting(client:PoolClient,key:string,value:unknown,type:string,actor:string){await client.query('INSERT INTO settings(key,value,type,updated_by) VALUES($1,$2::jsonb,$3,$4) ON CONFLICT(key) DO UPDATE SET value=excluded.value,type=excluded.type,updated_by=excluded.updated_by',[key,JSON.stringify(value),type,actor]);}
 async options(client:PoolClient,language=''){
  const languages=(await this.list(client,'',true)).map(({code,display_name,is_default})=>({code,name:display_name,is_default}));
  const currencies=(await client.query('SELECT id::text,name,code FROM frontend_currencies WHERE is_visible ORDER BY sort_order,id')).rows;
  const payment=(await client.query('SELECT id::text,name,is_default FROM payment_types WHERE is_visible ORDER BY sort_order,id')).rows;
  const delivery=(await client.query('SELECT id::text,name,is_default FROM delivery_types WHERE is_visible ORDER BY sort_order,id')).rows;
  const orderStatus=(await client.query("SELECT s.id::text,COALESCE(NULLIF(btrim(t.name),''),s.name) AS name,s.is_default FROM order_statuses s LEFT JOIN order_status_translations t ON t.order_status_id=s.id AND t.language_code=$1 WHERE s.is_visible ORDER BY s.sort_order,s.id",[language])).rows;
  return {languages,currencies,payment,delivery,orderStatus};
 }
}
/** Shared by Settings selection and Currency visibility writes, before currency row locks. */
export async function lockCurrencyDefault(client:PoolClient){await client.query('SELECT pg_advisory_xact_lock(4840,5)');}
export async function validateDefaultCurrency(client:PoolClient,id:string){
 await lockCurrencyDefault(client);
 if(!/^[1-9]\d{0,18}$/.test(id)||BigInt(id)>9223372036854775807n)throw new SettingsError('SETTINGS_INVALID_CURRENCY');
 const row=(await client.query('SELECT is_visible FROM frontend_currencies WHERE id=$1 FOR SHARE',[id])).rows[0];
 if(!row?.is_visible)throw new SettingsError('SETTINGS_INVALID_CURRENCY');
}
export async function isDefaultCurrency(client:PoolClient,id:string){return (await client.query('SELECT 1 FROM settings WHERE key=$1 AND value=to_jsonb($2::text)',[defaultCurrencyKey,id])).rowCount!==0;}
