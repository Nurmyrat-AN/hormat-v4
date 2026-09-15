import path from 'node:path';
import { mediaRouter } from '../media/http.js';
import { fileURLToPath } from 'node:url';
import express, { type ErrorRequestHandler } from 'express';
import { config } from '../config/env.js';
import { checkDatabase } from '../database/pool.js';
import { frontendRouter } from '../routes/frontend/index.js';
import { cpanelRouter } from '../routes/cpanel/index.js';
import { localizationMiddleware, languageRouter } from '../localization/http.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const app = express();
app.disable('x-powered-by');
app.set('view engine', 'ejs');
app.set('views', path.join(root, 'views'));
app.locals.isDevelopment = config.app.mode === 'development';
app.locals.mediaMaxBytes = config.media.maxBytes;
app.use(localizationMiddleware);
app.use('/public/frontend', express.static(path.join(root, 'public/frontend')));
app.use('/public/cpanel', express.static(path.join(root, 'public/cpanel')));
app.use('/public/vendor', express.static(path.join(root, 'public/vendor')));
app.get('/health', async (_request, response) => {
  response.set('Cache-Control', 'no-store');
  try {
    await checkDatabase();
    response.json({ status: 'ok', database: 'connected' });
  } catch {
    response.status(503).json({ status: 'unavailable', database: 'disconnected' });
  }
});
app.use('/media', mediaRouter);
app.use('/language', languageRouter);
app.use('/cpanel', cpanelRouter);
app.use('/', frontendRouter);
app.use((_request, response) => response.status(404).type('text').send(response.locals.t('errors.notFound')));
const handleError: ErrorRequestHandler = (error, _request, response, next) => {
  console.error('HTTP request failed:', error instanceof Error ? error.name : 'Unknown error');
  if (response.headersSent) return next(error);
  const status = error.status === 400 || error.status === 413 ? error.status : 500;
  const message = status === 500 ? response.locals.t('errors.internalServer') : response.locals.t('errors.invalidRequest');
  response.status(status).type('text').send(message);
};
app.use(handleError);
