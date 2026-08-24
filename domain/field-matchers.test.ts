import { matchField } from "@/domain/field-matchers";
import {
  GOVERNMENT_WARNING_RULE,
  VERIFICATION_FIELDS,
} from "@/domain/verification-rules";
import { expect, test } from "vitest";

const readable = <T,>(value: T) =>
  ({ status: "readable" as const, value, confidence: "high" as const });

const matchWarning = (text: string, heading = GOVERNMENT_WARNING_RULE.heading) =>
  matchField({
    field: "governmentWarning",
    evidence: {
      heading: readable(heading),
      text: readable(text),
      headingIsBold: readable(true),
    },
  });

/** A newly added verification field must still come back from `matchField`. */
test("returns a field result for every verification field", () => {
  const unread = { status: "unreadable" as const, value: null, confidence: "low" as const };

  expect(
    VERIFICATION_FIELDS.map((field) =>
      field === "governmentWarning"
        ? matchField({
            field,
            evidence: { heading: unread, text: unread, headingIsBold: unread },
          }).field
        : matchField({ field, expected: "x", evidence: unread }).field,
    ),
  ).toEqual([...VERIFICATION_FIELDS]);
});

test("warning body matches regardless of letter case", () => {
  expect(matchWarning(GOVERNMENT_WARNING_RULE.body.toLowerCase()).status).toBe(
    "match",
  );
});

test("warning heading remains case-sensitive", () => {
  expect(
    matchWarning(GOVERNMENT_WARNING_RULE.body, "Government Warning:").status,
  ).toBe("mismatch");
});

test("warning body still requires exact wording and punctuation", () => {
  expect(
    matchWarning(GOVERNMENT_WARNING_RULE.body.replace(".", "")).status,
  ).toBe("mismatch");
});
