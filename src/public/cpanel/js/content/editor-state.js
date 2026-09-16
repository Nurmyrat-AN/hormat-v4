/** Independent draft/baseline for a section or one field's translations. */
export class DraftState {
 constructor(value){this.saved=structuredClone(value);this.draft=structuredClone(value);this.state='clean';}
 dirty(){return JSON.stringify(this.saved)!==JSON.stringify(this.draft);}
 set(value){if(this.state==='saving')return;this.draft=structuredClone(value);this.state=this.dirty()?'dirty':'clean';}
 async save(persist){if(this.state==='saving')return false;this.state='saving';const value=structuredClone(this.draft);try{await persist(value);this.saved=value;this.state='saved';return true;}catch{this.state='error';return false;}}
}
export class ContentEditorState {
 constructor(entity){this.id=entity.id??null;this.sections=Object.fromEntries(Object.entries(entity).filter(([key])=>key!=='id').map(([key,value])=>[key,new DraftState(value)]));}
 dirty(key){return this.sections[key].dirty();}
 anyDirty(){return Object.values(this.sections).some(section=>section.dirty());}
 set(key,value){this.sections[key].set(value);}
 save(key,persist){return this.sections[key].save(persist);}
}
/** Content fallback is independent of interface localization. */
export function contentText(base,override){return typeof override==='string'&&override.trim()?override.trim():base;}
