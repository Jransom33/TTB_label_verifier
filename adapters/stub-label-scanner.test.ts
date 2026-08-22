import { stubLabelScanner, type StubOverrides } from "@/adapters/stub-label-scanner";
import type { ApplicationData } from "@/domain/application";
import { LABEL_FIELDS, type JudgedField } from "@/domain/extracted-label";
import { GOVERNMENT_WARNING_RULE } from "@/domain/verification-rules";
import { expect, test } from "vitest";

const image = { bytes: new Uint8Array([1]), mediaType: "image/png" as const };

const requiredApplication = {
  beverageType: "distilled_spirits",
  brandName: "OLD TOM DISTILLERY",
  classType: "Kentucky Straight Bourbon Whiskey",
  alcoholContent: "45% Alc./Vol. (90 Proof)",
  netContents: "750 mL",
} satisfies ApplicationData;

const application = {
  ...requiredApplication,
  producer: "Old Tom Distillery, Louisville, KY",
  countryOfOrigin: "United States",
} satisfies ApplicationData;

const scan = (data: ApplicationData, overrides: StubOverrides = {}) =>
  stubLabelScanner(overrides).scan(image, data);

const readable = (value: string | boolean) => ({
  status: "readable",
  value,
  confidence: "high",
});

/** Every supplied value comes back as read, so the default scan agrees with the application. */
test("supplied fields are readable with a match verdict", async () => {
  const { fields } = await scan(application);

  expect(LABEL_FIELDS.map((field) => fields[field])).toEqual(
    LABEL_FIELDS.map((field) => ({ ...readable(application[field]), verdict: "match" })),
  );
});

/** ExtractedLabel is a total record, so omitted optionals still need a key. */
test("omitted optional fields are reported missing", async () => {
  const { fields } = await scan(requiredApplication);
  const absent = { status: "missing", value: null, confidence: "high" };

  expect(fields.producer).toEqual(absent);
  expect(fields.countryOfOrigin).toEqual(absent);
});

/** Warning wording comes from the TTB rule, since the application never declares it. */
test("the warning defaults to the rule wording with a bold heading", async () => {
  const { governmentWarning } = await scan(application);

  expect(governmentWarning).toEqual({
    heading: readable(GOVERNMENT_WARNING_RULE.heading),
    text: readable(GOVERNMENT_WARNING_RULE.body),
    headingIsBold: readable(true),
  });
});

/** Overrides replace one piece of evidence and leave the rest derived. */
test("overrides replace only the evidence they name", async () => {
  const brandName: JudgedField = { status: "unreadable", value: null, confidence: "low" };
  const headingIsBold = { status: "readable", value: false, confidence: "high" } as const;

  const { fields, governmentWarning } = await scan(application, {
    brandName,
    governmentWarning: { headingIsBold },
  });

  expect(fields.brandName).toEqual(brandName);
  expect(fields.classType).toEqual({ ...readable(application.classType), verdict: "match" });
  expect(governmentWarning).toEqual({
    heading: readable(GOVERNMENT_WARNING_RULE.heading),
    text: readable(GOVERNMENT_WARNING_RULE.body),
    headingIsBold,
  });
});
