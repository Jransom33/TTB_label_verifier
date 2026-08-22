/**
 * Validates multipart verification requests at the API trust boundary.
 * It bounds request size, validates the image and application data, and returns
 * safe in-memory input for the verification use case.
 */
import sharp from "sharp";
import { applicationDataSchema, type ApplicationData } from "@/domain/application";
import { PublicApiError, type ApiErrorCode } from "@/server/http";
// The use case owns its input contract, so parsing and verifying cannot drift apart.
import type { VerificationRequest } from "@/usecases/cross-check-label";

const DEFAULT_MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const REQUEST_OVERHEAD_BYTES = 1024 * 1024;
const MAX_IMAGE_PIXELS = 25_000_000;

/*
 * Assumptions to confirm: multipart fields are named `image` and
 * `applicationData`, 1 MB is sufficient overhead above the image limit, and
 * 25 megapixels is a safe decode cap for label artwork.
 * Uncertain: failOn "error" vs "truncated"/"warning" for every corrupt file.
 * Incomplete: JPEG truncated coverage and a pixel-bomb test are not in the suite.
 */
const MEDIA_TYPES = {
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
} as const;

export class RequestValidationError extends PublicApiError {
  constructor(code: ApiErrorCode) {
    super(code);
    this.name = "RequestValidationError";
  }
}

/** Returns a positive integer environment limit or its safe default. */
function configuredLimit(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

/**
 * Reads a request stream into memory while enforcing its maximum size.
 * Cancels the stream and throws `PAYLOAD_TOO_LARGE` as soon as the limit is exceeded.
 */
async function readBoundedBody(
  request: Request,
  maxBytes: number,
): Promise<Uint8Array<ArrayBuffer>> {
  const reader = request.body?.getReader();
  if (!reader) throw new RequestValidationError("INVALID_REQUEST");

  const chunks: Uint8Array[] = [];
  let size = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new RequestValidationError("PAYLOAD_TOO_LARGE");
    }
    chunks.push(value);
  }

  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

/** Checks whether the leading bytes match the declared PNG or JPEG media type. */
function matchesSignature(bytes: Uint8Array, mediaType: string): boolean {
  if (mediaType === "image/png") {
    const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return png.every((byte, index) => bytes[index] === byte);
  }
  return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

/**
 * Decompresses PNG/JPEG pixels so truncated or corrupt files fail here.
 * The raster buffer is discarded; callers keep the original upload bytes.
 */
async function assertDecodableImage(bytes: Uint8Array): Promise<void> {
  try {
    await sharp(bytes, { failOn: "error", limitInputPixels: MAX_IMAGE_PIXELS })
      .raw()
      .toBuffer();
  } catch {
    // Assumption: decode/pixel-limit failures are malformed input (400), not 415.
    throw new RequestValidationError("INVALID_REQUEST");
  }
}

/** Parses the JSON form field and validates it against the application schema. */
function parseApplicationData(value: FormDataEntryValue): ApplicationData {
  if (typeof value !== "string") throw new RequestValidationError("INVALID_REQUEST");

  try {
    const result = applicationDataSchema.safeParse(JSON.parse(value));
    if (result.success) return result.data;
  } catch {
    // Malformed JSON is reported through the same stable public validation error.
  }
  throw new RequestValidationError("INVALID_REQUEST");
}

/**
 * Validates one uploaded image's file type, size, signature, and that it decodes.
 * Returns only its trusted media type and in-memory bytes, never its filename.
 */
async function parseImage(value: FormDataEntryValue): Promise<VerificationRequest["image"]> {
  // Multipart fields may be text or files, but this field must contain a file.
  if (!(value instanceof File)) throw new RequestValidationError("INVALID_REQUEST");

  // Find which supported extension, if any, appears at the end of the filename.
  const extension = Object.keys(MEDIA_TYPES).find((suffix) =>
    value.name.toLowerCase().endsWith(suffix),
  ) as keyof typeof MEDIA_TYPES | undefined;

  // Map the extension to its expected MIME type, then require the client MIME type to match.
  const mediaType = extension ? MEDIA_TYPES[extension] : undefined;
  if (!mediaType || value.type !== mediaType) {
    throw new RequestValidationError("UNSUPPORTED_MEDIA_TYPE");
  }

  // Use the configured image limit when valid, otherwise use the safe 10 MB default.
  const maxImageBytes = configuredLimit("MAX_IMAGE_BYTES", DEFAULT_MAX_IMAGE_BYTES);
  // Reject empty files and files larger than the permitted in-memory size.
  if (value.size === 0) throw new RequestValidationError("INVALID_REQUEST");
  if (value.size > maxImageBytes) throw new RequestValidationError("PAYLOAD_TOO_LARGE");

  // Convert the browser File into bytes for signature checking and later processing.
  const bytes = new Uint8Array(await value.arrayBuffer());
  // Verify the contents begin with the magic bytes for the expected image format.
  if (!matchesSignature(bytes, mediaType)) {
    throw new RequestValidationError("UNSUPPORTED_MEDIA_TYPE");
  }

  // Signature is necessary but not sufficient; decompress to reject corrupt files.
  await assertDecodableImage(bytes);

  // Return only validated data; the untrusted filename is intentionally discarded.
  return { bytes, mediaType };
}

/**
 * Parses a bounded multipart request containing exactly one image and one
 * JSON `applicationData` field, returning validated service-layer input.
 */
export async function parseVerificationRequest(request: Request): Promise<VerificationRequest> {
  const contentType = request.headers.get("content-type");
  if (!contentType?.toLowerCase().startsWith("multipart/form-data;")) {
    throw new RequestValidationError("UNSUPPORTED_MEDIA_TYPE");
  }

  const maxImageBytes = configuredLimit("MAX_IMAGE_BYTES", DEFAULT_MAX_IMAGE_BYTES);
  const maxRequestBytes = configuredLimit(
    "MAX_REQUEST_BYTES",
    maxImageBytes + REQUEST_OVERHEAD_BYTES,
  );
  const body = await readBoundedBody(request, maxRequestBytes);

  let formData: FormData;
  try {
    formData = await new Response(body.buffer, {
      headers: { "content-type": contentType },
    }).formData();
  } catch {
    throw new RequestValidationError("INVALID_REQUEST");
  }

  const images = formData.getAll("image");
  const applications = formData.getAll("applicationData");
  if (images.length !== 1 || applications.length !== 1) {
    throw new RequestValidationError("INVALID_REQUEST");
  }

  return {
    applicationData: parseApplicationData(applications[0]),
    image: await parseImage(images[0]),
  };
}
