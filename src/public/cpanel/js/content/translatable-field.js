import {HtmlEditor,htmlText} from './html-editor.js';
import {DraftState} from './editor-state.js';

/** One field owns its overrides and expansion; other fields remain independent. */
export class TranslatableField {
 constructor(root,{onChange,onSave}){
  this.root=root;this.onChange=onChange;this.onSave=onSave;
  this.labels=Object.fromEntries([...root.querySelectorAll('[data-field-text]')].map(el=>[el.dataset.fieldText,el.textContent]));
  this.toggle=root.querySelector('[data-translation-toggle]');this.panel=root.querySelector('.field-translations');this.saveButton=root.querySelector('[data-save-field]');
  this.html=root.hasAttribute('data-html-description');if(this.html){const labels=Object.fromEntries([...root.querySelectorAll('[data-html-label]')].map(el=>[el.dataset.htmlLabel,el.textContent]));root.querySelectorAll('textarea').forEach(input=>new HtmlEditor(input,labels));}
  this.inputs=[...root.querySelectorAll('[data-translation-input]')];
  this.toggle.addEventListener('click',()=>{this.panel.hidden=!this.panel.hidden;this.render(this.options);});
  this.inputs.forEach(input=>input.addEventListener('input',()=>{this.state.set({...this.state.draft,[input.dataset.translationInput]:input.value});this.render(this.options);this.onChange();}));
  // Enter in an override must not accidentally submit the enclosing base form.
  this.panel.addEventListener('keydown',event=>{if(event.key==='Enter'&&event.target.matches('[data-translation-input]'))event.preventDefault();});
  this.saveButton.addEventListener('click',()=>{if(!this.saveButton.disabled)this.onSave();});
 }
 reset(values){this.state=new DraftState(values);this.panel.hidden=true;for(const input of this.inputs)input.value=values[input.dataset.translationInput]??'';}
 render(options){
  this.options=options;const {base,baseDirty,locked,editable,busy}=options;
  const count=this.inputs.filter(input=>this.state.draft[input.dataset.translationInput]?.trim()).length;
  const dirty=this.state.dirty(),expanded=!this.panel.hidden;
  this.toggle.disabled=locked||busy;this.toggle.setAttribute('aria-expanded',String(expanded));
  this.root.querySelector('[data-translation-count]').textContent=count+' / '+this.inputs.length;
  this.root.querySelector('[data-translation-dirty]').hidden=!dirty;
  const label=this.root.querySelector('[data-field-label]').textContent;
  const accessible=(locked?this.labels.locked:(expanded?this.labels.hide:this.labels.show))+': '+label+'; '+count+' / '+this.inputs.length+(dirty?'; '+this.labels.dirty:'');
  this.toggle.title=accessible;this.toggle.setAttribute('aria-label',accessible);
  for(const input of this.inputs){
   input.disabled=locked||busy||!editable;
   const row=input.closest('[data-translation-row]'),hasValue=Boolean(this.state.draft[input.dataset.translationInput]?.trim());
   row.classList.toggle('translation-missing',!hasValue);row.querySelector('[data-translation-mark]').textContent=hasValue?'✓':'—';
   row.querySelector('[data-translation-fallback]').textContent=hasValue?this.labels.explicit:this.labels.missing+' · '+(baseDirty?this.labels.preview:this.labels.fallback)+': '+(this.html?htmlText(base):base);
  }
  const state=this.state.state;
  this.root.querySelector('[data-translation-status]').textContent=state==='saving'?this.labels.saving:state==='error'?this.labels.error:dirty?this.labels.dirty:state==='saved'?this.labels.saved:'';
  this.saveButton.disabled=locked||busy||!editable||!dirty;this.saveButton.textContent=state==='saving'?this.labels.saving:this.labels.save;
 }
}
