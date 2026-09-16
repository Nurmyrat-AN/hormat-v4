import {localization} from '../localization/index.js';
import {LanguagesService} from './service.js';
export const languagesService=new LanguagesService(undefined,async()=>{localization.invalidate();await localization.ensureFresh();});
