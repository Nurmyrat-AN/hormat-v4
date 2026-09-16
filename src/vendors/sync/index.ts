import {config} from '../../config/env.js';
import {VendorCredentials} from '../credentials.js';
import {vendorEvents} from '../events.js';
import {VendorSyncRepository} from './repository.js';
import {VendorSyncManager} from './manager.js';
import {DurableSync} from './durable.js';
const durable=new DurableSync();
export const vendorSyncManager = new VendorSyncManager(new VendorSyncRepository(),
  new VendorCredentials(config.vendors.credentialsKey), vendorEvents, config.vendorSync, undefined, durable.process, undefined, durable.prepare);
