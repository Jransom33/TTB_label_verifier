import Anthropic, {
  APIConnectionTimeoutError,
  AnthropicError,
} from "@anthropic-ai/sdk";
import { beforeEach, expect, test, vi } from "vitest";

import {
  InvalidVisionResponseError,
  parseVisionResponse,
  visionOutputFormat,
} from "@/adapters/vision-label-response";
import {
  createVisionLabelScanner,
  visionLabelScanner,
} from "@/adapters/vision-label-scanner";
import type { ApplicationData } from "@/domain/application";
import type { LabelField } from "@/domain/extracted-label";

const parseMock = vi.hoisted(() => vi.fn());

vi.mock("@anthropic-ai/sdk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@anthropic-ai/sdk")>();
  return {
    ...actual,
    default: vi.fn(function MockAnthropic(this: { messages: { parse: typeof parseMock } }) {
      this.messages = { parse: parseMock };
    }),
  };
});

const image = { bytes: Uint8Array.from([1, 2, 3]), mediaType: "image/png" as const };

// Create application data to run tests with
const requiredApplication = {
  brandName: "OLD TOM DISTILLERY",
  classType: "Kentucky Straight Bourbon Whiskey",
  alcoholContent: "45% Alc./Vol. (90 Proof)",
  netContents: "750 mL",
} satisfies ApplicationData;

const application = {
  ...requiredApplication,
  producer: "Old Tom Distillery, Louisville, KY",
  countryOfOrigin: "United States",
} satisfies ApplicationData;

const warning = {
  heading: { status: "readable" as const, value: "GOVERNMENT WARNING:", confidence: "high" as const },
  text: { status: "readable" as const, value: "Warning body.", confidence: "medium" as const },
  headingIsBold: { status: "readable" as const, value: true, confidence: "low" as const },
};

// Builds a readable label field for a fake Claude response.
const read = (
  field: LabelField,
  value: string,
  confidence: "low" | "medium" | "high" = "high",
  verdict: "match" | "mismatch" = "match",
) => ({ field, status: "readable" as const, value, confidence, verdict });

// Create a fake claude response for the given application data
const responseFor = (data: ApplicationData) => ({
  fields: (["brandName", "classType", "alcoholContent", "netContents", "producer", "countryOfOrigin"] as const)
    .flatMap((field) => {
      const value = data[field];
      return value === undefined ? [] : [read(field, value)];
    }),
  governmentWarning: warning,
});

// 
const scan = (payload: unknown, data: ApplicationData = application) =>
  createVisionLabelScanner(async () => payload).scan(image, data);

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = "test-key";
  process.env.ANTHROPIC_MODEL = "claude-test";
  parseMock.mockReset();
});

test("the Claude request sends the image, supplied fields, timeout, and retry budget", async () => {
  parseMock.mockResolvedValue({ parsed_output: responseFor(requiredApplication) });

  await visionLabelScanner.scan(image, requiredApplication);

  expect(Anthropic).toHaveBeenCalledWith({ apiKey: "test-key" });
  expect(parseMock).toHaveBeenCalledWith(
    expect.objectContaining({
      model: "claude-test",
      max_tokens: 2048,
      output_config: { format: visionOutputFormat },
      system: expect.stringContaining("untrusted data"),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/png",
                data: Buffer.from(image.bytes).toString("base64"),
              },
            },
            {
              type: "text",
              text: expect.stringContaining(
                JSON.stringify({
                  expectedFields: {
                    brandName: requiredApplication.brandName,
                    classType: requiredApplication.classType,
                    alcoholContent: requiredApplication.alcoholContent,
                    netContents: requiredApplication.netContents,
                  },
                }),
              ),
            },
          ],
        },
      ],
    }),
    { maxRetries: 1, timeout: 10_000 },
  );
  expect(parseMock.mock.calls[0][0].messages[0].content[1].text).not.toContain("producer");
});

