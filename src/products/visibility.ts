/** The same predicate composition serves editor diagnostics and SQL browser filtering. */
const fields=['visible','sourceActive','vendorActive','stockPassed','brandVisible','categoryVisible'] as const;
export type VisibilityInputs=Record<typeof fields[number],boolean>;
type Inputs<T>={visible:T;sourceActive:T;vendorActive:T;hideStock:T;inStock:T;brandVisible:T;categoryVisible:T};
function predicates<T>(input:Inputs<T>,not:(value:T)=>T,or:(left:T,right:T)=>T){return {visible:input.visible,sourceActive:input.sourceActive,vendorActive:input.vendorActive,stockPassed:or(not(input.hideStock),input.inStock),brandVisible:input.brandVisible,categoryVisible:input.categoryVisible};}
export function effectiveVisibility(values:VisibilityInputs){return fields.every(key=>values[key]);}
export function visibilitySql(input:Inputs<string>){const values=predicates(input,value=>`NOT (${value})`,(left,right)=>`(${left}) OR (${right})`);return fields.map(key=>'('+values[key]+')').join(' AND ');}
export function visibilityDiagnostics(product:{is_visible:boolean;hide_when_out_of_stock:boolean},source:{active:boolean;vendorActive:boolean;inStock:boolean},brandVisible=true,categoryVisible=true):VisibilityInputs{return predicates({visible:product.is_visible,sourceActive:source.active,vendorActive:source.vendorActive,hideStock:product.hide_when_out_of_stock,inStock:source.inStock,brandVisible,categoryVisible},value=>!value,(left,right)=>left||right);}
