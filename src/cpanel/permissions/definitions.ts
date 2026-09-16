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
    { key: 'media.move', assignable: true, valueType: 'boolean' as PermissionValueType, translationKey: 'cpanel.media.movePermission' },
    { key: 'media.delete', assignable: true, valueType: 'boolean' as PermissionValueType, translationKey: 'cpanel.media.deletePermission' },
  ],
}, {
  id: 'vendors', translationKey: 'cpanel.navigation.vendors',
  permissions: [
    { key: 'vendors.view', assignable: true, valueType: 'boolean' as PermissionValueType, translationKey: 'cpanel.vendors.permissionView' },
    { key: 'vendors.create', assignable: true, valueType: 'boolean' as PermissionValueType, translationKey: 'cpanel.vendors.permissionCreate' },
    { key: 'vendors.update', assignable: true, valueType: 'boolean' as PermissionValueType, translationKey: 'cpanel.vendors.permissionUpdate' },
    { key: 'vendors.reset_sync', assignable: true, valueType: 'boolean' as PermissionValueType, translationKey: 'cpanel.vendors.resetSync' },
    { key: 'vendors.status', assignable: true, valueType: 'boolean' as PermissionValueType, translationKey: 'cpanel.vendors.permissionStatus' },
  ],
}, {
  id: 'brands', translationKey: 'cpanel.navigation.brands',
  permissions: [
    { key: 'brands.view', assignable: true, valueType: 'boolean' as PermissionValueType, translationKey: 'cpanel.brands.permissionView' },
    { key: 'brands.create', assignable: true, valueType: 'boolean' as PermissionValueType, translationKey: 'cpanel.brands.permissionCreate' },
    { key: 'brands.update', assignable: true, valueType: 'boolean' as PermissionValueType, translationKey: 'cpanel.brands.permissionUpdate' },
    { key: 'brands.visibility', assignable: true, valueType: 'boolean' as PermissionValueType, translationKey: 'cpanel.brands.permissionVisibility' },
  ],
}, {
  id: 'categories', translationKey: 'cpanel.navigation.categories',
  permissions: [
    { key: 'categories.view', assignable: true, valueType: 'boolean' as PermissionValueType, translationKey: 'cpanel.categories.permissionView' },
    { key: 'categories.create', assignable: true, valueType: 'boolean' as PermissionValueType, translationKey: 'cpanel.categories.permissionCreate' },
    { key: 'categories.update', assignable: true, valueType: 'boolean' as PermissionValueType, translationKey: 'cpanel.categories.permissionUpdate' },
    { key: 'categories.visibility', assignable: true, valueType: 'boolean' as PermissionValueType, translationKey: 'cpanel.categories.permissionVisibility' },
  ],
}, {
  id: 'discounts', translationKey: 'cpanel.navigation.discounts',
  permissions: [
    { key: 'discounts.view', assignable: true, valueType: 'boolean' as PermissionValueType, translationKey: 'cpanel.discounts.permissionView' },
    { key: 'discounts.create', assignable: true, valueType: 'boolean' as PermissionValueType, translationKey: 'cpanel.discounts.permissionCreate' },
    { key: 'discounts.update', assignable: true, valueType: 'boolean' as PermissionValueType, translationKey: 'cpanel.discounts.permissionUpdate' },
    { key: 'discounts.visibility', assignable: true, valueType: 'boolean' as PermissionValueType, translationKey: 'cpanel.discounts.permissionVisibility' },
  ],
}, {
  id: 'currencies_frontend', translationKey: 'cpanel.currencies.frontend',
  permissions: [
    {key:'currencies.frontend.view',assignable:true,valueType:'boolean' as PermissionValueType,translationKey:'cpanel.currencies.permissionFrontendView'},
    {key:'currencies.frontend.create',assignable:true,valueType:'boolean' as PermissionValueType,translationKey:'cpanel.currencies.permissionFrontendCreate'},
    {key:'currencies.frontend.update',assignable:true,valueType:'boolean' as PermissionValueType,translationKey:'cpanel.currencies.permissionFrontendUpdate'},
    {key:'currencies.frontend.visibility',assignable:true,valueType:'boolean' as PermissionValueType,translationKey:'cpanel.currencies.permissionFrontendVisibility'},
  ],
}, {
  id: 'currencies_vendor_rates', translationKey: 'cpanel.currencies.vendors',
  permissions: [
    {key:'currencies.vendor_rates.view',assignable:true,valueType:'boolean' as PermissionValueType,translationKey:'cpanel.currencies.permissionVendorView'},
    {key:'currencies.vendor_rates.update',assignable:true,valueType:'boolean' as PermissionValueType,translationKey:'cpanel.currencies.permissionVendorUpdate'},
  ],
}, {
  id: 'languages', translationKey: 'cpanel.navigation.languages',
  permissions: [
    {key:'languages.view',assignable:true,valueType:'boolean' as PermissionValueType,translationKey:'cpanel.languages.permissionView'},
    {key:'languages.create',assignable:true,valueType:'boolean' as PermissionValueType,translationKey:'cpanel.languages.permissionCreate'},
    {key:'languages.update',assignable:true,valueType:'boolean' as PermissionValueType,translationKey:'cpanel.languages.permissionUpdate'},
    {key:'languages.status',assignable:true,valueType:'boolean' as PermissionValueType,translationKey:'cpanel.languages.permissionStatus'},
    {key:'languages.default',assignable:true,valueType:'boolean' as PermissionValueType,translationKey:'cpanel.languages.permissionDefault'},
  ],
}, {
  id: 'interface_translations', translationKey: 'cpanel.navigation.interfaceTranslations',
  permissions: [
    {key:'interface_translations.view',assignable:true,valueType:'boolean' as PermissionValueType,translationKey:'cpanel.interfaceTranslations.permissionView'},
    {key:'interface_translations.update',assignable:true,valueType:'boolean' as PermissionValueType,translationKey:'cpanel.interfaceTranslations.permissionUpdate'},
  ],
}, {
  id: 'payment_types', translationKey: 'cpanel.navigation.paymentTypes',
  permissions: [
    {key:'payment_types.view',assignable:true,valueType:'boolean' as PermissionValueType,translationKey:'cpanel.optionTypes.permissionView'},
    {key:'payment_types.create',assignable:true,valueType:'boolean' as PermissionValueType,translationKey:'cpanel.optionTypes.permissionCreate'},
    {key:'payment_types.update',assignable:true,valueType:'boolean' as PermissionValueType,translationKey:'cpanel.optionTypes.permissionUpdate'},
    {key:'payment_types.visibility',assignable:true,valueType:'boolean' as PermissionValueType,translationKey:'cpanel.optionTypes.permissionVisibility'},
  ],
}, {
  id: 'delivery_types', translationKey: 'cpanel.navigation.deliveryTypes',
  permissions: [
    {key:'delivery_types.view',assignable:true,valueType:'boolean' as PermissionValueType,translationKey:'cpanel.optionTypes.permissionView'},
    {key:'delivery_types.create',assignable:true,valueType:'boolean' as PermissionValueType,translationKey:'cpanel.optionTypes.permissionCreate'},
    {key:'delivery_types.update',assignable:true,valueType:'boolean' as PermissionValueType,translationKey:'cpanel.optionTypes.permissionUpdate'},
    {key:'delivery_types.visibility',assignable:true,valueType:'boolean' as PermissionValueType,translationKey:'cpanel.optionTypes.permissionVisibility'},
  ],
}, {
  id:'order_statuses',translationKey:'cpanel.navigation.orderStatuses',
  permissions:[
    {key:'order_statuses.view',assignable:true,valueType:'boolean' as PermissionValueType,translationKey:'cpanel.optionTypes.permissionView'},
    {key:'order_statuses.create',assignable:true,valueType:'boolean' as PermissionValueType,translationKey:'cpanel.optionTypes.permissionCreate'},
    {key:'order_statuses.update',assignable:true,valueType:'boolean' as PermissionValueType,translationKey:'cpanel.optionTypes.permissionUpdate'},
    {key:'order_statuses.visibility',assignable:true,valueType:'boolean' as PermissionValueType,translationKey:'cpanel.optionTypes.permissionVisibility'},
  ],
}, {
  id:'settings', translationKey:'cpanel.navigation.settings',
  permissions:[
    {key:'settings.view',assignable:true,valueType:'boolean' as PermissionValueType,translationKey:'cpanel.settings.permissionView'},
    {key:'settings.update',assignable:true,valueType:'boolean' as PermissionValueType,translationKey:'cpanel.settings.permissionUpdate'},
  ],
}, {
  id:'products',translationKey:'cpanel.navigation.products',
  permissions:[
    {key:'products.view',assignable:true,valueType:'boolean' as PermissionValueType,translationKey:'cpanel.products.permissionView'},
    {key:'products.create',assignable:true,valueType:'boolean' as PermissionValueType,translationKey:'cpanel.products.permissionCreate'},
    {key:'products.update',assignable:true,valueType:'boolean' as PermissionValueType,translationKey:'cpanel.products.permissionUpdate'},
    {key:'products.visibility',assignable:true,valueType:'boolean' as PermissionValueType,translationKey:'cpanel.products.permissionVisibility'},
  ],
}, {
  id:'source_products',translationKey:'cpanel.navigation.sourceProducts',
  permissions:[{key:'source_products.view',assignable:true,valueType:'boolean' as PermissionValueType,translationKey:'cpanel.sourceProducts.permissionView'}],
}, {
  id: 'system', translationKey: 'cpanel.navigation.group.system',
  permissions: [{ key: 'superuser', assignable: false, valueType: 'boolean' as PermissionValueType, translationKey: 'cpanel.users.superuser' }],
}];
validatePermissionDefinitions(permissionDefinitions);
export const assignablePermissionGroups = permissionDefinitions.map(group => ({ ...group, permissions: group.permissions.filter(item => item.assignable) })).filter(group => group.permissions.length);
export const booleanPermissionKeys = assignablePermissionGroups.flatMap(group => group.permissions.filter(item => item.valueType === 'boolean').map(item => item.key));
