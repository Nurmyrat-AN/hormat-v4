import type { RequestHandler } from 'express';

import { navigationRoadmap, prepareNavigation } from './navigation.js';

export const shellContext: RequestHandler = async (request, response, next) => {
  const canViewSourceProducts=await response.locals.permissions.hasPermission('source_products.view');
  const canViewOrderStatuses=await response.locals.permissions.hasPermission('order_statuses.view');
  const canViewSettings=await response.locals.permissions.hasPermission('settings.view');
  const canViewPaymentTypes=await response.locals.permissions.hasPermission('payment_types.view');
  const canViewDeliveryTypes=await response.locals.permissions.hasPermission('delivery_types.view');
  const canViewInterfaceTranslations=await response.locals.permissions.hasPermission('interface_translations.view');
  const canViewLanguages=await response.locals.permissions.hasPermission('languages.view');
  const canViewFrontendCurrencies=await response.locals.permissions.hasPermission('currencies.frontend.view');
  const canViewVendorRates=await response.locals.permissions.hasPermission('currencies.vendor_rates.view');
  const canViewDiscounts=await response.locals.permissions.hasPermission('discounts.view');
  const canViewCategories=await response.locals.permissions.hasPermission('categories.view');
  const canViewBrands=await response.locals.permissions.hasPermission('brands.view');
  const canViewVendors=await response.locals.permissions.hasPermission('vendors.view');
  const canViewMedia=await response.locals.permissions.hasPermission('media.view');
  const canViewUsers=await response.locals.permissions.hasPermission('users.view');
  const canViewPermissions=await response.locals.permissions.hasPermission('permissions.view');
  const user = response.locals.cpanelUser!;
  const avatar = user.avatar_url?.trim();
  const avatarUrl = avatar && !/[\\\u0000-\u0020]/.test(avatar) && (/^\/(?!\/)/.test(avatar) || /^https?:\/\//i.test(avatar)) ? avatar : null;
  response.locals.shell = {
    navigation: prepareNavigation(navigationRoadmap, response.locals.t, /^\/permissions\/[1-9]\d*$/.test(request.path) ? '/cpanel/permissions' : request.originalUrl.split('?')[0].replace(/\/$/, '') || '/cpanel', permission => permission === 'source_products.view' ? canViewSourceProducts : permission === 'order_statuses.view' ? canViewOrderStatuses : permission === 'settings.view' ? canViewSettings : permission === 'payment_types.view' ? canViewPaymentTypes : permission === 'delivery_types.view' ? canViewDeliveryTypes : permission === 'interface_translations.view' ? canViewInterfaceTranslations : permission === 'languages.view' ? canViewLanguages : permission === 'currencies.frontend.view' ? canViewFrontendCurrencies : permission === 'currencies.vendor_rates.view' ? canViewVendorRates : permission === 'discounts.view' ? canViewDiscounts : permission === 'categories.view' ? canViewCategories : permission === 'brands.view' ? canViewBrands : permission === 'vendors.view' ? canViewVendors : permission === 'users.view' ? canViewUsers : permission === 'permissions.view' ? canViewPermissions : permission === 'media.view' ? canViewMedia : false),
    user: { name: user.name, job: user.job, avatarUrl, initials: Array.from(user.name.trim().split(/\s+/).map(word => Array.from(word)[0]).slice(0, 2).join('')).join('').toUpperCase() },
    // Existing language endpoint deliberately accepts only established local destinations.
    returnTo: request.path==='/source-products'?'/cpanel/source-products':request.path==='/products'?'/cpanel/products':request.path==='/order-statuses'?'/cpanel/order-statuses':request.path==='/settings'?'/cpanel/settings':['/payment-types','/delivery-types'].includes(request.path) ? '/cpanel'+request.path : request.path === '/interface-translations' ? '/cpanel/interface-translations' : request.path === '/languages' ? '/cpanel/languages' : ['/currencies/frontend','/currencies/vendors'].includes(request.path) ? '/cpanel'+request.path : request.path === '/discounts' ? '/cpanel/discounts' : request.path === '/categories' ? '/cpanel/categories' : request.path === '/brands' ? '/cpanel/brands' : request.path === '/vendors' ? '/cpanel/vendors' : request.path === '/media' ? '/cpanel/media' : /^\/permissions(?:\/[1-9]\d{0,18})?$/.test(request.path) ? '/cpanel' + request.path : request.path === '/users' ? '/cpanel/users' : ['/profile', '/profile/password'].includes(request.path) ? '/cpanel/profile' : '/cpanel',
  };
  next();
};
