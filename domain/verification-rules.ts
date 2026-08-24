import { LABEL_FIELDS } from "@/domain/extracted-label";

export const VERIFICATION_FIELDS = [...LABEL_FIELDS, "governmentWarning"] as const;
export type VerificationField = (typeof VERIFICATION_FIELDS)[number];

export type ComparisonStrategy = "normalized_text" | "exact_warning";

/*
 * Each verification field must select one shared comparison strategy. Alcohol
 * content and net contents are plain text like the rest because the provider
 * decides whether different units mean the same thing; we only tidy the text up
 * and compare it. The warning is the exception, since its wording is fixed and
 * we check it ourselves.
 */
export const FIELD_COMPARISON_RULES = {
  brandName: "normalized_text",
  classType: "normalized_text",
  alcoholContent: "normalized_text",
  netContents: "normalized_text",
  producer: "normalized_text",
  countryOfOrigin: "normalized_text",
  governmentWarning: "exact_warning",
} as const satisfies Record<VerificationField, ComparisonStrategy>;

export type GovernmentWarningRule = {
  version: string;
  heading: string;
  body: string;
  headingMustBeBold: boolean;
  collapseWhitespace: boolean;
};

/*
 * Version 1 uses the supplied warning wording. Line wrapping is formatting.
 * The heading is case-sensitive; the body is exact on wording, numbering, and
 * punctuation, regardless of letter case.
 */
export const GOVERNMENT_WARNING_RULE = {
  version: "v1",
  heading: "GOVERNMENT WARNING:",
  body:
    "(1) ACCORDING TO THE SURGEON GENERAL, WOMEN SHOULD NOT DRINK ALCOHOLIC BEVERAGES DURING PREGNANCY BECAUSE OF THE RISK OF BIRTH DEFECTS. (2) CONSUMPTION OF ALCOHOLIC BEVERAGES IMPAIRS YOUR ABILITY TO DRIVE A CAR OR OPERATE MACHINERY, AND MAY CAUSE HEALTH PROBLEMS.",
  headingMustBeBold: true,
  collapseWhitespace: true,
} as const satisfies GovernmentWarningRule;
