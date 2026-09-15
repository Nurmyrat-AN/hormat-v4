import path from 'node:path';
import {lstat,opendir} from 'node:fs/promises';
import {BrowseError, hiddenMediaName as hidden, resolveMediaPath} from '../../media/paths.js';
export {BrowseError} from '../../media/paths.js';
import {mediaStore} from '../../media/index.js';
import {describeFile,inlineMimeTypes} from '../../media/metadata.js';
import {managedMediaLocations,temporaryMediaLocation} from './locations.js';
import {MediaStore} from '../../media/store.js';

export interface MediaEntry {name:string;path:string;parent:string;folder:boolean;size:number|null;modified:string;url:string|null;image:boolean;temporary:boolean;managed:boolean;type:string}
/** No symlinks (including internal ones), hidden infrastructure or private cache records. */
export class MediaBrowser {
 constructor(readonly root=mediaStore.root){}
 async resolve(relative:string):Promise<string>{return resolveMediaPath(this.root,relative);}
 async entry(relative:string):Promise<MediaEntry>{
  const file=await this.resolve(relative),info=await lstat(file);if(!info.isDirectory()&&!info.isFile())throw new BrowseError();
  const parts=relative.split('/'),name=parts.at(-1)??'',temporary=parts[0]===temporaryMediaLocation;
  // Cache owner/token records are private infrastructure, never manager entries.
  if(temporary&&name==='record.json')throw new BrowseError();
  const reference=info.isFile()?await new MediaStore(this.root,mediaStore.ttlHours).publicReferenceForRelativePath(relative):null;
  const url=reference?.url??null,mimeType=reference?.mimeType;
  const kind=info.isDirectory()?'folder':mimeType?(mimeType.startsWith('image/')?'image':mimeType.startsWith('video/')?'video':'file'):/\.(png|jpe?g|webp|gif|avif|bmp)$/i.test(name)?'image':/\.(mp4|webm|mov|mkv)$/i.test(name)?'video':'file';
  return {name,path:relative,parent:parts.slice(0,-1).join('/'),folder:info.isDirectory(),size:info.isFile()?info.size:null,modified:info.mtime.toISOString(),url,image:!!url&&(mimeType?inlineMimeTypes.has(mimeType):kind==='image'),temporary,managed:managedMediaLocations.has(parts[0]),type:kind};
 }
 async inspect(relative:string){
  if(!relative)throw new BrowseError(400); // The boundary is never an editable root item.
  const item=await this.entry(relative);
  let mimeType:string|null=null,width:number|null=null,height:number|null=null,childCount:number|null=null,childCountLimited=false;
  if(item.folder){
   childCount=0;let examined=0;const started=Date.now();
   for await(const child of await opendir(await this.resolve(relative))){
    if(++examined>10000||Date.now()-started>2500){childCountLimited=true;break;}
    if(hidden(child.name)||child.isSymbolicLink()||(!child.isFile()&&!child.isDirectory())||(item.temporary&&child.name==='record.json'))continue;
    if(childCount===500){childCountLimited=true;break;}childCount++;
   }
  }else{
   const metadata=await describeFile(await this.resolve(relative));mimeType=metadata.mimeType;width=metadata.width;height=metadata.height;
   item.type=mimeType.startsWith('image/')?'image':mimeType.startsWith('video/')?'video':'file';
   item.image=!!item.url&&inlineMimeTypes.has(mimeType);
  }
  return {...item,mimeType,width,height,childCount,childCountLimited};
 }
 async list(relative:string,query:string,scope:string,sort:string,signal?:AbortSignal){
  const directory=await this.resolve(relative);if(!(await lstat(directory)).isDirectory())throw new BrowseError();
  const recursive=!!query&&scope==='all',queue=[recursive?'':relative],items:MediaEntry[]=[];let scanned=0,limited=false;const started=Date.now();
  scan:while(queue.length){
   if(signal?.aborted)break;const parent=queue.shift()!;
   let directory;try{directory=await opendir(await this.resolve(parent));}catch(error){if(parent===relative||parent==='')throw error;continue;}
   for await(const child of directory){
    if(signal?.aborted)break scan;
    if(++scanned>10000||Date.now()-started>2500||items.length>=500){limited=true;break scan;}
    if(hidden(child.name)||child.isSymbolicLink()||(!child.isFile()&&!child.isDirectory())||(parent.split('/')[0]==='cache'&&child.name==='record.json'))continue;
    const rel=[parent,child.name].filter(Boolean).join('/');
    if(recursive&&child.isDirectory())queue.push(rel);
    if(query&&!child.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()))continue;
    try{items.push(await this.entry(rel));}catch{/* Disappeared, inaccessible or private entries are skipped. */}
   }
  }
  items.sort((a,b)=>Number(b.folder)-Number(a.folder)||(sort==='size'?(b.size??0)-(a.size??0):sort==='modified'?b.modified.localeCompare(a.modified):sort==='type'?a.type.localeCompare(b.type):0)||a.name.localeCompare(b.name));
  return {items,limited,path:relative};
 }
}
export const mediaBrowser=new MediaBrowser();
