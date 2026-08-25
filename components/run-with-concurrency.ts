/**
 * Runs asynchronous work with a fixed number of workers while preserving item
 * order. Each result is settled independently, so one failure cannot stop the
 * rest of the batch.
 */
export async function runWithConcurrency<Item, Result>(
  items: readonly Item[],
  limit: number,
  worker: (item: Item, index: number) => Promise<Result>,
): Promise<PromiseSettledResult<Result>[]> {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new RangeError("Concurrency limit must be a positive integer.");
  }

  const results = new Array<PromiseSettledResult<Result>>(items.length);
  let nextIndex = 0;

  async function runWorker() {
    // JavaScript runs this index assignment synchronously, so workers cannot
    // claim the same item before yielding to asynchronous work.
    while (nextIndex < items.length) {
      const index = nextIndex++;
      try {
        results[index] = { status: "fulfilled", value: await worker(items[index], index) };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => runWorker()),
  );
  return results;
}
