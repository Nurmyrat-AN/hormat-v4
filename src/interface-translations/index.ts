import {localization} from '../localization/index.js';
import {TranslationService} from './service.js';
export const translationService=new TranslationService(undefined,async()=>{localization.invalidate();await localization.ensureFresh();});
