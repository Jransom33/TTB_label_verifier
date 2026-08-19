import { expect, test } from "vitest";
import { applicationDataSchema, BEVERAGE_TYPES } from "@/domain/application";

/*
 * Assumption: "Wine" / "spirits" stay invalid; only the three snake/lowercase tokens
 * are accepted. Follow-up: no route-level invalid-beverageType case (schema only).
 */
const labelFields = {
  brandName: "OLD TOM DISTILLERY",
  classType: "Kentucky Straight Bourbon Whiskey",
  alcoholContent: "45% Alc./Vol. (90 Proof)",
  netContents: "750 mL",
};

/** Each confirmed commodity token is a valid `beverageType`. */
test.each([...BEVERAGE_TYPES])("accepts beverageType %s", (beverageType) => {
  expect(applicationDataSchema.parse({ ...labelFields, beverageType }).beverageType).toBe(
    beverageType,
  );
});

/** Surrounding whitespace is stripped before the enum match. */
test("trims beverageType before matching the enum", () => {
  expect(
    applicationDataSchema.parse({ ...labelFields, beverageType: "  wine  " }).beverageType,
  ).toBe("wine");
});

/** Aliases, mixed case, and blank values are not coerced into a valid type. */
test.each(["spirits", "Wine", ""])("rejects beverageType %s", (beverageType) => {
  expect(applicationDataSchema.safeParse({ ...labelFields, beverageType }).success).toBe(
    false,
  );
});

/** Extra JSON keys are rejected by the strict application schema. */
test("rejects unknown application keys", () => {
  expect(
    applicationDataSchema.safeParse({
      ...labelFields,
      beverageType: "beer",
      extra: "nope",
    }).success,
  ).toBe(false);
});
