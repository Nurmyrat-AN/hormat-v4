import type { RequestHandler } from 'express';

export const index: RequestHandler = (_request, response) => {
  response.render('frontend/pages/index');
};
