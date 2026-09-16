import sanitizeHtml from 'sanitize-html';
const length=/^(?:0|[0-9]{1,4}(?:\.[0-9]{1,2})?(?:px|em|rem|%))$/;
const spacing=/^(?:0|[0-9]{1,4}(?:\.[0-9]{1,2})?(?:px|em|rem|%))(?: (?:0|[0-9]{1,4}(?:\.[0-9]{1,2})?(?:px|em|rem|%))){0,3}$/;
const styles:Record<string,RegExp[]>={'text-align':[/^(left|right|center|justify)$/],'font-weight':[/^(normal|bold|[1-9]00)$/],'font-style':[/^(normal|italic|oblique)$/],'text-decoration':[/^(none|underline|line-through)$/],display:[/^(block|inline|inline-block|none)$/]};
for(const key of ['width','max-width','height','max-height'])styles[key]=[length,/^auto$/];
for(const key of ['margin','padding']){styles[key]=[spacing];for(const side of ['top','right','bottom','left'])styles[key+'-'+side]=[length];}
const escape=(value:string)=>value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
/** One server boundary for formatted customer-facing Description fields, including legacy reads. */
export function sanitizeDescription(value:string):string {
 const source=/<\/?[a-z][^>]*>/i.test(value)?value:(value.trim()?'<p>'+escape(value).replace(/\r?\n/g,'<br>')+'</p>':'');
 const html=sanitizeHtml(source,{
  allowedTags:['p','br','strong','b','em','i','u','ul','ol','li','a','div','span','h1','h2','h3','h4','h5','h6','img','table','thead','tbody','tr','th','td','blockquote'],
  allowedAttributes:{'*':['class','style'],a:['href','title','target','rel'],img:['src','alt','title','width','height'],th:['colspan','rowspan'],td:['colspan','rowspan']},allowedStyles:{'*':styles},allowedSchemesByTag:{img:['http','https']},allowedSchemes:['http','https','mailto'],allowProtocolRelative:false,
  nonTextTags:['script','style','textarea','option','iframe','object','embed','svg','math'],
  transformTags:{a:(tag,attrs)=>{const {target,rel,...rest}=attrs;return {tagName:tag,attribs:{...rest,...(target==='_blank'?{target,rel:'noopener noreferrer'}:target==='_self'?{target}:{} )}};}},
 }).trim();
 return /<img\s[^>]*src=/.test(html)||sanitizeHtml(html,{allowedTags:[],allowedAttributes:{}}).replace(/&nbsp;/g,' ').trim()?html:'';
}
