import type { Telemetry, VerificationEvent } from "@/usecases/ports/telemetry";

/**
 * Logs one JSON line per verification. Fields are copied by name so extra
 * properties on the event object cannot leak into the log.
 */
export const consoleTelemetry: Telemetry = {
  recordVerification(event: VerificationEvent) {
    /*
     * Pick the whitelist in source, not via spread. A future extra field on
     * VerificationEvent still will not appear here until this list is updated.
     */
    console.info(
      JSON.stringify({
        requestId: event.requestId,
        durationMs: event.durationMs,
        scanDurationMs: event.scanDurationMs,
        outcome: event.outcome,
        errorCode: event.errorCode,
      }),
    );
  },
};
