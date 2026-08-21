import { LABEL_FIELDS, type LabelField } from "@/domain/extracted-label";
import { overallOutcome } from "@/domain/overall-outcome";
import type { FieldResult, VerificationResult } from "@/domain/verification";
import type { VerificationRequest } from "@/server/verification-request";

/*
 * Incomplete: no extraction, normalization, or warning-text check.
 */
function unreadField(field: LabelField, expected: string): FieldResult {
  return {
    field,
    expected,
    extracted: null,
    status: "unreadable",
    confidence: "low",
    explanation: "Label text has not been extracted yet.",
  };
}

export async function verifyLabel(input: VerificationRequest): Promise<VerificationResult> {
  /*
   * Shared pipeline entry point for single and later batch verification.
   * Analysis, normalization, and comparison are later components, so every
   * supplied label field is returned as unreadable. The image is accepted
   * but not inspected here.
   */

  // Keep the image on the function contract for later OCR; ignore it for now.
  void input.image;

  const application = input.applicationData;

  // Build one result per label field. flatMap can return zero or one item.
  const fields = LABEL_FIELDS.flatMap((field) => {
    const expected = application[field];

    // Optional fields are omitted when the application did not supply them.
    return expected === undefined ? [] : [unreadField(field, expected)];
  });

  // Outcome comes from field statuses and confidences, never from label text.
  return { outcome: overallOutcome(fields), fields };
}
