import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ContentEditorState,DraftState,contentText} from '../../src/public/cpanel/js/content/editor-state.js';
import {brandPreviews} from '../fixtures/brand-previews.js';
import {permissionDefinitions} from '../../src/cpanel/permissions/definitions.js';
const fixture=()=>({id:'preview',basic:{name:'Base',is_visible:false},translations:{},gallery:[]});
test('content tabs save independently; failure retains draft and other saved state; duplicate save blocked',async()=>{
 const state=new ContentEditorState(fixture());state.set('basic',{name:'Draft',is_visible:false});state.set('translations',{ru:'Override'});state.set('gallery',[{path:'example.png'}]);
 assert.equal(await state.save('translations',async()=>{}),true);assert.equal(state.sections.translations.state,'saved');assert.equal(state.dirty('translations'),false);assert.equal(state.dirty('basic'),true);assert.equal(state.dirty('gallery'),true);
 assert.equal(await state.save('gallery',async()=>{throw Error('test');}),false);assert.equal(state.sections.gallery.state,'error');assert.equal(state.dirty('gallery'),true);assert.equal(state.sections.translations.state,'saved');
 let release!:()=>void;const waiting=state.save('basic',()=>new Promise<void>(r=>release=r));assert.equal(state.sections.basic.state,'saving');assert.equal(await state.save('basic',async()=>assert.fail()),false);state.set('basic',{name:'Ignored'});release();await waiting;assert.equal(state.sections.basic.saved.name,'Draft');assert.equal(state.dirty('gallery'),true);
});
test('dynamic active languages, empty independent base/fallback translations and representative eight fixtures',()=>{
 const languages=[{code:'tm'},{code:'ru'},{code:'en'},{code:'de'}],rows=brandPreviews(languages);assert.equal(rows.length,8);assert.equal(Object.keys(rows[0].translations).length,4);assert.equal(Object.keys(rows[1].translations).length,2);assert.deepEqual(rows[2].translations,{});assert.deepEqual(rows[2].gallery,[]);assert.equal(rows[2].basic.is_visible,false);assert.ok(rows.every(row=>row.basic.mainMedia===null&&row.gallery.length===0));
 const state=new ContentEditorState(fixture());const before=structuredClone(state.sections.translations);assert.equal(state.sections.translations.draft.de?.trim()||state.sections.basic.saved.name,'Base');assert.deepEqual(structuredClone(state.sections.translations),before);
});
test('Brands definitions are only four independent assignable booleans; no delete',()=>{
 const group=permissionDefinitions.find(group=>group.id==='brands')!;assert.deepEqual(group.permissions.map(item=>item.key),['brands.view','brands.create','brands.update','brands.visibility']);assert.ok(group.permissions.every(item=>item.assignable&&item.valueType==='boolean'));
});
test('translation partial actually renders every active registry language including a fourth language',async()=>{
 const {default:ejs}=await import('ejs');const html=await ejs.renderFile('src/views/cpanel/partials/content/translatable-field.ejs',{fieldId:'test-name',fieldLabel:'Name',lockedLabel:'Create first',languages:[{code:'tm',display_name:'Türkmen'},{code:'ru',display_name:'Русский'},{code:'en',display_name:'English'},{code:'de',display_name:'Deutsch'}],t:(key:string)=>key});assert.equal((html.match(/data-translation-input=/g)||[]).length,4);assert.match(html,/data-translation-input="de"/);assert.doesNotMatch(html,/<select/);
});

test('content text resolution uses a usable override or the separate base field, without coercion',()=>{assert.equal(contentText('Base',' Override '),'Override');for(const value of [undefined,null,'','   ',42])assert.equal(contentText('Base',value),'Base');});

test('independent fields do not share translation drafts, failures or saved baselines',async()=>{const name=new DraftState({ru:'Name'}),seo=new DraftState({ru:'SEO'});name.set({ru:'Changed'});seo.set({ru:'SEO draft'});assert.equal(await name.save(async()=>{}),true);assert.equal(seo.dirty(),true);assert.equal(await seo.save(async()=>{throw Error('test');}),false);assert.equal(name.state,'saved');assert.equal(seo.state,'error');assert.equal(seo.draft.ru,'SEO draft');});
