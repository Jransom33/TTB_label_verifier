/**
 * The seam between the verification use case and any AI/OCR vendor.
 * Nothing vendor-specific belongs here: prompts, model names, provider scores,
 * timeouts, and retries live in the adapter that implements this port.
 */
import type { ApplicationData } from "@/domain/application";
import type { ExtractedLabel } from "@/domain/extracted-label";

// Validated in-memory upload. Owned here so the use case never imports an adapter.
export type LabelImage = {
  bytes: Uint8Array;
  mediaType: "image/jpeg" | "image/png";
};

export interface LabelScanner {
  /**
   * Reads one label image and, for each field the application supplied, says
   * whether what it read matches. It needs the application data to answer that,
   * which is why the two arrive together.
   *
   * Text that is absent or illegible is normal evidence, reported as a
   * `missing` or `unreadable` field with a null value, not as a failure.
   * A rejected promise means the provider itself failed; translating that
   * into a public error code is the adapter's job, since the port must not
   * depend on the HTTP layer.
   */
  scan(image: LabelImage, application: ApplicationData): Promise<ExtractedLabel>;
}
