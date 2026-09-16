import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
const aad=Buffer.from('HORMAT:vendors:credentials:v1');
export function validateVendorKey(value:unknown):string {
 if(typeof value!=='string'||! /^[a-fA-F0-9]{64}$/.test(value))throw new Error('Configuration error: VENDOR_CREDENTIALS_KEY must contain exactly 64 hexadecimal characters (32 bytes).');
 return value;
}
export class VendorCredentials {
 private readonly key:Buffer;
 constructor(value:string){this.key=Buffer.from(validateVendorKey(value),'hex');}
 encryptSecret(secret:string):string {
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',this.key,iv);cipher.setAAD(aad);
  const ciphertext=Buffer.concat([cipher.update(secret,'utf8'),cipher.final()]);
  return ['v1',iv.toString('base64url'),cipher.getAuthTag().toString('base64url'),ciphertext.toString('base64url')].join('.');
 }
 decryptSecret(payload:string):string {
  try {
   if(typeof payload!=='string'||payload.length>24000)throw new Error();
   const parts=payload.split('.');if(parts.length!==4||parts[0]!=='v1'||parts.slice(1).some(p=>! /^[A-Za-z0-9_-]+$/.test(p)))throw new Error();
   const [iv,tag,ciphertext]=parts.slice(1).map(p=>Buffer.from(p,'base64url'));
   if(iv.length!==12||tag.length!==16||parts.slice(1).some((p,i)=>[iv,tag,ciphertext][i].toString('base64url')!==p))throw new Error();
   const decipher=createDecipheriv('aes-256-gcm',this.key,iv);decipher.setAAD(aad);decipher.setAuthTag(tag);
   return Buffer.concat([decipher.update(ciphertext),decipher.final()]).toString('utf8');
  }catch{throw new Error('Vendor credential decryption failed.');}
 }
}
