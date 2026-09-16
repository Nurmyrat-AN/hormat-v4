import type {Pool} from 'pg';
import {pool} from '../../database/pool.js';
/** Internal only: never pass this record to controllers, browser data or events. */
export interface SyncVendor {
  id: string;
  url: string;
  username: string;
  password_encrypted: string;
  is_active: boolean;
  last_sequence: string | null;
}
export interface SyncRepository {
  activeIds(): Promise<string[]>;
  get(id: string): Promise<SyncVendor | undefined>;
}
/** Configuration reads; DurableSyncRepository owns transactional progress writes. */
export class VendorSyncRepository implements SyncRepository {
  constructor(private readonly database: Pool = pool) {}
  async activeIds(): Promise<string[]> {
    return (await this.database.query<{id: string}>('SELECT id FROM vendors WHERE is_active=true ORDER BY id')).rows.map(row => row.id);
  }
  async get(id: string): Promise<SyncVendor | undefined> {
    return (await this.database.query<SyncVendor>('SELECT id,url,username,password_encrypted,is_active,last_sequence FROM vendors WHERE id=$1', [id])).rows[0];
  }
}
