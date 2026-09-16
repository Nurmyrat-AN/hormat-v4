import {localization} from '../localization/index.js';
import {MarketplaceDefaultsService} from './defaults.js';
export const marketplaceDefaults=new MarketplaceDefaultsService(undefined,async()=>{localization.invalidate();await localization.ensureFresh();});
