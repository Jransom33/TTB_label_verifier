# Implementation Specification

## Architecture

Use a stateless Next.js App Router backend. Images and application data are processed in memory and are not persisted.

Components are grouped into layers, and dependencies only point inward:

- **Entities** hold TTB rules and the shared verification vocabulary. They import nothing outside `domain/`.
- **Use cases** sequence one verification. They know nothing about HTTP or any AI provider.
- **Ports** are the interfaces the use cases depend on, named for the need rather than the technology.
- **Adapters** are the HTTP routes and the concrete AI/OCR client, and are the only replaceable parts.

API routes handle HTTP concerns and delegate all cross-checking to one shared use case. The AI/OCR provider sits behind the label-scanner port so it can be replaced without changing any rule.

## Naming conventions

Each pipeline step owns exactly one verb, and no verb is reused:

| Step | Name | Scope |
| --- | --- | --- |
| Read and judge the image | `scan` | one image plus application data → `ExtractedLabel` |
| Clean values for comparison | `normalize` | one string |
| Compare one field | `matchField` | one expected value vs one piece of evidence, reconciling the provider verdict with the normalized comparison |
| Derive the outcome | `overallOutcome` | all field results → one outcome |
| Run the whole request | `crossCheckLabel` | one request → one `VerificationResult` |

## Decided assumptions

These were confirmed during implementation:

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
- The provider (LLM/Claude) judges each supplied field against its expected value and returns a `match` or `mismatch` verdict beside the text it read. Equivalence, including differing units and formats, is its call.
- Code performs no unit or numeric conversion. It normalizes text and compares strings.
- An exact match after normalization always yields `match`, even when the provider said mismatch. Otherwise the provider's verdict stands: equivalent but not identical is `needs_review`, and a rejected value is `mismatch`.
- Field statuses are `match`, `needs_review`, `mismatch`, `missing`, and `unreadable`.
- Government warning rule `v1` requires a bold `GOVERNMENT WARNING:` heading followed by: `(1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.` Line wrapping is ignored, but wording, capitalization, numbering, and punctuation are exact.
- Correct warning wording under a heading that is not bold is `mismatch`.
- Warning boldness that cannot be read is `needs_review`, not a pass-through status: the wording was already verified.
- Among the two warning text pieces, `unreadable` outranks `missing`.
- Warning confidence is the lowest of the evidence pieces actually consulted.
- `expected` and `extracted` are the original strings, never normalized output. For the warning they are the heading plus body, joined with one space.
- `explanation` is `null` for `match` and a short fixed sentence otherwise.
- `overallOutcome` sees only statuses and confidences, never label text. `fail` outranks `needs_review`, which outranks `pass`. A `low` confidence reading is never decisive, whatever status it carried. Confident `missing` is `fail`. An empty field list is `needs_review`.

Still unconfirmed: additional visual warning rules, provider-to-category confidence mapping, AI/OCR provider, and representative accuracy targets.

## Component list

Listed in the order they should be completed. Each entry names its layer and the one reason it changes. Components 1 through 11 are done; 12 onward is the remaining work in dependency order.

### 1. Verification vocabulary — entity — complete

Changes when the result contract changes.

Done:

- Application-data type and schema.
- Extracted-label types distinguish readable, missing, and unreadable evidence without inventing values.
- Field results (`match`, `needs_review`, `mismatch`, `missing`, `unreadable`) and overall outcomes (`pass`, `fail`, `needs_review`).
- `FieldVerdict` holds the provider's judgment, and `JudgedField` permits it only alongside readable evidence, so nothing that was never read can be judged.
- Categorical confidence (`low`, `medium`, `high`).
- Optional producer and country of origin are included in results only when supplied.
- Image-quality reasons are deliberately excluded from the result contract.

### 2. TTB label rules — entity — complete

Changes when TTB changes, not when the code does.

Done:

- Versioned government warning wording plus heading capitalization, boldness, and whitespace rules.
- Exhaustive field-to-strategy metadata, now just `normalized_text` and `exact_warning`. Alcohol and volume no longer need strategies of their own, because the provider judges unit equivalence and code only compares normalized text.

Remaining:

