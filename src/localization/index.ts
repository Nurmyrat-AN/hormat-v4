import { config } from '../config/env.js';
import { readLocalizationData } from './repository.js';
import { LocalizationService } from './service.js';

export const localization = new LocalizationService(readLocalizationData, config.app.mode === 'development');
