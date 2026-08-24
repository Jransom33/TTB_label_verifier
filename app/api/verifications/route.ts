import { visionLabelScanner } from "@/adapters/vision-label-scanner";
import { createRequestId, successResponse, toErrorResponse } from "@/server/http";
import { parseVerificationRequest } from "@/server/verification-request";
import { crossCheckLabel } from "@/usecases/cross-check-label";

export async function POST(request: Request) {
  /*
   * HTTP boundary only: parse the upload, assign a request ID, cross-check the
   * label once, and map every failure to the public error envelope. The live
   * scanner is selected here at the composition point.
   */
  const requestId = createRequestId();

  try {
    const parsed = await parseVerificationRequest(request);
    const result = await crossCheckLabel(parsed, visionLabelScanner);
    return successResponse(result, requestId);
  } catch (error) {
    return toErrorResponse(error, requestId);
  }
}
