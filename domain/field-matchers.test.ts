import { matchField } from "@/domain/field-matchers";
import { VERIFICATION_FIELDS } from "@/domain/verification-rules";
import { expect, test } from "vitest";

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
