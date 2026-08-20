import type { ApplicationData } from "@/domain/application";
import { LABEL_FIELDS, type LabelField } from "@/domain/extracted-label";
import type { VerificationRequest } from "@/server/verification-request";
import { verifyLabel } from "@/server/verification-service";
import { expect, test } from "vitest";

const requiredApplication = {
  beverageType: "distilled_spirits",
  brandName: "OLD TOM DISTILLERY",
  classType: "Kentucky Straight Bourbon Whiskey",
  alcoholContent: "45% Alc./Vol. (90 Proof)",
  netContents: "750 mL",
} satisfies ApplicationData;

/** Builds the already-validated input expected by the service boundary. */
function request(applicationData: ApplicationData): VerificationRequest {
  return {
    applicationData,
    image: { bytes: new Uint8Array([1]), mediaType: "image/png" },
  };
}

/** Checks the current deterministic unreadable-field placeholder response. */
async function expectStubFields(
  applicationData: ApplicationData,
  expectedFields: readonly LabelField[],
) {
  const result = await verifyLabel(request(applicationData));

  expect(result).toEqual({
    outcome: "needs_review",
    fields: expectedFields.map((field) => ({
      field,
      expected: applicationData[field] ?? null,
      extracted: null,
      status: "unreadable",
      confidence: "low",
      explanation: "Label text has not been extracted yet.",
    })),
  });
  expect(result).not.toHaveProperty("imageQualityIssues");
}

/** Unsupplied optional application values must not create field results. */
test("omits optional fields that were not supplied", async () => {
  await expectStubFields(requiredApplication, LABEL_FIELDS.slice(0, 4));
});

/** Supplied optional application values must be included for later verification. */
test("includes optional fields that were supplied", async () => {
  const application = {
    ...requiredApplication,
    producer: "Old Tom Distillery, Louisville, KY",
    countryOfOrigin: "United States",
  };

  await expectStubFields(application, LABEL_FIELDS);
});
