import {readFile,writeFile} from 'node:fs/promises';
const input=JSON.parse(await readFile('docs/COUCHDB_DOCUMENT_INVENTORY.json','utf8'));
const esc=value=>String(value).replaceAll('|','\\|').replaceAll('\n',' ').replaceAll('<','&lt;').replaceAll('>','&gt;');
const lines=['# CouchDB decoded field inventory','',`Generated from bounded scan ${input.generatedAt}. Discriminator: ${input.discriminator??'structural fingerprint'}.`,'','Presence is the number of parent documents containing the path. Array-element type counts may exceed parent document count. Missing = family count − presence; null is a separate type. Paths describe sanitized sample shapes without full values. Numeric ranges are approximate JS observations, not approved monetary/quantity precision.',''];
for(const vendor of input.vendors){
 lines.push(`## Vendor ${vendor.vendorId}`,'',`Stats: ${JSON.stringify(vendor.stats)}`,'');
 for(const [name,f] of Object.entries(vendor.families).sort((a,b)=>b[1].count-a[1].count)){
  lines.push(`### ${esc(name)}`,'',`Count **${f.count}**; encrypted **${f.encrypted}**; unencrypted **${f.unencrypted}**. Deleted/failed documents cannot be assigned to this family and remain separate.`,'',`Safe source ID examples: ${f.ids.map(id=>'`'+id+'`').join(', ')}.`,'',`Nested/field bounds reached: **${f.truncated?'yes':'no'}**.`,'','| Field/path | Presence | Missing | Observed types (occurrences) | Safe examples | Numeric observations |','| --- | ---: | ---: | --- | --- | --- |');
  for(const [field,d] of Object.entries(f.fields).sort((a,b)=>a[0].localeCompare(b[0]))){
   const numeric=d.numeric?`min=${d.numeric.min}; max=${d.numeric.max}; zero=${d.numeric.zero}; negative=${d.numeric.negative}; max observed decimal places=${d.numeric.maxDecimalPlaces}`:'';
   lines.push(`| ${esc(field)} | ${d.presence}/${f.count} (${(100*d.presence/f.count).toFixed(2)}%) | ${f.count-d.presence} | ${esc(JSON.stringify(d.types))} | ${esc(JSON.stringify(d.examples))} | ${esc(numeric)} |`);
  }
  lines.push('','Reference evidence (sampled same-Vendor IDs; no match is inconclusive):','');
  for(const ref of vendor.references.filter(r=>r.field.startsWith(name+' / ')))lines.push(`- ${esc(ref.field.slice(name.length+3))}: ${ref.sampledDistinct} sampled distinct values; matches ${esc(JSON.stringify(ref.matches))}.`);
  lines.push('');
 }
 lines.push('Deleted safe ID examples: '+vendor.deletedIds.map(id=>'`'+id+'`').join(', '),'','Decode failure examples: '+JSON.stringify(vendor.failures),'');
}
await writeFile('docs/COUCHDB_FIELD_INVENTORY.md',lines.join('\n')+'\n',{mode:0o600});
console.info('Wrote aggregate field inventory; no complete source documents exported.');
