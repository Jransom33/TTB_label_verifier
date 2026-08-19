import { POST } from "@/app/api/verifications/route";
import { ERROR_DETAILS, PublicApiError, type ApiErrorCode } from "@/server/http";
import { verifyLabel } from "@/server/verification-service";
import { beforeEach, expect, test, vi } from "vitest";

vi.mock("@/server/verification-service", () => ({
  verifyLabel: vi.fn(),
}));

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// 1x1 PNG that passes both the signature check and a full decode.
const pngBytes = Uint8Array.from([
  137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0,
  0, 1, 8, 2, 0, 0, 0, 144, 119, 83, 222, 0, 0, 0, 9, 112, 72, 89, 115, 0, 0, 3,
  232, 0, 0, 3, 232, 1, 181, 123, 82, 107, 0, 0, 0, 12, 73, 68, 65, 84, 8, 153,
  99, 248, 207, 192, 0, 0, 3, 1, 1, 0, 156, 227, 191, 89, 0, 0, 0, 0, 73, 69, 78,
  68, 174, 66, 96, 130,
]);

const applicationData = {
  beverageType: "distilled_spirits",
  brandName: "OLD TOM DISTILLERY",
  classType: "Kentucky Straight Bourbon Whiskey",
  alcoholContent: "45% Alc./Vol. (90 Proof)",
  netContents: "750 mL",
};

const verificationResult = {
  outcome: "needs_review" as const,
  fields: [
    {
      field: "brandName",
      expected: applicationData.brandName,
      extracted: null,
      status: "unreadable" as const,
      confidence: 0,
      explanation: "Label text has not been extracted yet.",
    },
  ],
  imageQualityIssues: [],
};

/** Builds an in-memory upload with a copied byte buffer, filename, and MIME type. */
function imageFile(bytes: Uint8Array, name: string, type: string) {
  const copy = new Uint8Array(bytes);
  return new File([copy.buffer], name, { type });
}

/** Builds a PNG upload using a fully decodable 1x1 image by default. */
function pngFile(bytes: Uint8Array = pngBytes, name = "label.png") {
  return imageFile(bytes, name, "image/png");
}

/**
 * Builds a multipart body. Omitting `images` sends one valid PNG. Pass `images: []`
 * to omit the file field, or several files to send duplicates.
 */
function multipart(fields: { applicationData?: string; images?: File[] } = {}) {
  const formData = new FormData();
  if (fields.applicationData !== undefined) {
    formData.set("applicationData", fields.applicationData);
  }
  const images = fields.images ?? [pngFile()];
  for (let i = 0; i < images.length; i++) {
    formData.append("image", images[i]);
  }
  return formData;
}

/** Calls the verification route handler with a POST request. */
function post(body: BodyInit) {
  return POST(new Request("http://localhost/api/verifications", { method: "POST", body }));
}

/**
 * Asserts the public error envelope, matching request ID header, and that none
 * of the provided sensitive strings appear in the JSON body.
 */
async function expectError(
  response: Response,
  code: ApiErrorCode,
  leaks: string[] = [],
) {
  const { status, message } = ERROR_DETAILS[code];
  const body: unknown = await response.json();
  const text = JSON.stringify(body);

  expect(response.status).toBe(status);
  expect(body).toEqual({
    error: { code, message },
    requestId: expect.stringMatching(UUID),
  });
  expect(response.headers.get("x-request-id")).toBe(
    (body as { requestId: string }).requestId,
  );
  for (const leak of leaks) expect(text).not.toContain(leak);
}

beforeEach(() => {
  vi.mocked(verifyLabel).mockReset();
  vi.mocked(verifyLabel).mockResolvedValue(verificationResult);
});

/** Valid PNG plus application JSON: parse, call verifyLabel once, return its result. */
test("POST /api/verifications parses one upload, calls the service once, and returns its result", async () => {
  const response = await post(
    multipart({ applicationData: JSON.stringify(applicationData) }),
  );
  const body: unknown = await response.json();

  expect(response.status).toBe(200);
  expect(verifyLabel).toHaveBeenCalledOnce();

  const parsed = vi.mocked(verifyLabel).mock.calls[0][0];
  expect(parsed.applicationData).toEqual(applicationData);
  expect(parsed.image.mediaType).toBe("image/png");
  expect(parsed.image.bytes).toEqual(pngBytes);

  expect(body).toEqual({
    data: verificationResult,
    requestId: expect.stringMatching(UUID),
  });
  expect(response.headers.get("x-request-id")).toBe(
    (body as { requestId: string }).requestId,
  );
});

