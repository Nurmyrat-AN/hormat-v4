/** Isolated UI review data shaped after the existing synchronized tables. Never persisted. */
export function sourceFixtures(labels){
 const vendors=['A','B','C'].map((letter,i)=>({id:'vendor-'+i,name:labels.vendor+' '+letter}));
 const currencies=vendors.map((vendor,i)=>({id:'currency-'+i,name:['USD','EUR','TMT'][i],vendor_id:vendor.id}));
 const measures=vendors.map((vendor,i)=>({id:'measure-'+i,name:['pc','kg','m'][i],vendor_id:vendor.id}));
 const names=['iPhone 15','Galaxy S24','USB-C','Arabica'];
 const rows=Array.from({length:36},(_,i)=>{
  const vendor=vendors[i%3],currency=currencies[i%3],measure=measures[i%3];
  // Values are explicit fixtures, not a new stock algorithm.
  const quantities=[['12','8','20'],['0','0','0'],['-2','0','-2'],['1.5','2','3.5']][i%4];
  return {id:'source-preview-'+(i+1),source_id:'SRC-'+String(i+1).padStart(4,'0'),name:names[i%4]+' · '+(i+1),vendor,currency:i===35?null:currency,measure:i===35?null:measure,price:i===35?null:String(12+i*2.5),is_active:i%5!==0,stock:quantities[2],stocks:[{warehouse:labels.warehouse+' A',stock:quantities[0]},{warehouse:labels.warehouse+' B',stock:quantities[1]}],barcodes:i===35?[]:['460000'+String(i+1).padStart(6,'0'),...(i%2===0?['ALT-'+(i+1)]:[])],property_1:i%2?'Series-B':'Series-A',property_2:i%3?'128':'256',property_3:i%2?'2026':'2025',property_4:i%4?'Type-A':null,property_5:i%3?'V2':null,product_count:i%3};
 });
 return {rows,vendors,currencies,measures};
}
