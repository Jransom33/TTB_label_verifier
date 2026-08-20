import type { ConfidenceLevel } from "@/domain/extracted-label";
import type { VerificationField } from "@/domain/verification-rules";

// These statuses and outcomes form the documented public API contract.
export type FieldStatus = "match" | "mismatch" | "missing" | "unreadable";
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
