# Backend Requirements

## Goal and scope

Build a standalone Next.js backend for a prototype that helps TTB compliance agents compare alcohol label artwork with application data. The service provides decision support; ambiguous results must be sent for human review rather than treated as final regulatory decisions.

Priority terms:

- **Must**: required for the core prototype.
- **Should**: strongly supported by stakeholder feedback.
- **Could**: useful enhancement if time permits.

## Functional requirements

### Verification inputs

- **FR-1 (Must):** Accept a label image and the application values against which the label will be checked.
- **FR-2 (Must):** Accept PNG and JPEG images (`.png`, `.jpg`, and `.jpeg`) and reject missing, unsupported, oversized, or malformed uploads with a clear error.
- **FR-3 (Must):** Accept the beverage type and relevant application fields, including:
  - Brand name
  - Class/type
  - Alcohol content
  - Net contents
  - Bottler/producer name and address (optional)
  - Country of origin for imported products (optional)
  
  Optional fields must be verified when supplied, but their omission must not make the request invalid.

### Extraction and verification

- **FR-4 (Must):** Extract visible label text and identify each required field without inventing unreadable values.
- **FR-5 (Must):** Compare extracted values with the corresponding application values.
- **FR-6 (Must):** Apply field-appropriate normalization before comparison. Harmless differences such as brand-name capitalization must not cause an automatic mismatch, while the original values remain available for review.
- **FR-7 (Must):** Compare equivalent alcohol and volume representations correctly, such as ABV versus proof and equivalent volume units.
- **FR-8 (Must):** Check that the complete, authoritative government health warning text is present and exact.
- **FR-9 (Must):** Check that `GOVERNMENT WARNING:` uses the required capitalization and is visually bold.
- **FR-10 (Must):** Distinguish among confirmed matches, confirmed mismatches, missing fields, and fields that cannot be read or verified reliably.
- **FR-11 (Must):** Route uncertain, nuanced, or low-confidence comparisons to human review instead of returning a false pass or failure.
- **FR-12 (Should):** Detect poor image quality, glare, rotation, or perspective issues and either compensate for them or explain that a clearer image is required.

### Results

- **FR-13 (Must):** Return a structured result for every checked field containing:
  - Expected application value
  - Extracted label value
  - Status and confidence
  - A concise explanation for mismatches or uncertainty
- **FR-14 (Must):** Return an overall outcome of `pass`, `fail`, or `needs_review`, derived from the field-level results.
- **FR-15 (Must):** Identify every failed or uncertain check in one response so an agent does not need repeated submissions.
- **FR-16 (Must):** Use stable, documented JSON response and error formats.

### Batch processing

- **FR-17 (Should):** Support a batch of up to 300 label applications without requiring agents to submit each item manually.
- **FR-18 (Should):** Report per-item status and results, allow partial success, and ensure one invalid item does not fail the entire batch.
- **FR-19 (Should):** Provide batch progress and a final summary of passed, failed, and review-required items.

### API and operations

- **FR-20 (Must):** Expose documented Next.js HTTP endpoints for single verification and any implemented batch workflow.
- **FR-21 (Must):** Validate all client input server-side and return actionable errors for invalid requests, processing failures, and unavailable AI services.
- **FR-22 (Must):** Provide a health endpoint suitable for deployment checks.
- **FR-23 (Could):** Allow verification rules and the authoritative warning text to be versioned without changing the comparison pipeline.

## Non-functional requirements

- **NFR-1 — Performance (Must):** Return a typical single-label result in about five seconds or less under documented test conditions. Upload time and external-provider latency must be measured separately.
- **NFR-2 — Batch capacity (Should):** Safely accept batches of up to 300 items using bounded concurrency so processing does not exhaust server resources or external API quotas.
- **NFR-3 — Accuracy and safety (Must):** Favor `needs_review` over an unsupported conclusion. Confidence thresholds must be documented and covered by representative tests.
- **NFR-4 — Security (Must):** Validate file signatures and sizes, treat uploaded content as untrusted, prevent uploaded filenames or content from controlling filesystem paths or prompts, keep secrets server-side, use HTTPS in deployment, and avoid exposing provider responses or stack traces.
- **NFR-5 — Privacy (Must):** The prototype requires no durable storage or formal retention workflow. Process labels and application data in memory where possible, delete any temporary artifacts immediately after processing, and exclude image contents, full application data, credentials, and other sensitive information from logs.
- **NFR-6 — Network compatibility (Should):** External AI/OCR providers are permitted. Minimize and document their outbound domains because the target government network may block them. Provider failures must degrade to a clear retryable or review-required result.
- **NFR-7 — Reliability (Must):** Enforce timeouts, bounded retries, input limits, and idempotent batch behavior where retries could otherwise duplicate work.
- **NFR-8 — Usability (Must):** Results and errors must use plain language and make the next action obvious for agents with varying technical experience.
- **NFR-9 — Maintainability (Must):** Use a concise, modular Next.js implementation with one shared verification pipeline for single and batch requests; avoid duplicated validation and comparison rules.
- **NFR-10 — Testability (Must):** Include automated tests for input validation, normalization, comparison rules, warning validation, uncertain results, provider failures, and mixed-success batches.
- **NFR-11 — Observability (Must):** Record request IDs, latency, outcome counts, and sanitized errors without logging uploaded content or sensitive values.
- **NFR-12 — Deployability (Must):** Provide reproducible setup, environment-variable documentation, run/test instructions, and a deployable application URL.
- **NFR-13 — Documentation (Must):** Document the architecture, AI/OCR provider, assumptions, known limitations, trade-offs, and any externally required network access.



## Explicitly out of scope for the prototype

- Direct integration with the existing COLA system
- Final autonomous approval or rejection of label applications
- Production federal authorization, FedRAMP certification, and agency document-retention workflows
- Comprehensive enforcement of every beverage-specific TTB regulation unless separately defined
- User accounts, user authentication, and durable application-data storage

## Requirements needing confirmation

1. The supported beverage types and any type-specific mandatory fields beyond brand name, class/type, alcohol content, and net contents.
2. The authoritative warning text and whether font size, placement, contrast, and other visual rules must also be validated.
3. The maximum upload size and whether one application may contain multiple label images.
4. The exact confidence thresholds for the confirmed `pass`, `fail`, and `needs_review` outcomes.
5. Whether batch processing must be synchronous, asynchronous, or both, and its completion-time target.
6. The selected AI/OCR provider and its required outbound domains.
7. The representative test set and minimum acceptable extraction and verification accuracy.