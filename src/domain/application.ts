import { z } from "zod";

// Requires a string, trims surrounding whitespace, rejects blank values, and enforces the supplied maximum length.
const requiredText = (max: number) => z.string().trim().min(1).max(max);

/** TTB commodity category. Distinct from `classType`, which is the label designation. */
export const BEVERAGE_TYPES = ["beer", "wine", "distilled_spirits"] as const;

export type BeverageType = (typeof BEVERAGE_TYPES)[number];

/*
 * Assumptions to confirm: producer is one combined string, these length limits
 * are acceptable, all four core label fields are required for every beverage,
 * and the only commodity types are beer / wine / distilled_spirits (case-sensitive
 * after trim). Type-specific extra required fields are not modeled.
 */
export const applicationDataSchema = z
  .object({
    // Trim, then require one of the confirmed commodity values.
    beverageType: z.string().trim().pipe(z.enum(BEVERAGE_TYPES)),
    brandName: requiredText(200),
    classType: requiredText(200),
    alcoholContent: requiredText(100),
    netContents: requiredText(100),
    producer: requiredText(500).optional(),
    countryOfOrigin: requiredText(100).optional(),
  })
  .strict();

export type ApplicationData = z.infer<typeof applicationDataSchema>;
