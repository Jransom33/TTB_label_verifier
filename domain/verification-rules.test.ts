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
      "(1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.",
    headingMustBeBold: true,
    collapseWhitespace: true,
  });
});