- Representative match fixtures for those rules are still pending.

### 3. Upload guard — adapter — complete

Done:

- Zod application-data schema with required/optional fields, trimming, blank rejection, and length limits. The schema itself lives with the entities in `domain/application.ts`.
- `beverageType` is one of `beer`, `wine`, or `distilled_spirits`.
- Exactly one `image` and one `applicationData` field.
- `.png` / `.jpg` / `.jpeg` only, with matching MIME type and PNG/JPEG magic bytes.
- Full PNG/JPEG decode after the signature check; truncated or corrupt files are `INVALID_REQUEST`. Pixel count is capped at 25 megapixels.
- Configurable `MAX_IMAGE_BYTES` and `MAX_REQUEST_BYTES`; the body is read with a size cap before parsing.
- Malformed or unsafe input is rejected before the use case (and later AI provider).

### 4. HTTP controllers — adapter — complete for the single-item prototype

Built early against the stub use case, which is what allowed the HTTP contract to be finished ahead of the rules.

Done:

- Next.js App Router project with TypeScript, ESLint, and Vitest.
- `GET /api/health` returns `{ data: { status: "ok" }, requestId }`.
- `POST /api/verifications` parses the upload, assigns a request ID, calls the cross-check use case once, and returns the structured result or a sanitized error.
- Controllers stay limited to HTTP: parse, request ID, use-case call, error mapping.
- Endpoint contracts documented in `README.md`.

Remaining:

- Batch routes, after the workflow is confirmed.

### 5. Error presenter — adapter — complete

Done:

- Shared `PublicApiError` model and `toErrorResponse`, which maps known failures to the public envelope and unexpected failures to `INTERNAL_ERROR`.
- Request IDs on every API response.
- No stack traces, provider payloads, secrets, image bytes, or full application data in error JSON.

### 6. Label scanner port — port — complete

Done:

- Provider-neutral `LabelScanner` interface, `scan(image, applicationData) → ExtractedLabel`, in `usecases/ports/label-scanner.ts`. Type-only, so it has no test of its own; component 10 is its first coverage.
- The application data travels with the image because the provider cannot judge a field without knowing what was declared. It returns a verdict per readable field.
- The port owns `LabelImage` (validated bytes plus trusted media type). The upload guard imports it, keeping one definition and pointing the dependency inward.
- Error contract: `scan` resolves with an `ExtractedLabel` or throws. Mapping a vendor failure to `PROVIDER_TIMEOUT` or `PROVIDER_UNAVAILABLE` belongs to the adapter, since the port must not import the HTTP layer.
- Absent or illegible text is evidence, not an error: it returns as `missing` or `unreadable` with a null value.

### 7. Value normalizers — entity — complete

Pure functions in `domain/normalizers.ts`, called by the matchers and never by the use case.

Done:

- `normalizeText` folds capitalization, accents, punctuation, and whitespace. It is used for comparison only; reported values are never rewritten. This is what makes `STONE'S THROW` agree with `Stone's Throw`, and `45% Alc./Vol.` agree with `45% ALC/VOL`.
- `normalizeWarningText` collapses whitespace and nothing else, so warning wording, capitalization, numbering, and punctuation stay exact while line wrapping is ignored.

Deliberately excluded: unit and numeric conversion. ABV, proof, and volume equivalence is the provider's judgment, which keeps conversion tables and tolerances out of the codebase entirely.

### 8. Field matchers — entity — complete

Depends on component 7, since each strategy calls the normalizer it needs.

Done:

- `matchField` dispatches on `FIELD_COMPARISON_RULES` so each field uses `normalized_text` or `exact_warning`.
- An exact match after normalization yields `match`, and it wins even when the provider said mismatch. Otherwise the provider's verdict decides: `match` becomes `needs_review`, because the values are equivalent but not identical, and `mismatch` stays `mismatch`. Missing and unreadable evidence passes through as its own status and is never judged.
- The warning is checked against the fixed wording plus the heading text and its boldness. It cannot see other fields or the overall outcome. Correct wording under a non-bold heading is `mismatch`.

### 9. Overall outcome — entity — complete

