import type { ConfidenceLevel } from "@/domain/extracted-label";
import { overallOutcome } from "@/domain/overall-outcome";
import type {
  FieldResult,
  FieldStatus,
  VerificationOutcome,
} from "@/domain/verification";
import { expect, test } from "vitest";

const result = (
  status: FieldStatus,
  confidence: ConfidenceLevel,
): FieldResult => ({
  field: "brandName",
  expected: "x",
  extracted: null,
  status,
  confidence,
  explanation: null,
});

const OUTCOME_BY_STATUS = {
  match: "pass",
  mismatch: "fail",
  missing: "fail",
  needs_review: "needs_review",
  unreadable: "needs_review",
} as const satisfies Record<FieldStatus, VerificationOutcome>;

/** Compile-time `satisfies` plus this map keep status coverage exhaustive. */
test("maps every field status to an outcome", () => {
  expect(
    (Object.keys(OUTCOME_BY_STATUS) as FieldStatus[]).map((status) =>
      overallOutcome([result(status, "medium")]),
    ),
  ).toEqual(Object.values(OUTCOME_BY_STATUS));
});

/** Low confidence cannot pass or fail, whatever status it carried. */
test("low confidence is never decisive", () => {
  expect(overallOutcome([result("match", "low")])).toBe("needs_review");
  expect(overallOutcome([result("mismatch", "low")])).toBe("needs_review");
});

/** A confirmed mismatch is enough to fail the whole result. */
test("fail outranks needs_review", () => {
  expect(
    overallOutcome([result("mismatch", "high"), result("unreadable", "high")]),
  ).toBe("fail");
  expect(
    overallOutcome([result("mismatch", "high"), result("match", "low")]),
  ).toBe("fail");
});

test("all matches at medium confidence pass", () => {
  expect(
    overallOutcome([result("match", "medium"), result("match", "medium")]),
  ).toBe("pass");
});

test("an empty field list needs review", () => {
  expect(overallOutcome([])).toBe("needs_review");
});
