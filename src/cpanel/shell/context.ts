import type { RequestHandler } from 'express';

import { navigationRoadmap, prepareNavigation } from './navigation.js';

export const shellContext: RequestHandler = async (request, response, next) => {
  const canViewUsers=await response.locals.permissions.hasPermission('users.view');
  const canViewPermissions=await response.locals.permissions.hasPermission('permissions.view');
  const user = response.locals.cpanelUser!;
  const avatar = user.avatar_url?.trim();
  const avatarUrl = avatar && !/[\\\u0000-\u0020]/.test(avatar) && (/^\/(?!\/)/.test(avatar) || /^https?:\/\//i.test(avatar)) ? avatar : null;
  response.locals.shell = {
    navigation: prepareNavigation(navigationRoadmap, response.locals.t, /^\/permissions\/[1-9]\d*$/.test(request.path) ? '/cpanel/permissions' : request.originalUrl.split('?')[0].replace(/\/$/, '') || '/cpanel', permission => permission === 'users.view' ? canViewUsers : permission === 'permissions.view' ? canViewPermissions : false),
    user: { name: user.name, job: user.job, avatarUrl, initials: Array.from(user.name.trim().split(/\s+/).map(word => Array.from(word)[0]).slice(0, 2).join('')).join('').toUpperCase() },
    // Existing language endpoint deliberately accepts only established local destinations.
    returnTo: request.path === '/media' ? '/cpanel/media' : /^\/permissions(?:\/[1-9]\d{0,18})?$/.test(request.path) ? '/cpanel' + request.path : request.path === '/users' ? '/cpanel/users' : ['/profile', '/profile/password'].includes(request.path) ? '/cpanel/profile' : '/cpanel',
  };
  next();
};
