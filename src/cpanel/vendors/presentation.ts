import type {VendorRow} from '../../vendors/repository.js';
export function presentVendor(vendor:VendorRow,language:string,t:(key:string)=>string){
 const locale=language==='tm'?'tk':language,format=new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeStyle:'medium'});
 const seconds=vendor.date_last_sync&&vendor.date_last_operation?Math.max(0,Math.round((new Date(vendor.date_last_operation).getTime()-new Date(vendor.date_last_sync).getTime())/1000)):null;
 const unit=seconds!==null&&seconds>=3600?t('cpanel.vendors.hours'):seconds!==null&&seconds>=60?t('cpanel.vendors.minutes'):t('cpanel.vendors.seconds');
 const amount=seconds===null?null:seconds>=3600?Math.floor(seconds/3600):seconds>=60?Math.floor(seconds/60):seconds;
 // No health thresholds until the synchronization service is designed.
 return {id:vendor.id,name:vendor.name,url:vendor.url,username:vendor.username,passwordConfigured:vendor.passwordConfigured,active:vendor.is_active,
  health:'never',healthLabel:vendor.date_last_sync?t('cpanel.vendors.healthPending'):t('cpanel.vendors.notSynced'),lastSequence:vendor.last_sequence??'—',
  lastSync:vendor.date_last_sync?format.format(new Date(vendor.date_last_sync)):'—',lastOperation:vendor.date_last_operation?format.format(new Date(vendor.date_last_operation)):'—',
  lag:amount===null?'—':new Intl.NumberFormat(locale).format(amount)+' '+unit};
}
