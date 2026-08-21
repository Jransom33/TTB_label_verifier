import type {
  FieldResult,
  FieldStatus,
  VerificationOutcome,
} from "@/domain/verification";

/*
 * Status-to-outcome mapping is exhaustive over FieldStatus so a new status
 * is a compile error. This file is the only place the review bias lives.
 */
const OUTCOME_BY_STATUS = {
  match: "pass",
  mismatch: "fail",
  missing: "fail",
  needs_review: "needs_review",
  unreadable: "needs_review",
} as const satisfies Record<FieldStatus, VerificationOutcome>;

const SEVERITY = ["fail", "needs_review", "pass"] as const;

/**
 * Fold field statuses and confidences into one outcome.
 * Low confidence is never decisive; among the rest, fail beats needs_review
 * which beats pass. An empty list cannot pass.
 *
 * Assumption: `medium` and `high` are equally decisive; only `low` is gated.
 */
export const overallOutcome = (fields: FieldResult[]): VerificationOutcome => {
  // A low-confidence reading is never decisive, whatever it claimed.
  const outcomes = fields.map((field) =>
    field.confidence === "low" ? "needs_review" : OUTCOME_BY_STATUS[field.status],
  );
  // Most severe wins; no fields means nothing was verified, so it cannot pass.
  return SEVERITY.find((outcome) => outcomes.includes(outcome)) ?? "needs_review";
};
