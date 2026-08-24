import { z } from "zod";

// Requires a string, trims surrounding whitespace, rejects blank values, and enforces the supplied maximum length.
const requiredText = (max: number) => z.string().trim().min(1).max(max);

/*
 * Assumptions to confirm: producer is one combined string, these length limits
 * are acceptable, and all four core label fields are required for every beverage.
 * Type-specific extra required fields are not modeled.
 */
export const applicationDataSchema = z
  .object({
    brandName: requiredText(200),
    classType: requiredText(200),
    alcoholContent: requiredText(100),
    netContents: requiredText(100),
    producer: requiredText(500).optional(),
    countryOfOrigin: requiredText(100).optional(),
  })
  .strict();

export type ApplicationData = z.infer<typeof applicationDataSchema>;
