/** Authoritative definition/management allowlist. Assignments remain in PostgreSQL. */
import { validatePermissionDefinitions } from './validate-definitions.js';
export type PermissionValueType = 'boolean' | 'integer' | 'decimal' | 'string' | 'json';
export const permissionDefinitions = [{
  id: 'users', translationKey: 'cpanel.navigation.users',
  permissions: [
    { key: 'users.view', assignable: true, valueType: 'boolean' as PermissionValueType, translationKey: 'cpanel.permissions.users.view' },
    { key: 'users.create', assignable: true, valueType: 'boolean' as PermissionValueType, translationKey: 'cpanel.permissions.users.create' },
    { key: 'users.update', assignable: true, valueType: 'boolean' as PermissionValueType, translationKey: 'cpanel.permissions.users.update' },
    { key: 'users.status', assignable: true, valueType: 'boolean' as PermissionValueType, translationKey: 'cpanel.permissions.users.status' },
    { key: 'users.change_password', assignable: true, valueType: 'boolean' as PermissionValueType, translationKey: 'cpanel.permissions.users.password' },
  ],
}, {
  id: 'permissions', translationKey: 'cpanel.navigation.permissions',
  permissions: [
    { key: 'permissions.view', assignable: true, valueType: 'boolean' as PermissionValueType, translationKey: 'cpanel.permissions.access.view' },
    { key: 'permissions.update', assignable: true, valueType: 'boolean' as PermissionValueType, translationKey: 'cpanel.permissions.access.update' },
  ],
}, {
  id: 'media', translationKey: 'cpanel.navigation.media',
  permissions: [
    { key: 'media.view', assignable: true, valueType: 'boolean' as PermissionValueType, translationKey: 'cpanel.media.viewPermission' },
    { key: 'media.upload', assignable: true, valueType: 'boolean' as PermissionValueType, translationKey: 'cpanel.media.uploadPermission' },
    { key: 'media.create_folder', assignable: true, valueType: 'boolean' as PermissionValueType, translationKey: 'cpanel.media.createPermission' },
    { key: 'media.rename', assignable: true, valueType: 'boolean' as PermissionValueType, translationKey: 'cpanel.media.renamePermission' },
    { key: 'media.delete', assignable: true, valueType: 'boolean' as PermissionValueType, translationKey: 'cpanel.media.deletePermission' },
  ],
}, {
  id: 'system', translationKey: 'cpanel.navigation.group.system',
  permissions: [{ key: 'superuser', assignable: false, valueType: 'boolean' as PermissionValueType, translationKey: 'cpanel.users.superuser' }],
}];
validatePermissionDefinitions(permissionDefinitions);
export const assignablePermissionGroups = permissionDefinitions.map(group => ({ ...group, permissions: group.permissions.filter(item => item.assignable) })).filter(group => group.permissions.length);
export const booleanPermissionKeys = assignablePermissionGroups.flatMap(group => group.permissions.filter(item => item.valueType === 'boolean').map(item => item.key));
