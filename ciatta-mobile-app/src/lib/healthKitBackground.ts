export type BackgroundDeliveryQueue = {
  notify: (identifier: string) => void;
};

export function createBackgroundDeliveryQueue(opts: {
  sync: (identifiers: string[]) => Promise<void>;
  debounceMs?: number;
  schedule?: (fn: () => Promise<void>, ms: number) => { cancel: () => void };
}): BackgroundDeliveryQueue {
  const debounceMs = opts.debounceMs ?? 750;
  const schedule =
    opts.schedule ??
    ((fn, ms) => {
      const id = setTimeout(() => {
        void fn();
      }, ms);
      return { cancel: () => clearTimeout(id) };
    });

  const pending = new Set<string>();
  let timer: { cancel: () => void } | null = null;
  let running: Promise<void> = Promise.resolve();

  const flush = async () => {
    timer = null;
    const identifiers = [...pending];
    pending.clear();
    if (identifiers.length === 0) return;
    await opts.sync(identifiers);
  };

  return {
    notify(identifier: string) {
      pending.add(identifier);
      timer?.cancel();
      timer = schedule(() => {
        running = running.then(flush, flush);
        return running;
      }, debounceMs);
    },
  };
}
