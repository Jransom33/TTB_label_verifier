/**
 * Parses the batch CSV into per-row verification inputs on the client.
 * Each row names a label image file plus the application data it should match.
 * Papa Parse handles the CSV grammar; row validation reuses the domain schema,
 * so client and server cannot drift.
 */
import Papa from "papaparse";
import { applicationDataSchema, type ApplicationData } from "@/domain/application";

// Column order in the file does not matter; unknown or duplicate columns are rejected.
const COLUMNS = [
  "imageFile",
  "brandName",
  "classType",
  "alcoholContent",
  "netContents",
  "producer",
  "countryOfOrigin",
] as const;
const REQUIRED_COLUMNS = COLUMNS.slice(0, 5);
export const MAX_BATCH_ROWS = 300;

export interface BatchCsvItem {
  imageFileName: string;
  applicationData: ApplicationData;
}

/** Valid rows plus one message per problem; a bad row never hides the rest. */
export interface BatchCsvResult {
  items: BatchCsvItem[];
  errors: string[];
}

/*
 * Assumptions to confirm: the 300-row cap applies to data rows (header excluded),
 * and rejecting the whole file on a bad header (rather than guessing columns) is
 * the desired behavior. Uncertain: whether other tools export headers with
 * different capitalization; this parser requires the documented names exactly.
 */

export function parseBatchCsv(text: string): BatchCsvResult {
  /** Validates the header, caps the row count, and returns valid items plus per-row errors. */
  // Row mode (no `header` option) keeps the header allowlist below in charge,
  // including duplicate-column detection, which Papa's object mode would mask.
  const parsed = Papa.parse<string[]>(text, { skipEmptyLines: "greedy" });
  if (parsed.errors.length) {
    return { items: [], errors: ["CSV could not be parsed. Check the file for formatting errors."] };
  }
  const [header = [], ...rows] = parsed.data;

  // Header check: known names only, no duplicates, all required columns present.
  const names = header.map((cell) => cell.trim());
  const unknown = names.filter((name) => !COLUMNS.includes(name as (typeof COLUMNS)[number]));
  const missing = REQUIRED_COLUMNS.filter((name) => !names.includes(name));
  if (unknown.length || missing.length || new Set(names).size !== names.length) {
    return { items: [], errors: [`CSV header must use these column names: ${COLUMNS.join(", ")}.`] };
  }

  if (rows.length === 0) return { items: [], errors: ["CSV contains no data rows."] };
  if (rows.length > MAX_BATCH_ROWS) {
    return { items: [], errors: [`CSV has ${rows.length} rows; the limit is ${MAX_BATCH_ROWS}.`] };
  }

  const items: BatchCsvItem[] = [];
  const errors: string[] = [];

  rows.forEach((cells, index) => {
    // Rows are numbered as in a spreadsheet, where the header is row 1.
    const rowNumber = index + 2;

    // Map cells to their column names, trimming and dropping blank values so
    // omitted optional fields stay absent (mirroring the single-item form).
    const record: Record<string, string> = {};
    names.forEach((name, column) => {
      const value = cells[column]?.trim();
      if (value) record[name] = value;
    });

    const { imageFile, ...applicationFields } = record;
    if (!imageFile) {
      errors.push(`Row ${rowNumber}: imageFile is required.`);
      return;
    }

    // The domain schema is the single authority on field rules.
    const parsedRow = applicationDataSchema.safeParse(applicationFields);
    if (parsedRow.success) {
      items.push({ imageFileName: imageFile, applicationData: parsedRow.data });
    } else {
      const fields = [...new Set(parsedRow.error.issues.map((issue) => String(issue.path[0])))];
      errors.push(`Row ${rowNumber}: invalid or missing ${fields.join(", ")}.`);
    }
  });

  return { items, errors };
}
