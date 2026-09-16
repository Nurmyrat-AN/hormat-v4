import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ancestors,allowedParent,totalProducts} from '../../src/public/cpanel/js/content/category-tree.js';
test('arbitrary-depth Category paths, parent exclusion and mock product totals',()=>{
 const rows=Array.from({length:40},(_,i)=>({id:String(i),basic:{parentId:i?String(i-1):null},directProducts:1}));
 assert.equal(ancestors(rows,'39').length,40);assert.equal(totalProducts(rows,'0'),40);
 assert.equal(allowedParent(rows,'10','39'),false);assert.equal(allowedParent(rows,'10','10'),false);assert.equal(allowedParent(rows,'10','9'),true);assert.equal(allowedParent(rows,'10',null),true);assert.equal(allowedParent(rows,null,'39'),true);
});
