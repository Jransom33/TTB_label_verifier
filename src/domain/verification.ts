/*
 * Assumption: field statuses and outcomes match the documented API contract.
 * Confirm whether confidence is 0-1 or 0-100, and whether image-quality issues
 * stay as strings or become structured objects.
 */
export type FieldStatus = "match" | "mismatch" | "missing" | "unreadable";
export type VerificationOutcome = "pass" | "fail" | "needs_review";

export type FieldResult = {
  field: string;
  expected: string | null;
  extracted: string | null;
  status: FieldStatus;
  confidence: number;
  explanation: string | null;
};

export type VerificationResult = {
  outcome: VerificationOutcome;
  fields: FieldResult[];
  imageQualityIssues: string[];
};
