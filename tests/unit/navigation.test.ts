import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { navigationRoadmap, prepareNavigation, type NavigationItem } from '../../src/cpanel/shell/navigation.js';
import { collectUiKeys } from '../../scripts/localization-integrity.mjs';

test('roadmap is complete, unique, key-only and disabled independently of permissions', async () => {
  assert.deepEqual(navigationRoadmap.map(g => g.id), ['overview','catalog','vendors','sales','communication','content','marketplace','searchAnalytics','system']);
  const items: NavigationItem[] = [];
  const visit = (item: NavigationItem) => { items.push(item); if (item.kind === 'submenu') item.children.forEach(visit); };
  navigationRoadmap.forEach(g => g.items.forEach(visit));
  assert.equal(items.filter(i => i.kind === 'page' && i.status === 'disabled').length, 16);
  assert.deepEqual(items.filter(i => i.kind === 'page' && i.status === 'enabled').map(i => i.id), ['foundation','categories','brands','media','discounts','vendors','sourceProducts','frontendCurrencies','vendorCurrencyRates','deliveryTypes','paymentTypes','orderStatuses','users','permissions','languages','interfaceTranslations','settings']);
  assert.equal(new Set(items.map(i => i.id)).size, items.length);
  const keys = await collectUiKeys();
  const svg = await readFile('src/public/cpanel/images/shell-icons.svg', 'utf8');
  for (const item of items) {
    assert.ok(keys.includes(item.translationKey));
    assert.ok(svg.includes(`id="${item.icon}"`));
    assert.ok(!('label' in item));
  }
  for (const group of navigationRoadmap) assert.ok(keys.includes(group.translationKey));
});

test('preparation suppresses disabled URLs and propagates active descendants without per-page JS', () => {
  const prepared = prepareNavigation([{ id: 'test', translationKey: 'test.group', items: [
    { id: 'parent', translationKey: 'test.parent', icon: 'grid', kind: 'submenu', children: [
      { id: 'child', translationKey: 'test.child', icon: 'grid', kind: 'page', status: 'enabled', href: '/test' },
      { id: 'disabled', translationKey: 'test.disabled', icon: 'grid', kind: 'page', status: 'disabled', href: '/test' },
    ] },
  ] }], key => `translated ${key}`, '/test');
  assert.equal(prepared[0].items[0].active, true);
  assert.equal(prepared[0].items[0].children![0].active, true);
  assert.equal(prepared[0].items[0].children![1].active, false);
  assert.equal(prepared[0].items[0].children![1].href, undefined);
  assert.equal(prepared[0].items[0].label, 'translated test.parent');
});

test('enabled access pages use independent permissions and empty Access submenu is omitted',()=>{
 const access=(allowed:(key:string)=>boolean)=>prepareNavigation(navigationRoadmap,key=>key,'/cpanel/permissions',allowed).find(group=>group.id==='system')!.items.find(item=>item.id==='access');
 assert.equal(access(()=>false),undefined);
 assert.deepEqual(access(key=>key==='users.view')!.children!.map(item=>item.id),['users']);
 const permitted=access(key=>key==='permissions.view')!;
 assert.deepEqual(permitted.children!.map(item=>item.id),['permissions']);assert.equal(permitted.active,true);assert.equal(permitted.children![0].href,'/cpanel/permissions');
});

test('Media availability is enabled; effective view permission controls its link and active state',()=>{
 const media=(allowed:boolean)=>prepareNavigation(navigationRoadmap,key=>key,'/cpanel/media',key=>allowed&&key==='media.view').find(group=>group.id==='catalog')!.items.find(item=>item.id==='media');
 assert.equal(media(false),undefined);assert.equal(media(true)!.href,'/cpanel/media');assert.equal(media(true)!.active,true);
});

test('Vendors availability and effective view authorization remain independent',()=>{
 const item=(allowed:boolean)=>prepareNavigation(navigationRoadmap,key=>key,'/cpanel/vendors',key=>allowed&&key==='vendors.view').find(group=>group.id==='vendors')!.items.find(item=>item.id==='vendors');
 assert.equal(item(false),undefined);assert.equal(item(true)!.status,'enabled');assert.equal(item(true)!.href,'/cpanel/vendors');assert.equal(item(true)!.active,true);
});

 test('Brands availability is enabled and independent of effective view permission',()=>{
 const item=(allowed:boolean)=>prepareNavigation(navigationRoadmap,key=>key,'/cpanel/brands',key=>allowed&&key==='brands.view').find(group=>group.id==='catalog')!.items.find(item=>item.id==='brands');
 assert.equal(item(false),undefined);assert.equal(item(true)!.status,'enabled');assert.equal(item(true)!.href,'/cpanel/brands');assert.equal(item(true)!.active,true);
 });

