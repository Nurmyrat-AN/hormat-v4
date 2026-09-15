import {mediaApi} from './media-api.js';
import { browseMedia, inspectMedia } from '../../controllers/cpanel/media-browser.js';
import { usersApi } from './users-api.js';
import { permissionsApi } from './permissions-api.js';
import { permissions, permissionDetail } from '../../controllers/cpanel/permissions.js';
import { users } from '../../controllers/cpanel/users.js';
import { Router, urlencoded } from 'express';
import { rateLimit } from 'express-rate-limit';
import { uploadMedia } from '../../controllers/cpanel/media.js';
import { shellContext } from '../../cpanel/shell/context.js';
import { profile, submitProfile, submitPassword, passwordLimited } from '../../controllers/cpanel/profile.js';
import { index } from '../../controllers/cpanel/index.js';
import { login, submitLogin, logout } from '../../controllers/cpanel/login.js';
import { loadCpanelAuth, requireCpanelAuth, requireCsrf, requirePermission } from '../../cpanel/auth/http.js';

export const cpanelRouter = Router();
const loginLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false,
  handler: (_request, response) => { response.status(429).type('text').send(response.locals.t('cpanel.auth.tooManyAttempts')); },
});
cpanelRouter.use(loadCpanelAuth);
cpanelRouter.post('/media/upload', requireCpanelAuth, requireCsrf, uploadMedia);
cpanelRouter.get('/', requireCpanelAuth, shellContext, index);
const passwordLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false,
  keyGenerator: (_request, response) => response.locals.cpanelUser!.id, handler: passwordLimited,
});
cpanelRouter.post('/profile/password', requireCpanelAuth, urlencoded({ extended: false, limit: '16kb' }), requireCsrf, shellContext, passwordLimit, submitPassword);
cpanelRouter.post('/profile', requireCpanelAuth, urlencoded({ extended: false, limit: '8kb' }), requireCsrf, submitProfile);
cpanelRouter.use('/api/users',usersApi);
cpanelRouter.use('/api/media',mediaApi);
cpanelRouter.get('/api/media/details', requireCpanelAuth, requirePermission('media.view'), inspectMedia);
cpanelRouter.get('/media', requireCpanelAuth, requirePermission('media.view'), shellContext, browseMedia);
cpanelRouter.get('/users', requireCpanelAuth, requirePermission('users.view'), shellContext, users);
cpanelRouter.use('/api/permissions',permissionsApi);
cpanelRouter.get('/permissions', requireCpanelAuth, requirePermission('permissions.view'), shellContext, permissions);
cpanelRouter.get('/permissions/:userId', requireCpanelAuth, requirePermission('permissions.view'), shellContext, permissionDetail);
cpanelRouter.get('/profile', requireCpanelAuth, shellContext, profile);
cpanelRouter.get('/login', login);
cpanelRouter.post('/login', loginLimit, urlencoded({ extended: false, limit: '4kb' }), requireCsrf, submitLogin);
cpanelRouter.post('/logout', urlencoded({ extended: false, limit: '1kb' }), requireCpanelAuth, requireCsrf, logout);
