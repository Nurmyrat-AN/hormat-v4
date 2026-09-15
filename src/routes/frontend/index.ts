import { Router } from 'express';
import { index } from '../../controllers/frontend/index.js';

export const frontendRouter = Router();
frontendRouter.get('/', index);
