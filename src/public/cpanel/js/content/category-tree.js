/** Page-memory hierarchy helpers; no fixed depth, persistence or SQL. */
export function ancestors(rows,id){const result=[],seen=new Set();while(id){if(seen.has(id))throw Error('Category cycle');seen.add(id);const row=rows.find(item=>item.id===id);if(!row)break;result.unshift(row);id=row.basic.parentId;}return result;}
export function descendants(rows,id){const found=new Set(),pending=[id];while(pending.length){const parent=pending.pop();for(const row of rows)if(row.basic.parentId===parent&&!found.has(row.id)){found.add(row.id);pending.push(row.id);}}return found;}
export function allowedParent(rows,id,parent){return parent===null||Boolean(rows.some(row=>row.id===parent)&&parent!==id&&(!id||!descendants(rows,id).has(parent)));}
export function totalProducts(rows,id){const included=descendants(rows,id);included.add(id);return rows.reduce((sum,row)=>sum+(included.has(row.id)?row.directProducts:0),0);}
