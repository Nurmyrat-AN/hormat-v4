/** Fictional content fixtures, never database records or interface translation dictionaries. */
export function brandPreviews(languages: readonly {code:string}[]) {
  return ['Arça','NOVA','Mira','Orion','Atlas','Lumen','Sada','North Star Everyday Collection — Studio & Home'].map((name,index)=>({
    id:'preview-'+(index+1), basic:{name,is_visible:index%3===0,mainMedia:null as null|{path:string;url:string;name:string;image:boolean;type:string}},
    translations:Object.fromEntries(languages.slice(0,index===0?languages.length:index===1?2:index===2?0:1).map(lang=>[lang.code,name])),
    gallery:[] as {path:string;url:string;name:string;image:boolean;type:string}[],
  }));
}
