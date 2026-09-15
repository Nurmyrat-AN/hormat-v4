import { booleanPermissionKeys } from './definitions.js';
import { PermissionsError } from './errors.js';
import { PermissionsRepository, type PermissionActor } from './repository.js';

export class PermissionsService {
  constructor(readonly repository = new PermissionsRepository()) {}
  async save(actor: PermissionActor, targetId: unknown, input: unknown) {
    if (typeof targetId !== 'string' || !/^[1-9]\d{0,18}$/.test(targetId) || BigInt(targetId)>9223372036854775807n) throw new PermissionsError('notFound',404);
    if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length!==1 || !Object.hasOwn(input,'permissions')) throw new PermissionsError('invalidRequest');
    const values = (input as {permissions: unknown}).permissions;
    // Explicit full-state contract: every managed key has an actual JSON boolean.
    if (!values || typeof values!=='object' || Array.isArray(values) || Object.keys(values).length!==booleanPermissionKeys.length ||
      Object.keys(values).some(key=>!booleanPermissionKeys.includes(key)) ||
      booleanPermissionKeys.some(key=>!Object.hasOwn(values,key) || typeof (values as Record<string,unknown>)[key]!=='boolean')) throw new PermissionsError('invalidRequest');
    const granted = booleanPermissionKeys.filter(key=>(values as Record<string,boolean>)[key]===true);
    try { await this.repository.save(actor,targetId,booleanPermissionKeys,granted); }
    catch(error) { if(error instanceof PermissionsError)throw error; throw new PermissionsError('failure',500); }
    return { permissions: Object.fromEntries(booleanPermissionKeys.map(key=>[key,granted.includes(key)])) };
  }
}
export const permissionsService = new PermissionsService();
