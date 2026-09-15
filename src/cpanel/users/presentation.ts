import type { UserRow } from './repository.js';
export function userView(row:UserRow){
 const avatar=row.avatar_url?.trim();
 return {id:String(row.id),name:row.name,phone:row.phone??'',job:row.job??'',email:row.email,
 avatarUrl:avatar&&!/[\\\u0000-\u0020]/.test(avatar)&&(/^\/(?!\/)/.test(avatar)||/^https?:\/\//i.test(avatar))?avatar:null,
 initials:row.name.trim().split(/\s+/).slice(0,2).map(word=>Array.from(word)[0]).join('').toUpperCase(),active:row.is_active,protected:row.protected===true};
}
