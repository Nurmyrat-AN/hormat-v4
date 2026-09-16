import {VendorError, VendorsRepository, type VendorActor} from '../repository.js';
import {SyncControlBusy, type VendorSyncManager} from './manager.js';

/** Configuration and source entities are deliberately outside the reset write set. */
export class VendorSyncResetService {
  constructor(private readonly manager: Pick<VendorSyncManager, 'withPausedVendor'>,
    private readonly repository = new VendorsRepository()) {}

  async reset(actor: VendorActor, target: string, input: unknown) {
    if (!/^[1-9]\d{0,18}$/.test(target) || BigInt(target) > 9223372036854775807n)
      throw new VendorError('VENDOR_NOT_FOUND', 404);
    if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length)
      throw new VendorError('VENDOR_INVALID_REQUEST');
    try {
      // Unauthorized callers must not even pause a worker. Recheck in the mutation transaction.
      await this.repository.authorized(actor, 'vendors.reset_sync', client => this.repository.get(client, target));
      const result = await this.manager.withPausedVendor(target, () =>
        this.repository.authorized(actor, 'vendors.reset_sync', async client => {
          await client.query("SET LOCAL lock_timeout='10s'");
          await client.query("SET LOCAL statement_timeout='60s'");
          const vendor = await this.repository.get(client, target, true);
          const binding = (await client.query('SELECT source_url FROM vendor_sync_sources WHERE vendor_id=$1', [target])).rows[0];
          // Replay retains source IDs: it cannot authorize mixing two CouchDB databases.
          if ((binding && binding.source_url !== vendor.url) || (!binding && vendor.last_sequence !== null))
            throw new VendorError('VENDOR_RESET_SOURCE_CHANGED', 409);
          if (!binding) await client.query('INSERT INTO vendor_sync_sources(vendor_id,source_url) VALUES($1,$2)', [target, vendor.url]);
          await client.query('DELETE FROM product_stocks WHERE vendor_id=$1', [target]);
          await client.query('DELETE FROM source_stock_movements WHERE vendor_id=$1', [target]);
          await client.query("UPDATE vendors SET last_sequence='0',date_last_sync=NULL,date_last_operation=NULL WHERE id=$1", [target]);
          return this.repository.get(client, target);
        }));
      return {row: result.value, code: result.restartPending ? 'VENDOR_RESET_RESTART_PENDING' : 'VENDOR_RESET_COMPLETED'};
    } catch (error) {
      if (error instanceof VendorError) throw error;
      if (error instanceof SyncControlBusy) throw new VendorError('VENDOR_RESET_BUSY', 409);
      throw new VendorError('VENDOR_RESET_FAILED', 500);
    }
  }
}
