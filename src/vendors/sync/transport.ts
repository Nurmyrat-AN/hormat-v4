import nano from 'nano';
import {Agent} from 'undici';
import type {SyncVendor} from './repository.js';
import type {SyncOptions} from './config.js';
export interface Change {id: string; deleted?: boolean; doc?: Record<string, unknown> | null}
export interface ChangesBatch {results: Change[]; last_seq: string | number}
export interface ChangesTransport {
  changes(since: string | number, signal: AbortSignal): Promise<ChangesBatch>;
  close(): Promise<void>;
  fetchDocuments?(ids:string[], signal:AbortSignal):Promise<Change[]>;
  info?(): Promise<{doc_count:number;doc_del_count:number}>;
}
export class SyncFailure extends Error {
  constructor(readonly code: 'INVALID_URL' | 'CREDENTIAL_DECRYPTION' | 'INVALID_BATCH' | 'AUTHENTICATION' | 'CONNECTION' | 'PROCESSING' | 'DECODE_FAILED' | 'MALFORMED_SOURCE' | 'UNKNOWN_TRANSACTION_TYPE' | 'MISSING_DEPENDENCY' | 'BATCH_LIMIT' | 'SOURCE_CHANGED' | 'STALE_CHECKPOINT' | 'VENDOR_PAUSED', readonly permanent = false) { super(code); }
}
export function nanoTransport(vendor: SyncVendor, password: string, options: SyncOptions): ChangesTransport {
  let url: URL;
  try {
    url = new URL(vendor.url);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname === '/') throw new Error();
  } catch { throw new SyncFailure('INVALID_URL', true); }
  const dispatcher = new Agent({connections: 1, pipelining: 1});
  // Nano 11 supports parseUrl and request.signal at runtime; its declarations omit them.
  // Preserve the full stored database path (including reverse-proxy prefixes/encoded slashes).
  const settings = {url: url.href, parseUrl: false,
    agentOptions: dispatcher as unknown as nano.Configuration['agentOptions'],
    headers: {Authorization: `Basic ${Buffer.from(`${vendor.username}:${password}`).toString('base64')}`}};
  let client: nano.ServerScope | undefined = nano(settings);
  return {
    async changes(since, signal) {
      const request: nano.RequestOptions & {signal: AbortSignal} = {
        path: '_changes', method: 'GET',
        qs: {feed: 'longpoll', since, limit: options.batchSize, include_docs: true, timeout: options.longpollTimeoutMs},
        signal: AbortSignal.any([signal, AbortSignal.timeout(options.longpollTimeoutMs + 5000)]),
      };
      try { return await client!.request(request) as ChangesBatch; }
      catch (error) {
        const status = (error as {statusCode?: number})?.statusCode;
        throw new SyncFailure(status === 401 || status === 403 ? 'AUTHENTICATION' : 'CONNECTION');
      }
    },
    async fetchDocuments(ids, signal) {
      try {
        const result = await client!.request({path:'_all_docs',method:'POST',qs:{include_docs:true},body:{keys:ids},
          signal:AbortSignal.any([signal,AbortSignal.timeout(30000)])} as nano.RequestOptions & {signal:AbortSignal});
        return result.rows.filter((row: {doc?:unknown}) => row.doc).map((row:{id:string;doc:Record<string,unknown>})=>({id:row.id,doc:row.doc}));
      } catch {throw new SyncFailure('CONNECTION');}
    },
    async info() {
      try { const result=await client!.request({method:'GET',signal:AbortSignal.timeout(10000)} as nano.RequestOptions & {signal:AbortSignal}); return {doc_count:result.doc_count,doc_del_count:result.doc_del_count}; }
      catch {throw new SyncFailure('CONNECTION');}
    },
    async close() { client = undefined; await dispatcher.destroy(); },
  };
}
