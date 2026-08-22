/**
 * Sequences one verification: scan the label, compare each field, derive the
 * outcome. It holds no rules of its own, knows nothing about HTTP, and reaches
 * any AI/OCR vendor only through the injected scanner port.
 */
import type { ApplicationData } from "@/domain/application";
import { LABEL_FIELDS } from "@/domain/extracted-label";
import { matchField } from "@/domain/field-matchers";
import { overallOutcome } from "@/domain/overall-outcome";
import type { VerificationResult } from "@/domain/verification";
import type { LabelImage, LabelScanner } from "@/usecases/ports/label-scanner";

// Validated input for one verification. The upload guard produces it; the image
// shape belongs to the scanner port so validation and scanning cannot drift apart.
export type VerificationRequest = {
  applicationData: ApplicationData;
  image: LabelImage;
};

export async function crossCheckLabel(
  { applicationData, image }: VerificationRequest,
  scanner: LabelScanner,
): Promise<VerificationResult> {
  /*
   * A rejected scan means the provider itself failed. It propagates untouched,
   * because mapping it to a public error code is the caller's job.
   */
  const extracted = await scanner.scan(image, applicationData);

  const fields = [
    // One result per supplied label field. flatMap drops omitted optionals.
    ...LABEL_FIELDS.flatMap((field) => {
      const expected = applicationData[field];
      return expected === undefined
        ? []
        : [matchField({ field, expected, evidence: extracted.fields[field] })];
    }),
    // The warning is always checked: TTB requires it on every label, and its
    // wording comes from the rule rather than from the application.
    matchField({ field: "governmentWarning", evidence: extracted.governmentWarning }),
  ];

  // Outcome comes from field statuses and confidences, never from label text.
  return { outcome: overallOutcome(fields), fields };
}
