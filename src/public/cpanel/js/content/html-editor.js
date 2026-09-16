/** Lightweight editor backed by the existing textarea/events and server-sanitized values. */
export function htmlText(value){const doc=new DOMParser().parseFromString(value.replace(/<\/(p|li|ul|ol)>|<br\s*\/?>/gi,' '),'text/html');return (doc.body.textContent??'').replace(/\s+/g,' ').trim();}
const escape=value=>value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
export class HtmlEditor {
 constructor(input,labels){
  this.input=input;this.box=document.createElement('div');this.box.className='html-editor form-control p-0';
  const toolbar=document.createElement('div');toolbar.className='html-editor-toolbar d-flex flex-wrap gap-1 p-1 border-bottom';toolbar.setAttribute('role','toolbar');toolbar.setAttribute('aria-label',labels.toolbar);
  this.area=document.createElement('div');this.area.className='html-editor-area p-2';this.area.contentEditable='true';this.area.setAttribute('role','textbox');this.area.setAttribute('aria-multiline','true');this.area.setAttribute('aria-label',input.closest('[data-translatable-field]').querySelector('[data-field-label]').textContent+(input.dataset.translationInput?' — '+input.dataset.translationInput:''));this.area.style.contain='layout paint';this.area.style.isolation='isolate';this.area.style.overflow='auto';this.area.style.maxHeight='360px';this.area.style.minHeight='90px';this.area.style.whiteSpace='pre-wrap';this.area.style.overflowWrap='anywhere';
  const commands=[['bold','B'],['italic','I'],['underline','U'],['insertUnorderedList','•'],['insertOrderedList','1.'],['createLink','↗'],['removeFormat','Tx']];
  for(const [command,symbol]of commands){const button=document.createElement('button');button.type='button';button.className='btn btn-sm btn-outline-secondary';button.textContent=symbol;button.title=labels[command];button.setAttribute('aria-label',labels[command]);button.dataset.htmlCommand=command;button.addEventListener('mousedown',event=>event.preventDefault());button.addEventListener('click',()=>{if(input.disabled)return;this.area.focus();if(command==='createLink'){const href=window.prompt(labels.url,'https://');if(!href)return;if(!/^(https?:\/\/|mailto:)/i.test(href.trim()))return;document.execCommand(command,false,href.trim());}else if(command==='removeFormat'){const text=this.area.innerText;this.area.replaceChildren(document.createTextNode(text));}else document.execCommand(command,false);this.sync();});toolbar.append(button);}
  const modes=document.createElement('div');modes.className='d-flex gap-1 p-1 border-bottom';
  this.source=document.createElement('textarea');this.source.className='html-editor-source form-control font-monospace border-0';this.source.rows=7;this.source.hidden=true;this.source.setAttribute('aria-label',labels.html);this.source.spellcheck=false;
  const notice=document.createElement('p');notice.className='small text-danger m-2';notice.hidden=true;notice.setAttribute('role','status');
  this.mode='visual';let revision=0;
  for(const mode of ['visual','html']){const button=document.createElement('button');button.type='button';button.className='btn btn-sm btn-outline-secondary';button.textContent=labels[mode];button.dataset.htmlMode=mode;button.setAttribute('aria-pressed',String(mode==='visual'));button.addEventListener('click',async()=>{
   if(input.disabled||this.mode===mode)return;
   if(mode==='visual'){
    const value=input.value,version=++revision;button.disabled=true;notice.hidden=true;
    try{const response=await fetch('/cpanel/api/html-preview',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':input.closest('[data-csrf]').dataset.csrf},body:JSON.stringify({html:value})});const result=await response.json();if(!response.ok||!result.success)throw Error();if(version!==revision||input.value!==value||input.disabled)return;this.area.innerHTML=result.html;
    }catch{notice.textContent=labels.previewFailed;notice.hidden=false;return;}finally{button.disabled=input.disabled;}
   }else this.source.value=input.value;
   this.mode=mode;this.source.hidden=mode!=='html';this.area.hidden=mode!=='visual';toolbar.hidden=mode!=='visual';modes.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.htmlMode===mode)));
  });modes.append(button);}
  this.source.addEventListener('input',event=>{event.stopPropagation();revision++;native.set.call(input,this.source.value);input.dispatchEvent(new Event('input',{bubbles:true}));});
  this.box.append(modes,toolbar,this.area,this.source,notice);input.after(this.box);input.hidden=true;
  const native=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value');
  Object.defineProperty(input,'value',{configurable:true,get:()=>native.get.call(input),set:value=>{revision++;native.set.call(input,value);this.source.value=value;this.area.innerHTML=/<\/?[a-z][^>]*>/i.test(value)?value:escape(value).replace(/\n/g,'<br>');}});
  this.sync=()=>{const html=this.area.innerHTML;native.set.call(input,html&&!/<\/?[a-z][^>]*>/i.test(html)?'<p>'+html+'</p>':html);input.dispatchEvent(new Event('input',{bubbles:true}));};
  this.area.addEventListener('input',event=>{event.stopPropagation();this.sync();});
  this.area.addEventListener('paste',event=>{event.preventDefault();document.execCommand('insertText',false,event.clipboardData.getData('text/plain'));this.sync();});
  this.area.addEventListener('drop',event=>event.preventDefault());
  this.area.addEventListener('keydown',()=>document.execCommand('defaultParagraphSeparator',false,'p'));
  const disabled=()=>{this.source.disabled=input.disabled;this.area.contentEditable=String(!input.disabled);this.area.setAttribute('aria-disabled',String(input.disabled));this.box.querySelectorAll('button').forEach(button=>button.disabled=input.disabled);};new MutationObserver(disabled).observe(input,{attributes:true,attributeFilter:['disabled']});disabled();
 }
}
