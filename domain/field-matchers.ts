import {
  lowestConfidence,
  type ConfidenceLevel,
  type GovernmentWarningEvidence,
  type JudgedField,
  type LabelField,
} from "@/domain/extracted-label";
import { normalizeText, normalizeWarningText } from "@/domain/normalizers";
import {
  FIELD_COMPARISON_RULES,
  GOVERNMENT_WARNING_RULE,
} from "@/domain/verification-rules";
import type { FieldResult, FieldStatus } from "@/domain/verification";

export type FieldMatch =
  | { field: LabelField; expected: string; evidence: JudgedField }
  | { field: "governmentWarning"; evidence: GovernmentWarningEvidence };

// Assumption: these sentences are the public explanations; confirm the wording.
const EXPLANATIONS: Record<FieldStatus, string | null> = {
  match: null,
  needs_review: "Values are equivalent but not identical.",
  mismatch: "Extracted value does not match the application.",
  missing: "This field was not found on the label.",
  unreadable: "This field could not be read from the label.",
};

const isWarning = (
  input: FieldMatch,
): input is Extract<FieldMatch, { field: "governmentWarning" }> =>
  FIELD_COMPARISON_RULES[input.field] === "exact_warning";

/*
 * Compare one expected application value against one scanned field.
 * Reported strings stay as they arrived; only the comparison is normalized.
 */
const matchText = ({
  field,
  expected,
  evidence,
}: Extract<FieldMatch, { field: LabelField }>): FieldResult => {
  if (evidence.status !== "readable") {
    return {
      field,
      expected,
      extracted: null,
      status: evidence.status,
      confidence: evidence.confidence,
      explanation: EXPLANATIONS[evidence.status],
    };
  }

  const status: FieldStatus =
    normalizeText(expected) === normalizeText(evidence.value)
      ? "match"
      : evidence.verdict === "match"
        ? "needs_review"
        : "mismatch";

  return {
    field,
    expected,
    extracted: evidence.value,
    status,
    confidence: evidence.confidence,
    explanation: EXPLANATIONS[status],
  };
};

/*
 * Check the government warning against the versioned TTB wording.
 * Assumption: expected/extracted join heading and body with one space.
 */
const matchWarning = (evidence: GovernmentWarningEvidence): FieldResult => {
  const expected = `${GOVERNMENT_WARNING_RULE.heading} ${GOVERNMENT_WARNING_RULE.body}`;
  const { heading, text, headingIsBold } = evidence;

  const result = (
    status: FieldStatus,
    extracted: string | null,
    ...confidences: ConfidenceLevel[]
  ): FieldResult => ({
    field: "governmentWarning",
    expected,
    extracted,
    status,
    confidence: lowestConfidence(...confidences),
    explanation: EXPLANATIONS[status],
  });

  if (heading.status !== "readable" || text.status !== "readable") {
    // Unreadable outranks missing among the two text pieces.
    const status =
      heading.status === "unreadable" || text.status === "unreadable"
        ? "unreadable"
        : "missing";
    return result(status, null, heading.confidence, text.confidence);
  }

  const extracted = `${heading.value} ${text.value}`;
  const wordingMatches =
    normalizeWarningText(heading.value) ===
      normalizeWarningText(GOVERNMENT_WARNING_RULE.heading) &&
    normalizeWarningText(text.value) ===
      normalizeWarningText(GOVERNMENT_WARNING_RULE.body);

  if (!wordingMatches) {
    return result("mismatch", extracted, heading.confidence, text.confidence);
  }

  // Wording is exact. Unreadable boldness is needs_review, not a pass-through.
  if (headingIsBold.status !== "readable") {
    return result(
      "needs_review",
      extracted,
      heading.confidence,
      text.confidence,
      headingIsBold.confidence,
    );
  }

  // Open question resolved: correct wording under a non-bold heading is mismatch.
  return result(
    headingIsBold.value ? "match" : "mismatch",
    extracted,
    heading.confidence,
    text.confidence,
    headingIsBold.confidence,
  );
};

export const matchField = (input: FieldMatch): FieldResult =>
  isWarning(input) ? matchWarning(input.evidence) : matchText(input);
