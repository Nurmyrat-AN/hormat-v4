/** UI query contract, independent of DOM/data loading; reusable by a future source picker. */
export const searchFields=['all','name','source_id','barcode','property_1','property_2','property_3','property_4','property_5'];
export const filterKeys=['vendor','active','currency','measure','stock','connection','property_1','property_2','property_3','property_4','property_5'];
export function initialQuery(){return {field:'name',query:'',filters:Object.fromEntries(filterKeys.map(key=>[key,'']))};}
export function activeFilterCount(state){return filterKeys.filter(key=>String(state.filters[key]??'').trim()).length;}
export function clearFilters(state){return {...state,filters:initialQuery().filters};}
const fold=value=>String(value??'').trim().toLocaleLowerCase();
export function filterSources(rows,state){
 const query=fold(state.query),f=state.filters;
 return rows.filter(row=>{
  const identity={name:row.name,source_id:row.source_id,barcode:row.barcodes.join(' '),...Object.fromEntries([1,2,3,4,5].map(n=>['property_'+n,row['property_'+n]]))};
  const searched=state.field==='all'?Object.values(identity).join(' '):identity[state.field]??identity.name;
  if(query&&!fold(searched).includes(query))return false;
  if(f.vendor&&fold(row.vendor.name)!==fold(f.vendor))return false;
  if(f.active&&(row.is_active?'active':'inactive')!==f.active)return false;
  if(f.currency&&row.currency?.id!==f.currency)return false;
  if(f.measure&&row.measure?.id!==f.measure)return false;
  if(f.stock&&(Number(row.stock)>0?'in':'out')!==f.stock)return false;
  if(f.connection&&(row.product_count>0?'has':'none')!==f.connection)return false;
  return [1,2,3,4,5].every(n=>!fold(f['property_'+n])||fold(row['property_'+n]).includes(fold(f['property_'+n])));
 });
}
