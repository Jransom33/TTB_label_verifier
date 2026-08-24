import {
  CONFIDENCE_LEVELS,
  type ExtractedField,
} from "@/domain/extracted-label";
import {
  FIELD_COMPARISON_RULES,
  GOVERNMENT_WARNING_RULE,
  VERIFICATION_FIELDS,
} from "@/domain/verification-rules";
import { expect, test } from "vitest";


/** Runtime rule keys and compile-time `satisfies` keep field coverage exhaustive. */
test("defines one comparison strategy for every verification field", () => {
  expect(Object.keys(FIELD_COMPARISON_RULES)).toEqual([...VERIFICATION_FIELDS]);
  expect(FIELD_COMPARISON_RULES).toEqual({
    brandName: "normalized_text",
    classType: "normalized_text",
    alcoholContent: "normalized_text",
    netContents: "normalized_text",
    producer: "normalized_text",
    countryOfOrigin: "normalized_text",
    governmentWarning: "exact_warning",
  });
});

/** Version 1 locks the supplied wording while allowing only whitespace reflow. */
test("defines the versioned government warning rule", () => {
  expect(GOVERNMENT_WARNING_RULE).toEqual({
    version: "v1",
    heading: "GOVERNMENT WARNING:",
    body:
      "(1) ACCORDING TO THE SURGEON GENERAL, WOMEN SHOULD NOT DRINK ALCOHOLIC BEVERAGES DURING PREGNANCY BECAUSE OF THE RISK OF BIRTH DEFECTS. (2) CONSUMPTION OF ALCOHOLIC BEVERAGES IMPAIRS YOUR ABILITY TO DRIVE A CAR OR OPERATE MACHINERY, AND MAY CAUSE HEALTH PROBLEMS.",
    headingMustBeBold: true,
    collapseWhitespace: true,
  });
});
