import {AsyncAutocomplete} from './async-autocomplete.js';

/** A source lookup only. It never creates a Product, even a temporary one. */
export class ProductSourceSelector {
 constructor(root,onSelect){
  this.root=root;this.modal=bootstrap.Modal.getOrCreateInstance(root);this.proceed=root.querySelector('[data-create-proceed]');
  const get=async(kind,params,signal)=>{const response=await fetch('/cpanel/api/product-create/'+kind+'?'+new URLSearchParams(params),{signal});if(!response.ok||response.redirected)throw Error();const data=await response.json();if(!data.success)throw Error();return data;};
  this.vendor=new AsyncAutocomplete(root.querySelector('#product-create-vendor-control'),{
   fetchPage:({query,page,signal})=>get('vendors',{query,page},signal),
   hydrate:async(value,signal)=>(await get('vendors',{selected:value},signal)).options[0]??null,
   onChange:()=>{this.sources.setValue('');this.update();}
  });
  this.sources=new AsyncAutocomplete(root.querySelector('#product-create-source-control'),{
   disabled:true,
   fetchPage:async({query,page,signal})=>{const data=await get('sources',{vendor:this.vendor.value,query,page},signal);return {...data,options:data.options.map(option=>({...option,secondaryText:option.metadata.source_id}))};},
   hydrate:async(value,signal)=>{const data=await get('sources',{vendor:this.vendor.value,selected:value},signal);return data.options[0]?{...data.options[0],secondaryText:data.options[0].metadata.source_id}:null;},
   onChange:()=>this.update()
  });
  this.vendor.input.setAttribute('aria-required','true');this.sources.input.setAttribute('aria-required','true');
  this.vendorFirst=this.sources.input.placeholder;
  this.proceed.addEventListener('click',()=>{
   if(!this.vendor.selected||!this.sources.selected||this.pending)return;
   this.pending=this.sources.selected.metadata;this.proceed.disabled=true;this.modal.hide();
  });
  root.addEventListener('shown.bs.modal',()=>this.vendor.input.focus());
  root.addEventListener('hidden.bs.modal',()=>{
   this.vendor.close();this.sources.close();const source=this.pending;this.pending=null;
   if(source)onSelect(source);else document.getElementById('product-add')?.focus();
  });
 }
 update(){
  const disabled=!this.vendor.selected;this.sources.disabled=disabled;this.sources.input.disabled=disabled;
  this.sources.root.dataset.placeholder=disabled?this.vendorFirst:this.root.querySelector('[data-source-placeholder]').textContent;
  this.sources.input.placeholder=this.sources.root.dataset.placeholder;this.sources.updateClear();
  this.proceed.disabled=disabled||!this.sources.selected;
 }
 open(){this.pending=null;this.vendor.setValue('');this.sources.setValue('');this.update();this.modal.show();}
}
