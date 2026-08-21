/*
 * Provider adapters must map their scores to these categories.
 * Incomplete: the category thresholds remain intentionally undefined.
 */
export const CONFIDENCE_LEVELS = ["low", "medium", "high"] as const;
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];

// Assumption: callers always pass at least one level.
export const lowestConfidence = (...levels: ConfidenceLevel[]): ConfidenceLevel =>
  levels.includes("low") ? "low" : levels.includes("medium") ? "medium" : "high";

// These fields correspond directly to values in the application data.
export const LABEL_FIELDS = [
  "brandName",
  "classType",
  "alcoholContent",
  "netContents",
  "producer",
  "countryOfOrigin",
] as const;
export type LabelField = (typeof LABEL_FIELDS)[number];

export type ExtractionStatus = "readable" | "missing" | "unreadable";

// A null value prevents missing or unreadable text from being invented.
export type ExtractedEvidence<T> =
  | { status: "readable"; value: T; confidence: ConfidenceLevel }
  | {
      status: Exclude<ExtractionStatus, "readable">;
      value: null;
      confidence: ConfidenceLevel;
    };

export type ExtractedField = ExtractedEvidence<string>;

// The provider's (claude/LLM) opinion on whether what it read matches the application.
export type FieldVerdict = "match" | "mismatch";

// What the scanner hands back for one field: if it read something it also says whether that matches, and if it didn't there's nothing to have an opinion about.
export type JudgedField =
  | (Extract<ExtractedField, { status: "readable" }> & { verdict: FieldVerdict })
  | Exclude<ExtractedField, { status: "readable" }>;

/*
 * Raw heading text preserves capitalization for exact comparison later.
 * Boldness remains separate visual evidence rather than a provider verdict.
 */
export type GovernmentWarningEvidence = {
  text: ExtractedField;
  heading: ExtractedField;
  headingIsBold: ExtractedEvidence<boolean>;
};

export type ExtractedLabel = {
  fields: Record<LabelField, JudgedField>;
  governmentWarning: GovernmentWarningEvidence;
};