Depends only on the component 1 field-result type. The single place the bias toward human review is encoded.

Done:

- `overallOutcome` in `domain/overall-outcome.ts` derives `pass` / `fail` / `needs_review` from collected field results.
- Status map: `match` → `pass`; `mismatch` and `missing` → `fail`; `needs_review` and `unreadable` → `needs_review`.
- A `low` confidence reading is never decisive. Among the rest, `fail` outranks `needs_review`, which outranks `pass`.
- An empty field list is `needs_review`.
- The stub service calls `overallOutcome` instead of hardcoding the outcome.

### 10. Stub label scanner — adapter — complete

Done:

- `stubLabelScanner` in `adapters/stub-label-scanner.ts` implements the component 6 port.
- Default evidence is derived from the application: supplied fields come back readable with a `match` verdict and `high` confidence; omitted optionals come back `missing`.
- The government warning defaults to the TTB heading and body with a bold heading, since its wording is not in the application.
- Per-field and warning overrides let tests force other evidence without a provider.
- Adapter tests cover readable defaults, missing optionals, the default warning, and partial overrides.

### 11. Cross-check label — use case — complete

The provider-neutral pipeline that turns scanner evidence into one verdict. Needs components 6 through 10.

Done:

- `crossCheckLabel` and its `VerificationRequest` live in `usecases/cross-check-label.ts`, outside the HTTP layer.
- The use case calls the injected scanner, matches each supplied application field plus the government warning, and derives one complete `VerificationResult` with `overallOutcome`. It holds no rules of its own.
- The verification route is the composition point. Until component 12 exists, it injects `unreadLabelScanner`, which does not inspect the image and reports every field and warning evidence as unreadable with low confidence, producing `needs_review`.
- Use-case tests drive the real matchers and outcome rule with the stub scanner so the pipeline can pass, fail, or need review offline.

### 12. Vision label scanner — adapter — not started

Changes when the vendor changes. Deliberately late: it is the component most likely to be blocked by the target network or replaced outright, and by this point everything behind it is proven against the stub.

Remaining: `VisionLabelScanner` implements the component 6 port and is the only code that knows a vendor exists. Owns prompt construction and isolation, the provider call, timeouts, bounded retries, and structured output validation so a malformed or invented reply never reaches the matchers. The prompt is what elicits a per-field verdict against the supplied application data, and validation must reject a verdict attached to a field the provider did not actually read. Provider scores are mapped to the confidence categories here, once the provider is selected.

### 13. Telemetry port — port — not started

Meaningful once a real provider call exists whose latency can be measured against the five-second target.

Remaining: a narrow logging interface for sanitized latency, outcome counts, and diagnostics. Keeping it narrow is what prevents images, full application data, secrets, and raw provider payloads from ever being loggable. Timeout handling and performance measurements against the five-second target land here too; the security controls that shipped with components 3 and 5 are already done.

### 14. Cross-check batch — use case — not started

Remaining: bounded concurrency for up to 300 items, per-item isolation, progress/summary, and idempotent retries, calling component 11 once per item. Execution model is still unconfirmed.

### Test coverage — not a sequenced component

Tests ship in the same commit as the component they cover.

Done:

- Health-route contract test.
- Verification success test (mocked use case, real multipart parsing).
- Verification failure tests: missing/multiple/unsupported/malformed/oversized images, truncated PNG, bad application JSON, provider timeout/unavailability, and sanitized unexpected errors.
- Application-schema tests for the beverage-type enum and unknown keys.
- Domain tests for extracted evidence, categorical confidence, warning rule versioning, exhaustive comparison-rule coverage, exhaustive `matchField` coverage, normalizers, and outcome derivation.
- Stub label scanner tests: readable defaults across `LABEL_FIELDS`, missing optionals, the default warning, and partial overrides.
- Cross-check use-case tests with the stub and placeholder scanners: pass, omitted optionals, fail and review outcomes, warning boldness, and the live unreadable fallback.

Remaining:

- Unit tests for validation helpers and warning rules.
- Batch tests.

## Deliberately excluded

- Database or durable file storage
- User accounts or authentication
- COLA integration
- Autonomous regulatory approval or rejection