test("a valid reply maps fields, omitted optionals, warning evidence, and confidence", async () => {
  const extracted = await scan(responseFor(requiredApplication), requiredApplication);

  expect(extracted.fields.brandName).toEqual({
    status: "readable",
    value: requiredApplication.brandName,
    confidence: "high",
    verdict: "match",
  });
  expect(extracted.fields.producer).toEqual({
    status: "missing",
    value: null,
    confidence: "high",
  });
  expect(extracted.governmentWarning).toEqual(warning);
});

test("fields not in the application are ignored, even when Claude returns them", async () => {
  const extracted = await scan(
    { ...responseFor(requiredApplication), fields: [...responseFor(requiredApplication).fields, read("producer", "X")] },
    requiredApplication,
  );

  expect(extracted.fields.producer).toEqual({
    status: "missing",
    value: null,
    confidence: "high",
  });
});

test.each([
  ["malformed payload", {}],
  [
    "duplicate field",
    {
      ...responseFor(requiredApplication),
      fields: [...responseFor(requiredApplication).fields, read("brandName", "X")],
    },
  ],
  ["omitted field", { ...responseFor(requiredApplication), fields: responseFor(requiredApplication).fields.slice(1) }],
  [
    "readable without a value",
    {
      ...responseFor(requiredApplication),
      fields: responseFor(requiredApplication).fields.map((field, index) =>
        index === 0 ? { ...field, value: null } : field,
      ),
    },
  ],
  [
    "readable blank value",
    {
      ...responseFor(requiredApplication),
      fields: responseFor(requiredApplication).fields.map((field, index) =>
        index === 0 ? { ...field, value: "  " } : field,
      ),
    },
  ],
  [
    "readable without a verdict",
    {
      ...responseFor(requiredApplication),
      fields: responseFor(requiredApplication).fields.map((field, index) =>
        index === 0 ? { ...field, verdict: null } : field,
      ),
    },
  ],
  [
    "missing with a value",
    {
      ...responseFor(requiredApplication),
      fields: responseFor(requiredApplication).fields.map((field, index) =>
        index === 0 ? { ...field, status: "missing", value: "x", verdict: null } : field,
      ),
    },
  ],
  [
    "unreadable with a verdict",
    {
      ...responseFor(requiredApplication),
      fields: responseFor(requiredApplication).fields.map((field, index) =>
        index === 0 ? { ...field, status: "unreadable", value: null, verdict: "match" } : field,
      ),
    },
  ],
  [
    "warning heading without text",
    {
      ...responseFor(requiredApplication),
      governmentWarning: { ...warning, heading: { status: "readable", value: "  ", confidence: "high" } },
    },
  ],
  [
    "warning boldness without a value",
    {
      ...responseFor(requiredApplication),
      governmentWarning: {
        ...warning,
        headingIsBold: { status: "readable", value: null, confidence: "high" },
      },
    },
  ],
] as const)("%s is rejected", async (_name, payload) => {
  expect(() => parseVisionResponse(payload, requiredApplication)).toThrow(InvalidVisionResponseError);
  await expect(scan(payload, requiredApplication)).rejects.toMatchObject({
    name: "PublicApiError",
    code: "PROVIDER_UNAVAILABLE",
  });
});

test("timeouts and Anthropic failures map to public codes without leaking payloads", async () => {
  await expect(
    createVisionLabelScanner(async () => {
      throw new APIConnectionTimeoutError({ message: "anthropic timed out" });
    }).scan(image, application),
  ).rejects.toMatchObject({ name: "PublicApiError", code: "PROVIDER_TIMEOUT" });

  await expect(
    createVisionLabelScanner(async () => {
      throw new AnthropicError("raw model dump");
    }).scan(image, application),
  ).rejects.toMatchObject({ name: "PublicApiError", code: "PROVIDER_UNAVAILABLE" });
});

test("unexpected defects stay unsanitized at this boundary so HTTP can map them to INTERNAL_ERROR", async () => {
  const error = new Error("raw provider dump");
  await expect(
    createVisionLabelScanner(async () => {
      throw error;
    }).scan(image, application),
  ).rejects.toBe(error);
});
