import { consoleTelemetry } from "@/adapters/console-telemetry";
import { visionLabelScanner } from "@/adapters/vision-label-scanner";
import {
  createRequestId,
  successResponse,
  toApiErrorCode,
  toErrorResponse,
} from "@/server/http";
import { parseVerificationRequest } from "@/server/verification-request";
import { crossCheckLabel } from "@/usecases/cross-check-label";
import type { LabelScanner } from "@/usecases/ports/label-scanner";
import type { Telemetry } from "@/usecases/ports/telemetry";
import type { VerificationOutcome } from "@/domain/verification";

type VerificationDeps = {
  scanner?: LabelScanner;
  telemetry?: Telemetry;
};

/**
 * Composition point for one verification: parse, time the scan, cross-check,
 * map errors, and record a sanitized telemetry event.
 */
export function createVerificationPost({
  scanner = visionLabelScanner,
  telemetry = consoleTelemetry,
}: VerificationDeps = {}) {
  return async function POST(request: Request) {
    const requestId = createRequestId();
    const started = performance.now();
    // Null until scan runs (parse failures never call the provider).
    let scanDurationMs: number | null = null;
    let outcome: VerificationOutcome | null = null;
    let errorCode: string | null = null;

    const timedScanner: LabelScanner = {
      async scan(image, application) {
        /*
         * Time the provider call itself, including failures, so latency can be
         * compared to the five-second target without including HTTP parse time.
         */
        const scanStarted = performance.now();
        try {
          return await scanner.scan(image, application);
        } finally {
          scanDurationMs = performance.now() - scanStarted;
        }
      },
    };

    try {
      const parsed = await parseVerificationRequest(request);
      const result = await crossCheckLabel(parsed, timedScanner);
      outcome = result.outcome;
      return successResponse(result, requestId);
    } catch (error) {
      errorCode = toApiErrorCode(error);
      return toErrorResponse(error, requestId);
    } finally {
      telemetry.recordVerification({
        requestId,
        durationMs: performance.now() - started,
        scanDurationMs,
        outcome,
        errorCode,
      });
    }
  };
}

export const POST = createVerificationPost();
