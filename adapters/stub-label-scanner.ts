import {
  LABEL_FIELDS,
  type GovernmentWarningEvidence,
  type JudgedField,
  type LabelField,
} from "@/domain/extracted-label";
import { GOVERNMENT_WARNING_RULE } from "@/domain/verification-rules";
import type { LabelScanner } from "@/usecases/ports/label-scanner";

export type StubOverrides = Partial<Record<LabelField, JudgedField>> & {
  governmentWarning?: Partial<GovernmentWarningEvidence>;
};

const ABSENT: JudgedField = { status: "missing", value: null, confidence: "high" };

const readable = <T>(value: T) =>
  ({ status: "readable" as const, value, confidence: "high" as const });

const read = (value: string): JudgedField => ({ ...readable(value), verdict: "match" });

/**
 * Offline stand-in for a vision provider. Derives evidence from the
 * application instead of reading pixels.
 */
export const stubLabelScanner = (overrides: StubOverrides = {}): LabelScanner => ({
  async scan(image, application) {
    // A real provider reads pixels; the stub derives from the application.
    void image;

    // All six keys must exist even when producer/countryOfOrigin were omitted.
    const fields = Object.fromEntries(
      LABEL_FIELDS.map((field) => {
        const expected = application[field];
        return [field, overrides[field] ?? (expected === undefined ? ABSENT : read(expected))];
      }),
    ) as Record<LabelField, JudgedField>;

    // Warning wording is fixed by the TTB rule, not by the application.
    return {
      fields,
      governmentWarning: {
        heading: readable(GOVERNMENT_WARNING_RULE.heading),
        text: readable(GOVERNMENT_WARNING_RULE.body),
        headingIsBold: readable(true),
        ...overrides.governmentWarning,
      },
    };
  },
});
