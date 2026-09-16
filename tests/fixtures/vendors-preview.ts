/** Fictional UI fixtures only. No supplier credentials, network client or persistence. */
export interface VendorPreview {
 id:string; name:string; url:string; username:string; passwordConfigured:boolean; active:boolean;
 health:'current'|'behind'|'never'|'error'; lastSequence:string|null; lastSync:string|null; lastOperation:string|null;
}
export const vendorPreviews:readonly VendorPreview[] = [
 {id:'atlas',name:'Atlas Supply',url:'https://atlas.example.invalid/catalog',username:'atlas_reader',passwordConfigured:true,active:true,health:'current',lastSequence:'829193',lastSync:'2026-09-15T05:00:03Z',lastOperation:'2026-09-15T05:00:05Z'},
 {id:'meridian',name:'Meridian Home',url:'https://meridian.example.invalid/warehouse',username:'meridian_reader',passwordConfigured:true,active:true,health:'current',lastSequence:'42018-g1AAAAFVeJzLYWBg4MhgTmEQTM4vTc5ISXJIKS1JLS7R',lastSync:'2026-09-15T05:15:00Z',lastOperation:'2026-09-15T05:15:15Z'},
 {id:'balkan',name:'Balkan Textiles',url:'https://balkan.example.invalid/supplier-inventory',username:'textiles_reader',passwordConfigured:true,active:true,health:'behind',lastSequence:'188094-g1AAAAFVeJzLYWBg4MhgTmEQTM4vTc5ISXJIKS1JLS7RzcxLScyJz0lNLS5JLUvNTS0uTkxPVUjOz0vLSU3OTMpJLQEA',lastSync:'2026-09-15T05:02:00Z',lastOperation:'2026-09-15T05:15:00Z'},
 {id:'orbit',name:'Orbit Electronics',url:'https://orbit.example.invalid/external-suppliers/electronics/regional-warehouse/catalog-source',username:'orbit_import',passwordConfigured:true,active:true,health:'error',lastSequence:'79020-vendor-checkpoint',lastSync:'2026-09-15T04:35:00Z',lastOperation:'2026-09-15T05:00:00Z'},
 {id:'nova',name:'Nova Foods',url:'https://nova.example.invalid/foods',username:'nova_reader',passwordConfigured:false,active:true,health:'never',lastSequence:null,lastSync:null,lastOperation:null},
 {id:'summit',name:'Summit Tools',url:'https://summit.example.invalid/tools',username:'summit_reader',passwordConfigured:true,active:true,health:'behind',lastSequence:'3008',lastSync:'2026-09-15T05:00:00Z',lastOperation:'2026-09-15T05:03:00Z'},
 {id:'coast',name:'Coast Living',url:'https://coast.example.invalid/home',username:'coast_reader',passwordConfigured:true,active:false,health:'current',lastSequence:'1280',lastSync:'2026-09-14T09:00:00Z',lastOperation:'2026-09-14T09:00:00Z'},
 {id:'cedar',name:'Cedar Office',url:'https://cedar.example.invalid/office',username:'cedar_reader',passwordConfigured:false,active:false,health:'never',lastSequence:null,lastSync:null,lastOperation:null},
];
/** Never present userinfo/query fragments as a connection URL or make it a clickable remote link. */
export function publicVendorUrl(value:string):string {
 try {const url=new URL(value);if(!['https:','http:'].includes(url.protocol))return '';return url.origin+url.pathname;}catch{return '';}
}
export function presentVendor(vendor:VendorPreview,language:string,t:(key:string)=>string) {
 const healthLabels={current:t('cpanel.vendors.upToDate'),behind:t('cpanel.vendors.behind'),never:t('cpanel.vendors.notSynced'),error:t('cpanel.vendors.error')};
 const locale=language==='tm'?'tk':language;
 const format=new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeStyle:'medium'});
 const seconds=vendor.lastSync&&vendor.lastOperation?Math.max(0,Math.round((Date.parse(vendor.lastOperation)-Date.parse(vendor.lastSync))/1000)):null;
 const unit=seconds!==null&&seconds>=3600?t('cpanel.vendors.hours'):seconds!==null&&seconds>=60?t('cpanel.vendors.minutes'):t('cpanel.vendors.seconds');
 const amount=seconds===null?null:seconds>=3600?Math.floor(seconds/3600):seconds>=60?Math.floor(seconds/60):seconds;
 // Explicit safe projection: future domain reads must never spread credential-bearing records into views.
 return {id:vendor.id,name:vendor.name,url:publicVendorUrl(vendor.url),username:vendor.username,passwordConfigured:vendor.passwordConfigured,active:vendor.active,
  health:vendor.health,healthLabel:healthLabels[vendor.health],lastSequence:vendor.lastSequence??'—',
  lastSync:vendor.lastSync?format.format(new Date(vendor.lastSync)):'—',lastOperation:vendor.lastOperation?format.format(new Date(vendor.lastOperation)):'—',
  lag:amount===null?'—':new Intl.NumberFormat(locale).format(amount)+' '+unit};
}
