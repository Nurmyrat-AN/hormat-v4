import type { RequestHandler } from 'express';
import { permissionUsers, permissionUser } from '../../cpanel/permissions/read.js';
import { assignablePermissionGroups } from '../../cpanel/permissions/definitions.js';

export const permissions: RequestHandler = async (request, response) => {
  const query = request.query.query ?? '', status = request.query.status ?? 'active', page = request.query.page ?? '1';
  if (typeof query !== 'string' || query.length > 200 || !['active','inactive','all'].includes(String(status)) || typeof status !== 'string' || typeof page !== 'string' || !/^[1-9]\d{0,6}$/.test(page) || Object.keys(request.query).some(key => !['query','status','page'].includes(key))) {
    response.status(400).send(response.locals.t('errors.invalidRequest')); return;
  }
  const result = await permissionUsers(query.trim(), status as 'active'|'inactive'|'all', Number(page));
  response.render('cpanel/pages/permissions', { ...result, query, status,
    pageHref: (value: number) => '/cpanel/permissions?' + new URLSearchParams({ query, status, page: String(value) }),
  });
};

export const permissionDetail: RequestHandler = async (request, response) => {
  const id = request.params.userId;
  if (typeof id !== 'string' || !/^[1-9]\d{0,18}$/.test(id) || BigInt(id) > 9223372036854775807n) {
    response.status(404).send(response.locals.t('cpanel.users.notFound')); return;
  }
  const result = await permissionUser(id);
  if (!result) { response.status(404).send(response.locals.t('cpanel.users.notFound')); return; }
  if (result.user.protected) { response.status(403).send(response.locals.t('cpanel.permissions.protected')); return; }
  const translate = response.locals.t;
  const self = response.locals.cpanelUser!.id === id;
  const canEdit = !self && await response.locals.permissions.hasPermission('permissions.update');
  const groups = assignablePermissionGroups.map(group => ({ id: group.id, label: translate(group.translationKey),
    permissions: group.permissions.map((item, index) => ({ id: `${group.id}-${index}`, key:item.key, label: translate(item.translationKey), checked: result.granted.includes(item.key) })),
  }));
  response.render('cpanel/pages/permission-detail', { user: result.user, groups, canEdit, self });
};