/**
 * Rejects missing/duplicate images, bad application JSON, unsupported types,
 * signature mismatches, and corrupt files that still have a PNG signature.
 */
test.each([
  {
    name: "missing image",
    body: () => multipart({ applicationData: JSON.stringify(applicationData), images: [] }),
    code: "INVALID_REQUEST" as const,
  },
  {
    name: "multiple images",
    body: () =>
      multipart({
        applicationData: JSON.stringify(applicationData),
        images: [pngFile(), pngFile(pngBytes, "copy.png")],
      }),
    code: "INVALID_REQUEST" as const,
  },
  {
    name: "malformed application JSON",
    body: () => multipart({ applicationData: "{not-json" }),
    code: "INVALID_REQUEST" as const,
  },
  {
    name: "unsupported gif image",
    body: () =>
      multipart({
        applicationData: JSON.stringify(applicationData),
        images: [imageFile(pngBytes, "label.gif", "image/gif")],
      }),
    code: "UNSUPPORTED_MEDIA_TYPE" as const,
  },
  {
    name: "malformed png signature",
    body: () =>
      multipart({
        applicationData: JSON.stringify(applicationData),
        images: [pngFile(new Uint8Array([0xff, 0xd8, 0xff, 0x00]))],
      }),
    code: "UNSUPPORTED_MEDIA_TYPE" as const,
  },
  {
    name: "truncated png",
    // Assumption: 24 bytes still include the 8-byte PNG signature, so this
    // fails at decode (400) rather than signature mismatch (415).
    body: () =>
      multipart({
        applicationData: JSON.stringify(applicationData),
        images: [pngFile(pngBytes.slice(0, 24))],
      }),
    code: "INVALID_REQUEST" as const,
  },
])("POST /api/verifications rejects $name", async ({ body, code }) => {
  const response = await post(body());
  await expectError(response, code, ["OLD TOM DISTILLERY", "at "]);
  expect(verifyLabel).not.toHaveBeenCalled();
});

/** Image larger than MAX_IMAGE_BYTES is 413 and never reaches the service. */
test("POST /api/verifications rejects an oversized image", async () => {
  const previous = process.env.MAX_IMAGE_BYTES;
  process.env.MAX_IMAGE_BYTES = "8";

  try {
    const response = await post(
      multipart({ applicationData: JSON.stringify(applicationData) }),
    );
    await expectError(response, "PAYLOAD_TOO_LARGE", ["OLD TOM DISTILLERY"]);
    expect(verifyLabel).not.toHaveBeenCalled();
  } finally {
    if (previous === undefined) delete process.env.MAX_IMAGE_BYTES;
    else process.env.MAX_IMAGE_BYTES = previous;
  }
});

/** Known provider failures map to 504 timeout and 503 unavailable. */
test("POST /api/verifications maps provider timeout and unavailability", async () => {
  vi.mocked(verifyLabel).mockRejectedValueOnce(new PublicApiError("PROVIDER_TIMEOUT"));
  await expectError(
    await post(multipart({ applicationData: JSON.stringify(applicationData) })),
    "PROVIDER_TIMEOUT",
  );

  vi.mocked(verifyLabel).mockRejectedValueOnce(new PublicApiError("PROVIDER_UNAVAILABLE"));
  await expectError(
    await post(multipart({ applicationData: JSON.stringify(applicationData) })),
    "PROVIDER_UNAVAILABLE",
  );
});

/** Unexpected errors become INTERNAL_ERROR with no stack, secrets, or application data. */
test("POST /api/verifications sanitizes unexpected errors", async () => {
  const leak = "ssn-123-45-6789";
  vi.mocked(verifyLabel).mockRejectedValueOnce(
    new Error(`${leak}\n    at verifyLabel (verification-service.ts:12:3)`),
  );

  const response = await post(
    multipart({ applicationData: JSON.stringify(applicationData) }),
  );
  await expectError(response, "INTERNAL_ERROR", [leak, "verification-service.ts", "OLD TOM DISTILLERY"]);
});
