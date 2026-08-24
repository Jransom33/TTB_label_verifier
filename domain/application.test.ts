import { expect, test } from "vitest";
import { applicationDataSchema } from "@/domain/application";

const labelFields = {
  brandName: "OLD TOM DISTILLERY",
  classType: "Kentucky Straight Bourbon Whiskey",
  alcoholContent: "45% Alc./Vol. (90 Proof)",
  netContents: "750 mL",
};

/** The four required label fields alone form a valid application. */
test("accepts the required label fields", () => {
  expect(applicationDataSchema.parse(labelFields)).toEqual(labelFields);
});

/** Extra JSON keys are rejected by the strict application schema. */
test("rejects unknown application keys", () => {
  expect(
    applicationDataSchema.safeParse({
      ...labelFields,
      extra: "nope",
    }).success,
  ).toBe(false);
});
