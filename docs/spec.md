# Implementation Specification

## Architecture

Use a stateless Next.js App Router backend. API routes handle HTTP concerns and delegate all verification work to one shared service. Images and application data are processed in memory and are not persisted. The AI/OCR provider is isolated behind an adapter so it can be replaced without changing verification rules.

## Decided assumptions

These were confirmed during API-route implementation:

- Success responses use `{ data, requestId }`. Errors use `{ error: { code, message }, requestId }`. Both also set the `x-request-id` header.
- Public error codes: `INVALID_REQUEST` (400), `PAYLOAD_TOO_LARGE` (413), `UNSUPPORTED_MEDIA_TYPE` (415), `PROVIDER_UNAVAILABLE` (503), `PROVIDER_TIMEOUT` (504), `INTERNAL_ERROR` (500).
- `POST /api/verifications` accepts `multipart/form-data` with exactly one file field `image` and one text field `applicationData` (JSON string).
- Required application fields: `beverageType`, `brandName`, `classType`, `alcoholContent`, `netContents`. `producer` is one optional string. `countryOfOrigin` is optional. Unknown JSON keys are rejected.
- `beverageType` is request metadata (`beer`, `wine`, or `distilled_spirits`) and is not compared as a label field. `classType` is the label designation.
- Optional producer and country of origin are verified only when supplied.
- Default image limit is 10 MB (`MAX_IMAGE_BYTES`). Default request limit is that value plus 1 MB (`MAX_REQUEST_BYTES`).
- Health means application availability only, not provider readiness.
- One image per verification request. Batch endpoints wait until sync vs async is confirmed.
- Confidence is categorical: `low`, `medium`, or `high`. Provider-specific score mappings are deferred until the provider is selected.
- Verification results do not include image-quality reasons; unreadable or uncertain fields carry their own status, confidence, and explanation.
- Government warning rule `v1` requires a bold `GOVERNMENT WARNING:` heading followed by: `(1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.` Line wrapping is ignored, but wording, capitalization, numbering, and punctuation are exact.

Still unconfirmed: additional visual warning rules, provider-to-category confidence mapping, AI/OCR provider, and representative accuracy targets.

## Component list

### 1. Domain types and verification rules — complete

Done:

- Application-data type and schema.
- Extracted-label types distinguish readable, missing, and unreadable evidence without inventing values.
- Field results (`match`, `mismatch`, `missing`, `unreadable`) and overall outcomes (`pass`, `fail`, `needs_review`).
- Categorical confidence (`low`, `medium`, `high`).
- Versioned government warning wording plus heading capitalization, boldness, and whitespace rules.
- Exhaustive field-to-strategy metadata for normalized text, alcohol, volume, and exact-warning comparisons.
- Optional producer and country of origin are included in results only when supplied.
- Image-quality reasons are deliberately excluded from the result contract.

Remaining:

- Detailed field-specific comparison behavior, including normalization, conversions, and tolerances, belongs to components 2 and 3 below.
- Provider scores still need to be mapped to confidence categories after the analyzer is selected.

### 2. Field normalizers — not started

Remaining: comparison-only normalization for capitalization/whitespace/punctuation, ABV/proof and volume conversion, and exact warning-text handling.

### 3. Comparison and decision engine — not started

Remaining: field comparison, warning heading checks, and deriving `pass` / `fail` / `needs_review`.

### 4. Label analyzer — not started

Remaining: provider-neutral extraction interface, fake and real adapters, structured output validation, prompt isolation, timeouts, and bounded retries.

### 5. Verification service — stub only

Done:

- `verifyLabel` is the single pipeline entry point used by the verification route.
- It returns one complete `VerificationResult` per request.

Remaining:

- Orchestrate analysis, normalization, and comparison.
- Until those exist, every supplied label field is `unreadable` and the outcome is `needs_review`. The image is accepted but not inspected. Government warning is not checked yet.

### 6. Request validation and upload guard — complete

Done:

- Zod application-data schema with required/optional fields, trimming, blank rejection, and length limits.
- `beverageType` is one of `beer`, `wine`, or `distilled_spirits`.
- Exactly one `image` and one `applicationData` field.
- `.png` / `.jpg` / `.jpeg` only, with matching MIME type and PNG/JPEG magic bytes.
- Full PNG/JPEG decode after the signature check; truncated or corrupt files are `INVALID_REQUEST`. Pixel count is capped at 25 megapixels.
- Configurable `MAX_IMAGE_BYTES` and `MAX_REQUEST_BYTES`; the body is read with a size cap before parsing.
- Malformed or unsafe input is rejected before the verification service (and later AI provider).

### 7. API routes — complete for the single-item prototype

Done:

- Next.js App Router project with TypeScript, ESLint, and Vitest.
- `GET /api/health` returns `{ data: { status: "ok" }, requestId }`.
- `POST /api/verifications` parses the upload, assigns a request ID, calls `verifyLabel` once, and returns the structured result or a sanitized error.
- Routes stay limited to HTTP: parse, request ID, service call, error mapping.
- Endpoint contracts documented in `README.md`.

Remaining:

- Batch routes, after the workflow is confirmed.

### 8. Error handling and observability — error mapping complete; telemetry not started

Done:

- Shared `PublicApiError` model and `toErrorResponse`, which maps known failures to the public envelope and unexpected failures to `INTERNAL_ERROR`.
- Request IDs on every API response.
- No stack traces, provider payloads, secrets, image bytes, or full application data in error JSON.

Remaining:

- Sanitized logs for latency, outcome counts, and diagnostics.
- Do not log images, full application data, secrets, or raw provider payloads.

### 9. Batch coordinator — not started

Remaining: bounded concurrency for up to 300 items, per-item isolation, progress/summary, and idempotent retries. Execution model is still unconfirmed.

### 10. Automated tests — route tests complete; unit/service/batch tests not started

Done:

- Health-route contract test.
- Verification success test (mocked service, real multipart parsing).
- Verification failure tests: missing/multiple/unsupported/malformed/oversized images, truncated PNG, bad application JSON, provider timeout/unavailability, and sanitized unexpected errors.
- Application-schema tests for the beverage-type enum and unknown keys.
- Domain tests for extracted evidence, categorical confidence, warning rule versioning, and exhaustive comparison-rule coverage.
- Verification-service stub tests for required and optional field results.

Remaining:

- Unit tests for validation helpers, normalizers, comparison, warning rules, and outcome derivation.
- Service tests with a fake label analyzer.
- Batch tests.

## Build order

1. Define domain types, request/response schemas, rules, and test fixtures. — domain contracts and rule metadata done; representative comparison fixtures pending
2. Build and unit-test field normalizers plus the comparison and decision engine. — not started
3. Add the label-analyzer interface and a deterministic fake implementation. — not started
4. Assemble and test the verification service. — stub only
5. Implement the real AI/OCR adapter and validate its structured output. — not started
6. Expose the single-verification and health routes. — done
7. Add security controls, sanitized telemetry, timeout handling, and performance measurements. — upload guard and sanitized HTTP errors done; telemetry/timeouts/perf remaining
8. Add batch processing after its execution model and completion target are confirmed. — not started

## Deliberately excluded

- Database or durable file storage
- User accounts or authentication
- COLA integration
- Autonomous regulatory approval or rejection
