import { runWithConcurrency } from "@/components/run-with-concurrency";
import { expect, test } from "vitest";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** The pool never runs more workers than the limit, and uses all of them. */
test("at most `limit` workers run at once", async () => {
  let active = 0;
  let peak = 0;

  await runWithConcurrency(Array.from({ length: 10 }, (_, i) => i), 3, async () => {
    peak = Math.max(peak, ++active);
    await wait(1);
    active--;
  });

  expect(peak).toBe(3);
});

/** Results stay in input order even when earlier items finish later. */
test("results are ordered by input, not completion", async () => {
  const results = await runWithConcurrency([30, 1, 10], 3, async (ms) => {
    await wait(ms);
    return ms;
  });

  expect(results).toEqual([
    { status: "fulfilled", value: 30 },
    { status: "fulfilled", value: 1 },
    { status: "fulfilled", value: 10 },
  ]);
});

/** One rejection is recorded in place and never stops the other items. */
test("a rejected item does not sink the rest", async () => {
  const results = await runWithConcurrency(["a", "boom", "c"], 2, async (item) => {
    if (item === "boom") throw new Error("boom");
    return item.toUpperCase();
  });

  expect(results).toEqual([
    { status: "fulfilled", value: "A" },
    { status: "rejected", reason: new Error("boom") },
    { status: "fulfilled", value: "C" },
  ]);
});

/** Zero, negative, and fractional limits are programmer errors. */
test.each([0, -1, 2.5])("a limit of %s throws a RangeError", async (limit) => {
  await expect(runWithConcurrency([1], limit, async () => {})).rejects.toThrow(RangeError);
});

/** An empty batch settles immediately with no results. */
test("no items yields no results", async () => {
  expect(await runWithConcurrency([], 4, async () => {})).toEqual([]);
});
