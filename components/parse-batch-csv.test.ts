import { MAX_BATCH_ROWS, parseBatchCsv } from "@/components/parse-batch-csv";
import { expect, test } from "vitest";

const HEADER = "imageFile,brandName,classType,alcoholContent,netContents,producer,countryOfOrigin";
const FULL_ROW =
  'a.png,Old Tom,Bourbon,45% Alc./Vol.,750 mL,"Old Tom Distilling Co., Bardstown, KY",United States';

/** Joins a header and rows into CSV text the way an exported file would look. */
const csv = (...rows: string[]) => [HEADER, ...rows].join("\n");

/** Quoted commas are field content, not separators. */
test("a full row parses with the quoted producer intact", () => {
  const { items, errors } = parseBatchCsv(csv(FULL_ROW));

  expect(errors).toEqual([]);
  expect(items).toEqual([
    {
      imageFileName: "a.png",
      applicationData: {
        brandName: "Old Tom",
        classType: "Bourbon",
        alcoholContent: "45% Alc./Vol.",
        netContents: "750 mL",
        producer: "Old Tom Distilling Co., Bardstown, KY",
        countryOfOrigin: "United States",
      },
    },
  ]);
});

/** Blank optional cells are omitted, mirroring the single-item form. */
test("blank optional cells stay absent from the application data", () => {
  const { items, errors } = parseBatchCsv(csv("a.png,Old Tom,Bourbon,45%,750 mL,,"));

  expect(errors).toEqual([]);
  expect(items[0].applicationData).not.toHaveProperty("producer");
  expect(items[0].applicationData).not.toHaveProperty("countryOfOrigin");
});

/** The whole file is rejected when the header cannot be trusted. */
test.each([
  { name: "an unknown column", header: `${HEADER},extra` },
  { name: "a missing required column", header: HEADER.replace("netContents,", "") },
  { name: "a duplicate column", header: `${HEADER},brandName` },
])("$name rejects the file with one header error", ({ header }) => {
  const { items, errors } = parseBatchCsv([header, FULL_ROW].join("\n"));

  expect(items).toEqual([]);
  expect(errors).toEqual([expect.stringContaining("CSV header")]);
});

/** The batch cap counts data rows, never the header. */
test("more than the maximum rows rejects the file", () => {
  const atLimit = parseBatchCsv(csv(...Array(MAX_BATCH_ROWS).fill(FULL_ROW)));
  const overLimit = parseBatchCsv(csv(...Array(MAX_BATCH_ROWS + 1).fill(FULL_ROW)));

  expect(atLimit.errors).toEqual([]);
  expect(atLimit.items).toHaveLength(MAX_BATCH_ROWS);
  expect(overLimit.items).toEqual([]);
  expect(overLimit.errors).toEqual([expect.stringContaining(`limit is ${MAX_BATCH_ROWS}`)]);
});

/** A bad row is reported by spreadsheet row number without hiding valid rows. */
test("malformed rows produce per-row errors while good rows still parse", () => {
  const { items, errors } = parseBatchCsv(
    csv(FULL_ROW, ",Old Tom,Bourbon,45%,750 mL,,", "b.png,,Bourbon,45%,750 mL,,"),
  );

  expect(items.map((item) => item.imageFileName)).toEqual(["a.png"]);
  expect(errors).toEqual([
    "Row 3: imageFile is required.",
    "Row 4: invalid or missing brandName.",
  ]);
});

/** A header alone is not a batch. */
test("a CSV with no data rows is rejected", () => {
  expect(parseBatchCsv(csv()).errors).toEqual(["CSV contains no data rows."]);
});
