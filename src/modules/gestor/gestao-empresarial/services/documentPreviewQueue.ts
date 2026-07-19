const MAX_CONCURRENT_PREVIEWS = 2;

type QueueItem = {
  run: () => Promise<void>;
  resolve: () => void;
};

const queue: QueueItem[] = [];
let running = 0;

const drainQueue = () => {
  while (running < MAX_CONCURRENT_PREVIEWS && queue.length > 0) {
    const item = queue.shift();
    if (!item) return;

    running += 1;
    void item.run()
      .catch(() => undefined)
      .finally(() => {
        running -= 1;
        item.resolve();
        drainQueue();
      });
  }
};

export const enqueueDocumentPreview = (run: () => Promise<void>) => (
  new Promise<void>((resolve) => {
    queue.push({ run, resolve });
    drainQueue();
  })
);
