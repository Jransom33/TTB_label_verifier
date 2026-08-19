import { NextResponse } from "next/server";

/*
 * Contract assumption: every API response uses the selected data/error envelope.
 * Confirm these public codes, messages, and statuses before documenting the API.
 */
export type ApiErrorCode =
  | "INVALID_REQUEST"
  | "PAYLOAD_TOO_LARGE"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "PROVIDER_UNAVAILABLE"
  | "PROVIDER_TIMEOUT"
  | "INTERNAL_ERROR";

type ErrorDetails = {
  message: string;
  status: number;
};

export const ERROR_DETAILS: Record<ApiErrorCode, ErrorDetails> = {
  INVALID_REQUEST: {
    message: "Check the submitted fields and try again.",
    status: 400,
  },
  PAYLOAD_TOO_LARGE: {
    message: "The uploaded request exceeds the allowed size.",
    status: 413,
  },
  UNSUPPORTED_MEDIA_TYPE: {
    message: "Upload a PNG or JPEG image.",
    status: 415,
  },
  PROVIDER_UNAVAILABLE: {
    message: "The verification service is temporarily unavailable. Try again later.",
    status: 503,
  },
  PROVIDER_TIMEOUT: {
    message: "Verification took too long. Try again.",
    status: 504,
  },
  INTERNAL_ERROR: {
    message: "The request could not be completed. Try again later.",
    status: 500,
  },
};

export class PublicApiError extends Error {
  constructor(readonly code: ApiErrorCode) {
    super(code);
    this.name = "PublicApiError";
  }
}

export function createRequestId(): string {
  return crypto.randomUUID();
}

export function successResponse<T>(
  data: T,
  requestId: string,
  status = 200,
): NextResponse<{ data: T; requestId: string }> {
  return NextResponse.json(
    { data, requestId },
    { headers: { "x-request-id": requestId }, status },
  );
}

export function errorResponse(
  code: ApiErrorCode,
  requestId: string,
): NextResponse<{
  error: { code: ApiErrorCode; message: string };
  requestId: string;
}> {
  const { message, status } = ERROR_DETAILS[code];

  return NextResponse.json(
    { error: { code, message }, requestId },
    { headers: { "x-request-id": requestId }, status },
  );
}

export function toErrorResponse(
  error: unknown,
  requestId: string,
): NextResponse<{
  error: { code: ApiErrorCode; message: string };
  requestId: string;
}> {
  /*
   * Map known failures to their public codes. Unexpected values become
   * INTERNAL_ERROR so stack traces, provider payloads, and request data
   * are never returned.
   */
  if (error instanceof PublicApiError) return errorResponse(error.code, requestId);
  return errorResponse("INTERNAL_ERROR", requestId);
}
