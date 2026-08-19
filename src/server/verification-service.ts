import type { ApplicationData } from "@/domain/application";
import type { FieldResult, VerificationResult } from "@/domain/verification";
import type { VerificationRequest } from "@/server/verification-request";

/*
 * Assumptions to confirm: these are the label fields to check, beverageType is
 * metadata only, and optional producer/country fields are omitted when absent.
 * Incomplete: no extraction, normalization, warning-text check, or real outcome.
 */
const LABEL_FIELDS = [
  "brandName",
  "classType",
  "alcoholContent",
  "netContents",
  "producer",
  "countryOfOrigin",
] as const;

function unreadField(field: string, expected: string | undefined): FieldResult {
  return {
    field,
    expected: expected ?? null,
    extracted: null,
    status: "unreadable",
    confidence: 0,
    explanation: "Label text has not been extracted yet.",
  };
}

export async function verifyLabel(input: VerificationRequest): Promise<VerificationResult> {
  /*
   * Shared pipeline entry point for single and later batch verification.
   * Analysis, normalization, and comparison are later components, so every
   * supplied label field is returned as unreadable and the overall outcome
   * is needs_review. The image is accepted but not inspected here.
   */

  // Keep the image on the function contract for later OCR; ignore it for now.
  void input.image;

  const application: ApplicationData = input.applicationData;

  // Build one result per label field. flatMap can return zero or one item.
  const fields = LABEL_FIELDS.flatMap((field) => {
    const expected = application[field];

    // Optional fields are verified only when the application supplied them.
    if (field === "producer" || field === "countryOfOrigin") {
      return expected ? [unreadField(field, expected)] : [];
    }

    // Required fields always appear in the response, even before extraction exists.
    return [unreadField(field, expected)];
  });

  // Unreadable fields must not pass or fail; send the whole result to human review.
  return { outcome: "needs_review", fields, imageQualityIssues: [] };
}
