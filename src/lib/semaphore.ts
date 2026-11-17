/**
 * A tiny counting semaphore for work that a single upstream server must do at
 * once. Pure and dependency-free so the ordering is testable.
 *
 * Used by the image route: a deck renders five cards, the browser asks for five
 * posters in parallel, and a media server that resizes each of them (Jellyfin does
 * that on the CPU, one core per request on a small box) answers the last one after
 * the request has already timed out — which is what issue #94 saw as a broken
 * image. Queueing them keeps each request's latency bounded instead.
 */
export interface Semaphore {
  /** Resolves with the task's result once a slot is free. */
  run<T>(task: () => Promise<T>): Promise<T>;
  /** Tasks waiting for a slot right now. */
  readonly waiting: number;
  /** Slots in use right now. */
  readonly active: number;
}

export function createSemaphore(limit: number): Semaphore {
  const slots = Math.max(1, Math.floor(limit) || 1);
  let active = 0;
  const queue: Array<() => void> = [];

  const acquire = async () => {
    if (active < slots) {
      active += 1;
      return;
    }
    await new Promise<void>((resolve) => queue.push(resolve));
    active += 1;
  };

  const release = () => {
    active -= 1;
    const next = queue.shift();
    if (next) next();
  };

  return {
    async run<T>(task: () => Promise<T>): Promise<T> {
      await acquire();
      try {
        return await task();
      } finally {
        release();
      }
    },
    get waiting() {
      return queue.length;
    },
    get active() {
      return active;
    },
  };
}
