/**
 * Narrow logging seam for one verification. The event type is the security
 * control: images, application data, secrets, and raw provider payloads have
 * no field to occupy, so they cannot be logged through this port.
 *
 * errorCode is a plain string so this port never imports the HTTP layer.
 * Adapters may only receive a public error code.
 */
import type { VerificationOutcome } from "@/domain/verification";

export type VerificationEvent = {
  requestId: string;
  // Whole request, including parse and matching.
  durationMs: number;
  // Provider scan only, for the five-second target. Null when scan never ran.
  scanDurationMs: number | null;
  // Plan named this OverallOutcome; the domain type is VerificationOutcome.
  // Null when the request failed before a result existed.
  outcome: VerificationOutcome | null;
  // Public API error code, or null on success.
  errorCode: string | null;
};

export interface Telemetry {
  /**
   * Records one sanitized verification. Implementations must log only the
   * fields on VerificationEvent, never the original request or provider reply.
   */
  recordVerification(event: VerificationEvent): void;
}
