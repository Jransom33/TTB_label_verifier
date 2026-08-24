import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

import type { ApplicationData } from "@/domain/application";
import {
  CONFIDENCE_LEVELS,
  EXTRACTION_STATUSES,
  FIELD_VERDICTS,
  LABEL_FIELDS,
  type ConfidenceLevel,
  type ExtractedEvidence,
  type ExtractedLabel,
  type ExtractionStatus,
  type JudgedField,
  type LabelField,
} from "@/domain/extracted-label";

const evidenceShape = <T extends z.ZodType>(value: T) => ({
  status: z.enum(EXTRACTION_STATUSES),
  value: value.nullable(),
  confidence: z.enum(CONFIDENCE_LEVELS),
});

const stringEvidence = z.object(evidenceShape(z.string())).strict();
const responseSchema = z
  .object({
    fields: z.array(
      z
        .object({
          field: z.enum(LABEL_FIELDS),
          ...evidenceShape(z.string()),
          verdict: z.enum(FIELD_VERDICTS).nullable(),
        })
        .strict(),
    ),
    governmentWarning: z
      .object({
        heading: stringEvidence,
        text: stringEvidence,
        headingIsBold: z.object(evidenceShape(z.boolean())).strict(),
      })
      .strict(),
  })
  .strict();

export const visionOutputFormat = zodOutputFormat(responseSchema);

export class InvalidVisionResponseError extends Error {
  constructor() {
    super("The vision provider returned an invalid response.");
    this.name = "InvalidVisionResponseError";
  }
}

const invalid = (): never => {
  throw new InvalidVisionResponseError();
};

type Evidence<T> = {
  status: ExtractionStatus;
  value: T | null;
  confidence: ConfidenceLevel;
};

function toEvidence<T>(evidence: Evidence<T>): ExtractedEvidence<T> {
  if (evidence.status === "readable") {
    if (
      evidence.value === null ||
      (typeof evidence.value === "string" && !evidence.value.trim())
    ) {
      return invalid();
    }
    return {
      status: "readable",
      value: evidence.value,
      confidence: evidence.confidence,
    };
  }

  if (evidence.value !== null) return invalid();
  return { status: evidence.status, value: null, confidence: evidence.confidence };
}

type RawField = z.infer<typeof responseSchema>["fields"][number];

function toField(field: RawField): JudgedField {
  const evidence = toEvidence(field);
  if (evidence.status === "readable") {
    if (field.verdict === null) return invalid();
    return { ...evidence, verdict: field.verdict };
  }
  if (field.verdict !== null) return invalid();
  return evidence;
}

const OMITTED_FIELD: JudgedField = {
  status: "missing",
  value: null,
  confidence: "high",
};

/** Validates Claude output and converts it to the provider-neutral domain type. */
export function parseVisionResponse(
  response: unknown,
  application: ApplicationData,
): ExtractedLabel {
  const parsed = responseSchema.safeParse(response);
  if (!parsed.success) return invalid();

  const requested = new Set(
    LABEL_FIELDS.filter((field) => application[field] !== undefined),
  );
  const byField = new Map<LabelField, JudgedField>();

  for (const field of parsed.data.fields) {
    // Fields absent from the application have no expected value to judge; ignore them.
    if (application[field.field] === undefined) continue;
    // delete() fails for duplicates of requested fields.
    if (!requested.delete(field.field)) return invalid();
    byField.set(field.field, toField(field));
  }
  if (requested.size) return invalid();

  const fields = Object.fromEntries(
    LABEL_FIELDS.map((field) => [field, byField.get(field) ?? OMITTED_FIELD]),
  ) as ExtractedLabel["fields"];
  const warning = parsed.data.governmentWarning;

  return {
    fields,
    governmentWarning: {
      heading: toEvidence(warning.heading),
      text: toEvidence(warning.text),
      headingIsBold: toEvidence(warning.headingIsBold),
    },
  };
}

