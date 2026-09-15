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
  assert.equal(items.filter(i => i.kind === 'page' && i.status === 'disabled').length, 28);
  assert.deepEqual(items.filter(i => i.kind === 'page' && i.status === 'enabled').map(i => i.id), ['foundation','users','permissions']);
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