test('Categories enabled navigation requires its own view permission; Source Products is independently activated',()=>{
 const prepared=(allowed:boolean)=>prepareNavigation(navigationRoadmap,key=>key,'/cpanel/categories',key=>allowed&&key==='categories.view');
 const item=(allowed:boolean)=>prepared(allowed).find(group=>group.id==='catalog')!.items.find(item=>item.id==='categories');
 assert.equal(item(false),undefined);assert.equal(item(true)!.href,'/cpanel/categories');assert.equal(item(true)!.active,true);
 const source=navigationRoadmap.find(group=>group.id==='vendors')!.items.find(item=>item.id==='sourceProducts');assert.equal(source?.kind==='page'&&source.status,'enabled');
});

test('Discounts availability is enabled independently of view permission',()=>{
 const item=(allowed:boolean)=>prepareNavigation(navigationRoadmap,key=>key,'/cpanel/discounts',key=>allowed&&key==='discounts.view').find(group=>group.id==='catalog')!.items.find(item=>item.id==='discounts');
 assert.equal(item(false),undefined);assert.equal(item(true)!.status,'enabled');assert.equal(item(true)!.href,'/cpanel/discounts');assert.equal(item(true)!.active,true);
});


test('Languages UI review link stays independent of effective view permission',()=>{
 const item=(allowed:boolean)=>prepareNavigation(navigationRoadmap,key=>key,'/cpanel/languages',key=>allowed&&key==='languages.view').find(group=>group.id==='system')!.items.find(item=>item.id==='localization')?.children?.find(item=>item.id==='languages');
 assert.equal(item(false),undefined);assert.equal(item(true)!.status,'enabled');assert.equal(item(true)!.href,'/cpanel/languages');assert.equal(item(true)!.active,true);
});


test('Interface Translations enabled navigation requires its independent view permission',()=>{
 const item=(allowed:boolean)=>prepareNavigation(navigationRoadmap,key=>key,'/cpanel/interface-translations',key=>allowed&&key==='interface_translations.view').find(group=>group.id==='system')?.items.find(item=>item.id==='localization')?.children?.find(item=>item.id==='interfaceTranslations');
 assert.equal(item(false),undefined);assert.equal(item(true)!.status,'enabled');assert.equal(item(true)!.href,'/cpanel/interface-translations');assert.equal(item(true)!.active,true);
});

 test('Payment and Delivery enabled links require independent view permissions',()=>{for(const [id,permission,href] of [['paymentTypes','payment_types.view','/cpanel/payment-types'],['deliveryTypes','delivery_types.view','/cpanel/delivery-types']]){const get=(allowed:boolean)=>prepareNavigation(navigationRoadmap,k=>k,href,k=>allowed&&k===permission).find(g=>g.id==='marketplace')?.items.find(i=>i.id===id);assert.equal(get(false),undefined);assert.equal(get(true)?.href,href);assert.equal(get(true)?.active,true);}});

test('Settings navigation requires settings.view independently',()=>{const item=(allowed:boolean)=>prepareNavigation(navigationRoadmap,k=>k,'/cpanel/settings',k=>allowed&&k==='settings.view').find(g=>g.id==='system')?.items.find(i=>i.id==='settings');assert.equal(item(false),undefined);assert.equal(item(true)?.href,'/cpanel/settings');assert.equal(item(true)?.active,true);});

test('Order Statuses navigation requires its own view permission',()=>{const get=(allowed:boolean)=>prepareNavigation(navigationRoadmap,k=>k,'/cpanel/order-statuses',k=>allowed&&k==='order_statuses.view').find(g=>g.id==='marketplace')?.items.find(i=>i.id==='orderStatuses');assert.equal(get(false),undefined);assert.equal(get(true)?.href,'/cpanel/order-statuses');assert.equal(get(true)?.active,true);});

test('Source Products enabled navigation requires its own view permission',()=>{const get=(allowed:boolean)=>prepareNavigation(navigationRoadmap,k=>k,'/cpanel/source-products',k=>allowed&&k==='source_products.view').find(g=>g.id==='vendors')?.items.find(i=>i.id==='sourceProducts');assert.equal(get(false),undefined);assert.equal(get(true)?.href,'/cpanel/source-products');assert.equal(get(true)?.active,true);});
