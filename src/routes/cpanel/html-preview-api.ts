import {Router,json} from 'express';
import {requireCpanelAuth,requireCsrf} from '../../cpanel/auth/http.js';
import {sanitizeDescription} from '../../content/html.js';
export const htmlPreviewApi=Router();
htmlPreviewApi.post('/',requireCpanelAuth,requireCsrf,json({limit:'32kb'}),(request,response)=>{
 const body=request.body;
 if(!body||typeof body.html!=='string'||body.html.length>4000||Object.keys(body).some(key=>key!=='html')){response.status(400).json({success:false});return;}
 response.json({success:true,html:sanitizeDescription(body.html)});
});
