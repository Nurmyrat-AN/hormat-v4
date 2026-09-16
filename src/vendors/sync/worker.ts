import {setTimeout as delay} from 'node:timers/promises';
import type {SyncOptions} from './config.js';
import type {SyncVendor} from './repository.js';
import {BatchScheduler} from './scheduler.js';
import {SyncFailure, type ChangesBatch, type ChangesTransport} from './transport.js';
export interface BatchCounts {changes: number; documents: number; deletions: number; designDocuments: number}
export interface BatchContext {vendor:SyncVendor;transport:ChangesTransport;since:string|number}
export type BatchPreparation=(vendor:SyncVendor,transport:ChangesTransport,signal:AbortSignal,schedule?: (task:()=>Promise<void>)=>Promise<void>)=>Promise<string|number>;
export type BatchProcessor = (vendorId: string, batch: ChangesBatch, signal: AbortSignal, context?:BatchContext) => Promise<BatchCounts>;
export type SyncLog = (event: string, fields: Record<string, string | number>) => void;
export const processBatch: BatchProcessor = async (_id, batch, signal) => {
  signal.throwIfAborted();
  const counts = {changes: batch.results.length, documents: 0, deletions: 0, designDocuments: 0};
  for (const change of batch.results) {
    if (change.id.startsWith('_design/') || change.id.startsWith('_local/')) { counts.designDocuments++; continue; }
    if (change.deleted || change.doc?._deleted === true) counts.deletions++;
    if (change.doc) counts.documents++;
  }
  return counts;
};
export function retryDelay(attempt: number, options: SyncOptions, random = Math.random): number {
  const cap = Math.min(options.retryMaxMs, options.retryMinMs * 2 ** Math.min(attempt, 30));
  return Math.floor(options.retryMinMs + random() * (cap - options.retryMinMs));
}
export interface WorkerStatus {
  vendorId: string; running: boolean; currentSequence: string | number;
  lastBatchSize: number; lastBatchAt: string | null;
  connectionState: 'starting' | 'listening' | 'processing' | 'retrying' | 'error' | 'stopped';
  retryAttempt: number; lastError: string | null;
  counts: BatchCounts;
}
export class VendorSyncWorker {
  private abort = new AbortController();
  private task?: Promise<void>;
  private resolveFirstConnection!: (ready: boolean) => void;
  private readonly firstConnection = new Promise<boolean>(resolve => { this.resolveFirstConnection = resolve; });
  private state: WorkerStatus;
  constructor(readonly vendor: SyncVendor, private readonly options: SyncOptions,
    private readonly scheduler: BatchScheduler, private readonly connect: () => ChangesTransport,
    private readonly processor: BatchProcessor, private readonly log: SyncLog,
    sequence: string | number = vendor.last_sequence ?? '0', private readonly prepare?:BatchPreparation) {
    this.state = {vendorId: vendor.id, running: false, currentSequence: sequence, lastBatchSize: 0,
      lastBatchAt: null, connectionState: 'starting', retryAttempt: 0, lastError: null,
      counts: {changes: 0, documents: 0, deletions: 0, designDocuments: 0}};
  }
  status(): WorkerStatus { return {...this.state, counts: {...this.state.counts}}; }
  start(): void { this.task ??= this.run(); }
  /** Only initial credential/transport setup; historical bootstrap and remote I/O stay asynchronous. */
  initialConnectionReady(): Promise<boolean> { return this.firstConnection; }
  async stop(): Promise<void> { this.abort.abort(); await this.task; }
  private async run(): Promise<void> {
    const signal = this.abort.signal;
    this.state.running = true;
    this.log('started', {vendorId: this.vendor.id});
    let transport: ChangesTransport | undefined;
    try {
      while (!signal.aborted) {
        try {
          if(!transport){transport=this.connect();this.resolveFirstConnection(true);if(this.prepare)this.state.currentSequence=await this.prepare(this.vendor,transport,signal,task=>this.scheduler.run(signal,task));}
          this.state.connectionState = 'listening';
          const batch = await transport.changes(this.state.currentSequence, signal);
          signal.throwIfAborted();
          if (!batch || !Array.isArray(batch.results) || batch.results.length > this.options.batchSize ||
              !['string','number'].includes(typeof batch.last_seq) ||
              batch.results.some(row => !row || typeof row.id !== 'string' ||
                (row.doc != null && (typeof row.doc !== 'object' || Array.isArray(row.doc))))) throw new SyncFailure('INVALID_BATCH');
          this.state.connectionState = 'processing';
          const counts = await this.scheduler.run(signal, () => this.processor(this.vendor.id, batch, signal,{vendor:this.vendor,transport:transport!,since:this.state.currentSequence}));
          signal.throwIfAborted();
          this.state.currentSequence = batch.last_seq;
          this.state.lastBatchSize = batch.results.length;
          this.state.lastBatchAt = new Date().toISOString();
          this.state.counts = counts;
          this.state.retryAttempt = 0;
          this.state.lastError = null;
          if (batch.results.length) this.log('batch', {vendorId: this.vendor.id, ...counts});
          // Defensive floor for proxies/fakes returning an immediate empty longpoll.
          if (!batch.results.length) await delay(250, undefined, {signal});
        } catch (error) {
          await transport?.close().catch(() => undefined); transport = undefined;
          if (signal.aborted) break;
          const failure = error instanceof SyncFailure ? error : new SyncFailure('PROCESSING');
          this.state.lastError = failure.code;
          this.resolveFirstConnection(false);
          if (failure.permanent) { this.state.connectionState = 'error'; this.log('error', {vendorId: this.vendor.id, code: failure.code}); break; }
          this.state.connectionState = 'retrying';
          this.state.retryAttempt++;
          const waitMs = retryDelay(this.state.retryAttempt, this.options);
          this.log('retry', {vendorId: this.vendor.id, code: failure.code, attempt: this.state.retryAttempt, waitMs});
          await delay(waitMs, undefined, {signal}).catch(() => undefined);
        }
      }
    } finally {
      this.resolveFirstConnection(false);
      await transport?.close().catch(() => undefined);
      this.state.running = false;
      if (signal.aborted) this.state.connectionState = 'stopped';
      this.log('stopped', {vendorId: this.vendor.id});
    }
  }
}
