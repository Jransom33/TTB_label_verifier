import type { ConfidenceLevel } from "@/domain/extracted-label";
import type { VerificationField } from "@/domain/verification-rules";

/*
 * These statuses and outcomes form the documented public API contract.
 * `needs_review` is the field-level counterpart of the overall outcome: the
 * provider judged the value equivalent, but it was not an exact match.
 */
export type FieldStatus =
  | "match"
  | "needs_review"
  | "mismatch"
  | "missing"
  | "unreadable";
export type VerificationOutcome = "pass" | "fail" | "needs_review";

export type FieldResult = {
  field: VerificationField;
  expected: string | null;
  extracted: string | null;
  status: FieldStatus;
  confidence: ConfidenceLevel;
  explanation: string | null;
};

export type VerificationResult = {
  outcome: VerificationOutcome;
  fields: FieldResult[];
};
