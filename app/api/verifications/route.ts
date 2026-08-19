import { createRequestId, successResponse, toErrorResponse } from "@/server/http";
import { verifyLabel } from "@/server/verification-service";
import { parseVerificationRequest } from "@/server/verification-request";

export async function POST(request: Request) {
  /*
   * HTTP boundary only: parse the upload, assign a request ID, call the
   * shared verification service once, and map every failure to the public
   * error envelope.
   */
  const requestId = createRequestId();

  try {
    const parsed = await parseVerificationRequest(request);
    const result = await verifyLabel(parsed);
    return successResponse(result, requestId);
  } catch (error) {
    return toErrorResponse(error, requestId);
  }
}
