import { createRequestId, successResponse } from "@/server/http";

export function GET() {
 // This endpoint reports only application availability and exposes no dependencies.
  return successResponse({ status: "ok" as const }, createRequestId());
}
