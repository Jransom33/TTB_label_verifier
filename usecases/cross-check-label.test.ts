import { stubLabelScanner } from "@/adapters/stub-label-scanner";
import { unreadLabelScanner } from "@/adapters/unread-label-scanner";
import type { ApplicationData } from "@/domain/application";
import { LABEL_FIELDS, type JudgedField } from "@/domain/extracted-label";
import { VERIFICATION_FIELDS } from "@/domain/verification-rules";
import { crossCheckLabel } from "@/usecases/cross-check-label";
import type { LabelScanner } from "@/usecases/ports/label-scanner";
import { expect, test } from "vitest";

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

/** Runs the real pipeline against an offline scanner, defaulting to the stub. */
const crossCheck = (
  applicationData: ApplicationData,
  scanner: LabelScanner = stubLabelScanner(),
) =>
  crossCheckLabel(
    { applicationData, image: { bytes: new Uint8Array([1]), mediaType: "image/png" } },
    scanner,
  );

/** The warning is verified too, even though the application never supplies it. */
test("a full application passes with every verification field reported", async () => {
  const { outcome, fields } = await crossCheck(application);

  expect(fields.map((field) => field.field)).toEqual([...VERIFICATION_FIELDS]);
  expect(fields.map((field) => field.extracted)).toEqual(fields.map((field) => field.expected));
  expect(outcome).toBe("pass");
});

/** An optional the application omitted is not verified, so it cannot fail. */
test("omitted optional fields produce no field result", async () => {
  const { outcome, fields } = await crossCheck(requiredApplication);

  expect(fields.map((field) => field.field)).toEqual([
    ...LABEL_FIELDS.slice(0, 4),
    "governmentWarning",
  ]);
  expect(outcome).toBe("pass");
});

const unread: JudgedField = { status: "unreadable", value: null, confidence: "high" };
const rejected: JudgedField = {
  status: "readable",
  value: "other",
  confidence: "high",
  verdict: "mismatch",
};

/** One field is enough to reach each non-pass outcome through the real matchers. */
test.each([
  { name: "an unreadable brand name", brandName: unread, outcome: "needs_review" },
  { name: "a rejected brand name", brandName: rejected, outcome: "fail" },
  {
    name: "an equivalent brand name",
    brandName: { ...rejected, verdict: "match" } as JudgedField,
    outcome: "needs_review",
  },
])("$name yields $outcome", async ({ brandName, outcome }) => {
  const result = await crossCheck(application, stubLabelScanner({ brandName }));

  expect(result.outcome).toBe(outcome);
});

/** Correct wording under a heading that is not bold is a mismatch, so the request fails. */
test("a non-bold warning heading fails the verification", async () => {
  const { outcome, fields } = await crossCheck(
    application,
    stubLabelScanner({
      governmentWarning: {
        headingIsBold: { status: "readable", value: false, confidence: "high" },
      },
    }),
  );

  expect(fields.at(-1)).toMatchObject({ field: "governmentWarning", status: "mismatch" });
  expect(outcome).toBe("fail");
});

/** Until a provider exists, the wired scanner reads nothing and nothing passes. */
test("the placeholder scanner reports every field unreadable", async () => {
  const { outcome, fields } = await crossCheck(application, unreadLabelScanner);

  expect(fields.map((field) => field.status)).toEqual(VERIFICATION_FIELDS.map(() => "unreadable"));
  expect(outcome).toBe("needs_review");
});
