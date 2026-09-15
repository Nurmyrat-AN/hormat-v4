import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readdir,readFile} from 'node:fs/promises';
import {permissionDefinitions} from '../../src/cpanel/permissions/definitions.js';
import {validatePermissionDefinitions} from '../../src/cpanel/permissions/validate-definitions.js';
import {rejectDuplicateJsonKeys} from '../../src/cpanel/permissions/json.js';

test('registry rejects duplicate keys/groups and missing or invalid module/type/assignability/localization metadata',()=>{
 validatePermissionDefinitions(permissionDefinitions);
 const invalid=(change:(groups:any[])=>void)=>{const copy=structuredClone(permissionDefinitions);change(copy);assert.throws(()=>validatePermissionDefinitions(copy));};
 invalid(groups=>groups[1].permissions.push({...groups[0].permissions[0]}));
 invalid(groups=>groups[1].id=groups[0].id);
 invalid(groups=>delete groups[0].id);
 invalid(groups=>groups[0].permissions[0].valueType='truthy');
 invalid(groups=>delete groups[0].permissions[0].valueType);
 invalid(groups=>groups[0].permissions[0].assignable='true');
 invalid(groups=>delete groups[0].permissions[0].assignable);
 invalid(groups=>groups[0].translationKey='Users');
 invalid(groups=>groups[0].permissions[0].translationKey='View users');
 invalid(groups=>groups.find(group=>group.id==='system').permissions[0].assignable=true);
 invalid(groups=>groups.pop());
 assert.deepEqual(permissionDefinitions.flatMap(group=>group.permissions.map(item=>item.key)).sort(),['users.view','users.create','users.update','users.status','users.change_password','permissions.view','permissions.update','media.view','media.upload','media.create_folder','media.rename','media.delete','superuser'].sort());
 for(const group of permissionDefinitions)for(const item of group.permissions)assert.equal(item.valueType,'boolean');
});

test('authorization middleware/service key inventory is covered by the registry, including Users operation dispatch',async()=>{
 const registered=new Set(permissionDefinitions.flatMap(group=>group.permissions.map(item=>item.key)));
 const found=new Set<string>();
 // Inventory semantic literals in server authorization consumers; UI keys and body-parser error types are separate namespaces.
 async function scan(directory:string){for(const entry of await readdir(directory,{withFileTypes:true})){
  const filename=directory+'/'+entry.name;if(entry.isDirectory()){await scan(filename);continue;}if(!filename.endsWith('.ts'))continue;
  const source=await readFile(filename,'utf8');
  for(const match of source.matchAll(/(['"])(superuser|[a-z][\w]*(?:\.[a-z][\w]*)+)\1/g)){
   const key=match[2];if(/^(cpanel|errors|entity|brand)\./.test(key)||['u.name','u.phone','u.job','a.email','charset.unsupported','encoding.unsupported'].includes(key))continue;found.add(key);assert.ok(registered.has(key),`${filename}: unregistered permission ${key}`);
  }
 }}
 for(const directory of ['src/routes/cpanel','src/controllers/cpanel','src/cpanel/auth','src/cpanel/users','src/cpanel/permissions'])await scan(directory);
 const users=await readFile('src/cpanel/users/service.ts','utf8');
 const union=users.match(/export type Operation\s*=([^;]+);/)![1];
 for(const match of union.matchAll(/'([^']+)'/g)){const key='users.'+match[1];found.add(key);assert.ok(registered.has(key),`Users operation lacks registry definition: ${key}`);}
 for(const key of registered)assert.ok(found.has(key),`Expected registered authorization key: ${key}`);
});

test('duplicate JSON keys reject nested, top-level and escaped aliases; separate objects are allowed',()=>{
 for(const source of ['{"a":true,"a":false}','{"permissions":{},"permissions":{}}','{"permissions":{"users.view":true,"users\\u002eview":false}}','{"x":[{"a":0,"a":1}]}'])assert.throws(()=>rejectDuplicateJsonKeys(source));
 for(const source of ['{"a":{"key":true},"b":{"key":false}}','{"a":"{\\\"key\\\":1}","b":true}','{"x":[{"a":0},{"a":1}]}'])rejectDuplicateJsonKeys(source);
});
