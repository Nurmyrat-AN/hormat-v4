import {setTimeout as delay} from 'node:timers/promises';
import type {VendorCredentials} from '../credentials.js';
import {VendorEvents} from '../events.js';
import type {SyncOptions} from './config.js';
import type {SyncRepository, SyncVendor} from './repository.js';
import {BatchScheduler} from './scheduler.js';
import {nanoTransport, SyncFailure, type ChangesTransport} from './transport.js';
import {VendorSyncWorker, processBatch, retryDelay, type BatchProcessor, type SyncLog, type BatchPreparation} from './worker.js';

export class SyncControlBusy extends Error {}

export class VendorSyncManager {
  private workers = new Map<string, VendorSyncWorker>();
  private memory = new Map<string, {url: string; sequence: string | number}>();
  private pending = new Map<string, Promise<void>>();
  private dirty = new Set<string>();
  private resets = new Map<string, Promise<unknown>>();
  private unsubscribe?: () => void;
  private abort = new AbortController();
  private running = false;
  private starting?: Promise<void>;
  private stopping?: Promise<void>;
  private scheduler: BatchScheduler;
  constructor(private readonly repository: SyncRepository,
    private readonly credentials: Pick<VendorCredentials, 'decryptSecret'>,
    private readonly events: VendorEvents, private readonly options: SyncOptions,
    private readonly transport: (vendor: SyncVendor, password: string, options: SyncOptions) => ChangesTransport = nanoTransport,
    private readonly processor: BatchProcessor = processBatch,
    private readonly log: SyncLog = (event, fields) => console.info(JSON.stringify({component: 'VendorSync', event, ...fields})),
    private readonly prepare?:BatchPreparation) {
    this.scheduler = new BatchScheduler(options.maxConcurrentBatches);
  }
  start(): Promise<void> {
    if (this.stopping) return this.stopping.then(() => this.start());
    if (this.starting) return this.starting;
    if (!this.options.enabled) return Promise.resolve();
    this.running = true;
    this.abort = new AbortController();
    this.unsubscribe = this.events.subscribe(event => { void this.refresh(event.vendorId); });
    this.starting = this.initialize();
    return this.starting;
  }
  private async initialize(): Promise<void> {
    // PostgreSQL failures must not become unhandled rejections or hot polling loops.
    let attempt = 0;
    while (this.running) {
      try {
        const ids = await this.repository.activeIds();
        if (this.running) await Promise.all(ids.map(id => this.refresh(id)));
        return;
      } catch {
        this.log('configuration-retry', {attempt: ++attempt});
        await delay(retryDelay(attempt, this.options), undefined, {signal: this.abort.signal}).catch(() => undefined);
      }
    }
  }
  /** Serializes/coalesces lifecycle notifications; always reloads authoritative configuration. */
  refresh(id: string): Promise<void> {
    if (!this.running) return Promise.resolve();
    this.dirty.add(id);
    if (this.resets.has(id)) return Promise.resolve();
    const existing = this.pending.get(id);
    if (existing) return existing;
    const task = this.reconcile(id).finally(() => { this.pending.delete(id); });
    this.pending.set(id, task);
    return task;
  }
  private async reconcile(id: string, resume = false): Promise<void> {
    let attempt = 0;
    while (this.running && (resume || !this.resets.has(id)) && this.dirty.delete(id)) {
      try {
        let vendor = await this.repository.get(id);
        if (!this.running || (!resume && this.resets.has(id))) return;
        if (this.dirty.has(id)) continue;
        const old = this.workers.get(id);
        if (vendor?.is_active && old && old.vendor.url === vendor.url &&
            old.vendor.username === vendor.username && old.vendor.password_encrypted === vendor.password_encrypted) continue;
        if (old) {
          await old.stop();
          this.memory.set(id, {url: old.vendor.url, sequence: old.status().currentSequence});
          this.workers.delete(id);
          if(this.prepare)vendor=await this.repository.get(id);
        }
        if (!this.running || (!resume && this.resets.has(id))) return;
        if (this.dirty.has(id)) continue;
        if (!vendor) { this.memory.delete(id); continue; }
        if (!vendor.is_active) continue;
        const previous = this.prepare ? undefined : this.memory.get(id);
        const sequence = previous ? (previous.url === vendor.url ? previous.sequence : '0') : vendor.last_sequence ?? '0';
        const worker = new VendorSyncWorker(vendor, this.options, this.scheduler, () => {
          let password: string;
          try { password = this.credentials.decryptSecret(vendor.password_encrypted); }
          catch { throw new SyncFailure('CREDENTIAL_DECRYPTION', true); }
          return this.transport(vendor, password, this.options);
        }, this.processor, this.log, sequence, this.prepare);
        this.workers.set(id, worker);
        worker.start();
        if (resume && !await worker.initialConnectionReady()) throw new Error('SYNC_RESTART_FAILED');
        attempt = 0;
      } catch {
        if (resume) throw new Error('SYNC_RESTART_FAILED');
        if (!this.running) return;
        this.log('configuration-retry', {vendorId: id, attempt: ++attempt});
        this.dirty.add(id);
        await delay(retryDelay(attempt, this.options), undefined, {signal: this.abort.signal}).catch(() => undefined);
      }
    }
  }
  /** Single enabled process: exclude lifecycle refreshes until stop + transaction + reload finish. */
  withPausedVendor<T>(id: string, operation: () => Promise<T>): Promise<{value:T; restartPending:boolean}> {
    if (this.resets.has(id) || this.stopping) return Promise.reject(new SyncControlBusy());
    // Reserve synchronously before any await, including the first repository lookup.
    const task = Promise.resolve().then(async () => {
      let stopped = false;
      let restartPending = false;
      let value!: T;
      try {
        await this.pending.get(id);
        const old = this.workers.get(id);
        if (old) await old.stop(); // Includes in-flight durable commit/rollback and transport close.
        this.workers.delete(id);
        this.memory.delete(id);
        stopped = true;
        value = await operation();
      } finally {
        if (stopped) {
          try {
            if (this.running) {
              this.dirty.add(id);
              await this.reconcile(id, true); // One bounded configuration attempt; retry after releasing gate.
              const status = this.workers.get(id)?.status();
              restartPending = this.running ? Boolean(status?.lastError)
                : Boolean((await this.repository.get(id))?.is_active);
            } else {
              restartPending = Boolean((await this.repository.get(id))?.is_active);
            }
          } catch {
            restartPending = true;
            this.dirty.add(id);
            this.log('reset-restart-pending', {vendorId:id});
          }
        }
      }
      return {value, restartPending};
    }).finally(() => {
      this.resets.delete(id);
      if (this.running && this.dirty.has(id)) void this.refresh(id);
    });
    this.resets.set(id, task);
    return task;
  }
  getStatus() { return [...this.workers.values()].map(worker => worker.status()); }
  stop(): Promise<void> {
    if (this.stopping) return this.stopping;
    this.running = false;
    this.unsubscribe?.(); this.unsubscribe = undefined;
    this.abort.abort();
    this.stopping = (async () => {
      await Promise.all([...this.workers.values()].map(worker => worker.stop()));
      await this.starting;
      await Promise.all(this.pending.values());
      await Promise.allSettled(this.resets.values());
      this.workers.clear(); this.memory.clear(); this.dirty.clear(); this.pending.clear();
      this.starting = undefined;
    })().finally(() => { this.stopping = undefined; });
    return this.stopping;
  }
}
