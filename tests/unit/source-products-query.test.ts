import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialQuery,filterSources,activeFilterCount,clearFilters} from '../../src/public/cpanel/js/source-products/query.js';
import {sourceFixtures} from '../fixtures/source-ui.js';
const {rows}=sourceFixtures({vendor:'Vendor',warehouse:'Warehouse'});
test('source identity search covers names, source IDs, every barcode/property and excludes internal/numeric fields',()=>{
 const query=initialQuery();assert.equal(query.field,'name');query.query='iphone';assert.equal(filterSources(rows,query).length,9);
 query.field='source_id';query.query='src-0013';assert.deepEqual(filterSources(rows,query).map(row=>row.source_id),['SRC-0013']);
 query.field='barcode';query.query='alt-13';assert.equal(filterSources(rows,query)[0].source_id,'SRC-0013');
 for(const [field,value]of [['property_1','Series-A'],['property_2','256'],['property_3','2025'],['property_4','Type-A'],['property_5','V2']]){query.field=field;query.query=value;assert.ok(filterSources(rows,query).length>0);assert.ok(filterSources(rows,query).every(row=>row[field]===value));}
 query.field='all';for(const value of ['iPhone','SRC-0013','ALT-13','Series-A','256','2025','Type-A','V2']){query.query=value;assert.ok(filterSources(rows,query).length>0);}
 for(const value of ['source-preview-13','Vendor A','currency-0']){query.query=value;assert.equal(filterSources(rows,query).length,0);}
});
test('source filters combine; no-product/negative stock semantics, filter counts and clearing preserve search',()=>{
 let query=initialQuery();const counts={vendor:['Vendor A',12],active:['inactive',8],currency:['currency-0',12],measure:['measure-1',12],stock:['out',18],connection:['none',12]};
 for(const [key,[value,count]]of Object.entries(counts)){query=initialQuery();query.filters[key]=value;assert.equal(filterSources(rows,query).length,count);assert.equal(activeFilterCount(query),1);}
 query=initialQuery();query.query='iPhone';Object.assign(query.filters,{vendor:'Vendor A',active:'active',currency:'currency-0',measure:'measure-0',stock:'in',connection:'none',property_1:'Series-A'});
 assert.deepEqual(filterSources(rows,query).map(row=>row.source_id),['SRC-0013','SRC-0025']);assert.equal(activeFilterCount(query),7);
 query=clearFilters(query);assert.equal(activeFilterCount(query),0);assert.equal(query.query,'iPhone');assert.equal(query.field,'name');assert.equal(filterSources(rows,query).length,9);
 query.filters.property_5='not found';assert.equal(filterSources(rows,query).length,0);
});
