import {
  normalizeText,
  normalizeWarningBody,
  normalizeWarningText,
} from "@/domain/normalizers";
import { expect, test } from "vitest";

/** Comparison-only cleanup: reported values are never rewritten. */
test("normalizeText folds casing, accents, punctuation, and whitespace", () => {
  expect(normalizeText("STONE'S THROW")).toBe("stone s throw");
  expect(normalizeText("Stone's Throw")).toBe("stone s throw");
  expect(normalizeText("Café")).toBe("cafe");
  expect(normalizeText("St.Louis")).toBe(normalizeText("St Louis"));
  expect(normalizeText("  45%   Alc./Vol.\n")).toBe(normalizeText("45% ALC/VOL"));
});

/** Line wrapping is formatting; capitalization and punctuation stay exact. */
test("normalizeWarningText collapses whitespace only", () => {
  expect(normalizeWarningText("GOVERNMENT\nWARNING:")).toBe("GOVERNMENT WARNING:");
  expect(normalizeWarningText("Government warning:")).not.toBe("GOVERNMENT WARNING:");
  expect(normalizeWarningText("GOVERNMENT WARNING")).not.toBe("GOVERNMENT WARNING:");
});

/** Body comparison ignores letter case; wording and punctuation stay exact. */
test("normalizeWarningBody collapses whitespace and folds case", () => {
  expect(normalizeWarningBody("According\nto THE Surgeon General,")).toBe(
    normalizeWarningBody("ACCORDING TO THE SURGEON GENERAL,"),
  );
  expect(normalizeWarningBody("ACCORDING TO THE SURGEON GENERAL")).not.toBe(
    normalizeWarningBody("ACCORDING TO THE SURGEON GENERAL."),
  );
});
