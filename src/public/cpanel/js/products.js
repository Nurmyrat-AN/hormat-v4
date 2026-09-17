import {productsBrowser} from './products-browser.js';
import {createProductEditor} from './content/product-editor.js';
import {ProductSourceSelector} from './content/product-source-selector.js';
const editor=createProductEditor(document.getElementById('products-app'));
const selectorRoot=document.getElementById('product-source-selector');
if(selectorRoot){const selector=new ProductSourceSelector(selectorRoot,source=>editor.openCreate(source));document.getElementById('product-add').addEventListener('click',()=>selector.open());}

productsBrowser(document.getElementById('products-app'),editor);
