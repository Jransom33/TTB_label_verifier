/**
 * Interim wiring for the live endpoint: no provider exists yet, so nothing is
 * read. Reporting every field as unreadable keeps the API honest at
 * `needs_review` instead of passing a label no one looked at. Component 12
 * replaces this with the vision adapter.
 */
import {
  LABEL_FIELDS,
  type JudgedField,
  type LabelField,
} from "@/domain/extracted-label";
import type { LabelScanner } from "@/usecases/ports/label-scanner";

// Illegible evidence carries a null value, and low confidence is never decisive.
const UNREAD = { status: "unreadable", value: null, confidence: "low" } as const;

export const unreadLabelScanner: LabelScanner = {
  // The image and application are ignored, hence no parameters.
  async scan() {
    return {
      // ExtractedLabel is a total record, so every label field needs a key.
      fields: Object.fromEntries(
        LABEL_FIELDS.map((field) => [field, UNREAD]),
      ) as Record<LabelField, JudgedField>,
      governmentWarning: { heading: UNREAD, text: UNREAD, headingIsBold: UNREAD },
    };
  },
};
