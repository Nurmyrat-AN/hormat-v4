/** A safe controlled-Media preview with a non-image/broken-image fallback. */
export function mediaPreview(media){
 const box=document.createElement('div');box.className='media-reference-preview';
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg'),use=document.createElementNS(svg.namespaceURI,'use');svg.setAttribute('aria-hidden','true');use.setAttribute('href','/public/cpanel/images/shell-icons.svg#'+(media?.folder?'folder':media?.image?'image':media?'file':'image'));svg.append(use);box.append(svg);
 if(media?.image&&media.url?.startsWith('/media/')){const img=document.createElement('img');img.src=media.url;img.alt='';img.loading='lazy';img.addEventListener('load',()=>svg.style.visibility='hidden');img.addEventListener('error',()=>{img.remove();svg.style.visibility='visible';});box.append(img);}
 return box;
}
