/** FIFO, one queued batch at most per worker. Cancelled jobs release their batch immediately. */
export class BatchScheduler {
  private active = 0;
  private queue: Array<() => void> = [];
  constructor(private readonly limit: number) {
    if (!Number.isInteger(limit) || limit < 1) throw new Error('Invalid batch concurrency.');
  }
  run<T>(signal: AbortSignal, task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const cancel = () => {
        this.queue = this.queue.filter(item => item !== start);
        reject(new Error('Sync cancelled.'));
      };
      const start = () => {
        signal.removeEventListener('abort', cancel);
        if (signal.aborted) { cancel(); return; }
        this.active++;
        void Promise.resolve().then(task).then(resolve, reject).finally(() => {
          this.active--;
          this.queue.shift()?.();
        });
      };
      if (signal.aborted) { cancel(); return; }
      signal.addEventListener('abort', cancel, {once: true});
      if (this.active < this.limit) start(); else this.queue.push(start);
    });
  }
}
