import {test} from 'node:test';
import assert from 'node:assert/strict';
import {vendorPreviews,publicVendorUrl,presentVendor} from '../fixtures/vendors-preview.js';
import {permissionDefinitions} from '../../src/cpanel/permissions/definitions.js';
test('Vendor preview projects safe fields, strips URL credentials and treats sequence as opaque',()=>{
 const url='https://embedded-user:secret-value@supplier.example.invalid/database?token=private#fragment';
 assert.equal(publicVendorUrl(url),'https://supplier.example.invalid/database');
 for(const value of ['javascript:alert(1)','file:///tmp/private','invalid'])assert.equal(publicVendorUrl(value),'');
 const row=presentVendor({...vendorPreviews[0],url,password:'never-return',connectionSecret:'never-return'} as typeof vendorPreviews[number],'en',key=>key);
 assert.ok(!JSON.stringify(row).includes('secret-value'));assert.ok(!JSON.stringify(row).includes('never-return'));assert.ok(!JSON.stringify(row).includes('embedded-user'));
 assert.equal(presentVendor({...vendorPreviews[0],lastSync:'2026-09-15T05:00:00Z',lastOperation:'2026-09-15T06:00:00Z'},'en',key=>key).lag,'1 cpanel.vendors.hours');
 assert.equal(Object.hasOwn(row,'password'),false);assert.equal(row.passwordConfigured,true);assert.equal(row.lag,'2 cpanel.vendors.seconds');
 const opaque=vendorPreviews.find(v=>v.id==='balkan')!;assert.equal(presentVendor(opaque,'en',key=>key).lastSequence,opaque.lastSequence);
 assert.equal(presentVendor(opaque,'en',key=>key).lag,'13 cpanel.vendors.minutes');
 assert.equal(presentVendor(vendorPreviews.find(v=>v.id==='nova')!,'en',key=>key).lag,'—');
 assert.deepEqual(new Set(vendorPreviews.map(v=>v.health)),new Set(['current','behind','never','error']));
 assert.equal(vendorPreviews.filter(v=>v.active).length,6);assert.equal(vendorPreviews.length,8);
 for(const fixture of vendorPreviews){assert.equal(Object.hasOwn(fixture,'password'),false);assert.ok(new URL(fixture.url).hostname.endsWith('.example.invalid'));}
});
test('Vendor definitions are five unique assignable booleans in the Vendors group; Source Products stays unregistered',()=>{
 const group=permissionDefinitions.find(group=>group.id==='vendors')!;
 assert.deepEqual(group.permissions.map(p=>p.key),['vendors.view','vendors.create','vendors.update','vendors.reset_sync','vendors.status']);
 for(const permission of group.permissions){assert.equal(permission.assignable,true);assert.equal(permission.valueType,'boolean');assert.match(permission.translationKey,/^cpanel\.vendors\./);}
 assert.ok(!permissionDefinitions.some(group=>/source.?products/i.test(group.id)));
});
