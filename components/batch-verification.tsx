"use client";

/**
 * Client-side batch verification: pairs a CSV of application data with the
 * selected label images and verifies each pair against the existing
 * single-verification endpoint, four at a time. Per-item isolation, progress,
 * a summary, and retry of failed items all live here; the server is unchanged.
 */
import Image from "next/image";
import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { LABEL_EXAMPLES } from "@/components/label-examples";
import { parseBatchCsv, type BatchCsvItem, type BatchCsvResult } from "@/components/parse-batch-csv";
import tenutaError from "@/examples/Tenuta_gov_warning_error.png";
import { runWithConcurrency } from "@/components/run-with-concurrency";
import { CARD, StatusBadge, VerificationResults } from "@/components/verification-results";
import type { VerificationResult } from "@/domain/verification";

// Four keeps well under provider rate limits while still overlapping requests.
const CONCURRENCY_LIMIT = 4;
const FALLBACK_ERROR = "The request could not be completed. Try again later.";

// The bundled sample labels, shared with the single-label examples, plus the
// warning-error variant that only the example batch CSV references.
const EXAMPLE_IMAGES = [
  ...LABEL_EXAMPLES.map(({ image, fileName }) => ({ image, fileName })),
  { image: tenutaError, fileName: "Tenuta_gov_warning_error.png" },
];
const EXAMPLE_CSV_URL = "/batch-test.csv";

// One runtime state per paired item; `done` holds a real verification result
// (which may itself be a compliance fail), `error` means the request failed.
type RunState =
  | { state: "queued" | "running" }
  | { state: "done"; result: VerificationResult }
  | { state: "error"; message: string };

async function verifyItem(item: BatchCsvItem, file: File): Promise<VerificationResult> {
  /** Posts one image plus its application data, exactly like the single form. */
  const body = new FormData();
  body.set("image", file);
  body.set("applicationData", JSON.stringify(item.applicationData));
  const response = await fetch("/api/verifications", { method: "POST", body });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error?.message || FALLBACK_ERROR);
  return payload.data;
}

export function BatchVerification() {
  const [images, setImages] = useState<File[]>([]);
  const [csv, setCsv] = useState<BatchCsvResult | null>(null);
  const [runs, setRuns] = useState<RunState[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [exampleError, setExampleError] = useState<string | null>(null);

  // Pair CSV rows to selected images by exact filename, and surface both
  // unmatched rows and unused images before anything runs.
  const { paired, unmatchedRows, unusedImages } = useMemo(() => {
    const byName = new Map(images.map((file) => [file.name, file]));
    const paired: { item: BatchCsvItem; file: File }[] = [];
    const unmatchedRows: string[] = [];
    for (const item of csv?.items ?? []) {
      const file = byName.get(item.imageFileName);
      if (file) paired.push({ item, file });
      else unmatchedRows.push(item.imageFileName);
    }
    const used = new Set(paired.map(({ file }) => file.name));
    const unusedImages = images.map((file) => file.name).filter((name) => !used.has(name));
    return { paired, unmatchedRows, unusedImages };
  }, [images, csv]);

  // One object URL per selected image for the expanded-card preview. Object
  // URLs are references to the picked Files, not copies, so 300 stay cheap;
  // pixels are only decoded when a card is expanded and its image mounts.
  const imageUrls = useMemo(
    () => new Map(images.map((file) => [file.name, URL.createObjectURL(file)])),
    [images],
  );

  // Revoke each batch of URLs when the selection changes or the component unmounts.
  useEffect(
    () => () => imageUrls.forEach((url) => URL.revokeObjectURL(url)),
    [imageUrls],
  );

  // Changing either input invalidates previous runs.
  const resetRuns = () => {
    setRuns([]);
    setExpanded(null);
  };

  const onImagesChange = (event: ChangeEvent<HTMLInputElement>) => {
    setImages(Array.from(event.target.files ?? []));
    resetRuns();
  };

  const onCsvChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setCsv(file ? parseBatchCsv(await file.text()) : null);
    resetRuns();
  };

  // Loads the bundled sample images and example CSV as if the user picked them.
  const loadExample = async () => {
    if (busy) return;
    setExampleError(null);
    try {
      const [csvText, files] = await Promise.all([
        fetch(EXAMPLE_CSV_URL).then((response) => {
          if (!response.ok) throw new Error();
          return response.text();
        }),
        Promise.all(
          EXAMPLE_IMAGES.map(
            async ({ image, fileName }) =>
              new File([await (await fetch(image.src)).blob()], fileName, { type: "image/png" }),
          ),
        ),
      ]);
      setImages(files);
      setCsv(parseBatchCsv(csvText));
      resetRuns();
    } catch {
      setExampleError(FALLBACK_ERROR);
    }
  };

  // Runs the given item indices through the bounded pool. First runs pass all
  // indices; "Retry failed" passes only the errored ones, keeping other results.
  const runBatch = async (indices: number[]) => {
    if (busy || indices.length === 0) return;
    setBusy(true);
    setRuns((prev) =>
      paired.map((_, index) =>
        indices.includes(index) ? { state: "queued" } : (prev[index] ?? { state: "queued" }),
      ),
    );

    const setRun = (index: number, run: RunState) =>
      setRuns((prev) => prev.map((entry, i) => (i === index ? run : entry)));

    // Failures are recorded per item here, so one bad request never stops the rest.
    await runWithConcurrency(indices, CONCURRENCY_LIMIT, async (index) => {
      setRun(index, { state: "running" });
      try {
        const { item, file } = paired[index];
        setRun(index, { state: "done", result: await verifyItem(item, file) });
      } catch (caught) {
        const message = caught instanceof Error && caught.message ? caught.message : FALLBACK_ERROR;
        setRun(index, { state: "error", message });
      }
    });
    setBusy(false);
  };

  // Progress and summary are derived from the run states, never stored twice.
  const settled = runs.filter((run) => run.state === "done" || run.state === "error").length;
  const failedIndices = runs.flatMap((run, index) => (run.state === "error" ? [index] : []));
  const summary = { pass: 0, fail: 0, needs_review: 0, error: 0 };
  for (const run of runs) {
    if (run.state === "done") summary[run.result.outcome]++;
    else if (run.state === "error") summary.error++;
  }

  const issues = [
    ...(csv?.errors ?? []),
    ...(unmatchedRows.length
      ? [`CSV rows reference images that were not selected: ${unmatchedRows.join(", ")}.`]
      : []),
    ...(unusedImages.length
      ? [`Selected images with no CSV row (they will be skipped): ${unusedImages.join(", ")}.`]
      : []),
  ];

  return (
    <div className="w-full max-w-5xl space-y-6">
      {/* Example batch, styled like the single-label examples. */}
      <section>
        <h2 className="text-sm font-medium text-forest/80">Try an example batch</h2>
        <p className="mt-1 text-xs text-forest/50">
          Click to load the sample labels and a CSV of six applications, including deliberate
          mismatches.
        </p>
        <button
          type="button"
          onClick={loadExample}
          disabled={busy}
          className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-forest/15 p-3 transition-colors hover:border-forest/40 hover:bg-forest/5 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {EXAMPLE_IMAGES.map(({ image, fileName }) => (
            <Image
              key={fileName}
              src={image}
              alt={fileName}
              sizes="80px"
              className="h-20 w-16 rounded-xl object-contain"
            />
          ))}
          <span className="px-2 text-sm text-forest/70">Load example batch</span>
        </button>
        {exampleError ? (
          <p role="alert" className="mt-3 text-sm text-red-600">
            {exampleError}
          </p>
        ) : null}
        <hr className="mt-8 border-forest/10" />
      </section>

      {/* Inputs: the images and the CSV that pairs application data to them. */}
      <div className={CARD}>
        <h2 className="font-serif text-2xl tracking-tight">Verify a batch</h2>
        <p className="mt-1 text-sm text-white/50">
          Select label images and a CSV with columns imageFile, brandName, classType,
          alcoholContent, netContents, producer, countryOfOrigin. Rows pair to images by filename.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium text-white/80">Label images</span>
            <input
              type="file"
              accept="image/png,image/jpeg"
              multiple
              onChange={onImagesChange}
              className="mt-1.5 w-full text-sm text-white/70 file:mr-3 file:rounded-full file:border-0 file:bg-white/10 file:px-4 file:py-1.5 file:text-white"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-white/80">Application data CSV</span>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={onCsvChange}
              className="mt-1.5 w-full text-sm text-white/70 file:mr-3 file:rounded-full file:border-0 file:bg-white/10 file:px-4 file:py-1.5 file:text-white"
            />
          </label>
        </div>

        {issues.length > 0 && (
          <ul role="alert" className="mt-4 space-y-1 text-sm text-amber-300">
            {issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        )}

        {/* Run controls plus live progress once a run has started. */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={busy || paired.length === 0}
            onClick={() => runBatch(paired.map((_, index) => index))}
            className="rounded-full bg-white px-5 py-2 text-sm font-medium text-forest transition-colors hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Verifying…" : `Verify ${paired.length} label${paired.length === 1 ? "" : "s"}`}
          </button>
          {failedIndices.length > 0 && !busy && (
            <button
              type="button"
              onClick={() => runBatch(failedIndices)}
              className="rounded-full border border-white/25 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10"
            >
              Retry {failedIndices.length} failed
            </button>
          )}
          {runs.length > 0 && (
            <span className="text-sm text-white/50">
              {settled} of {runs.length} processed · {summary.pass} pass · {summary.fail} fail ·{" "}
              {summary.needs_review} review · {summary.error} error
            </span>
          )}
        </div>
      </div>

      {/* One row per paired item; clicking a finished row expands its full result. */}
      {paired.length > 0 && (
        <ul className="space-y-2">
          {paired.map(({ item }, index) => {
            const run = runs[index];
            return (
              <li key={`${item.imageFileName}-${index}`} className={CARD}>
                <button
                  type="button"
                  disabled={run?.state !== "done"}
                  onClick={() => setExpanded(expanded === index ? null : index)}
                  className="flex w-full items-center justify-between gap-3 text-left disabled:cursor-default"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {item.applicationData.brandName}
                    </span>
                    <span className="block truncate text-xs text-white/40">
                      {item.imageFileName}
                    </span>
                  </span>
                  {run?.state === "done" ? (
                    <StatusBadge status={run.result.outcome} />
                  ) : (
                    <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs whitespace-nowrap text-white/60">
                      {run ? (run.state === "error" ? "request failed" : run.state) : "ready"}
                    </span>
                  )}
                </button>
                {run?.state === "error" && (
                  <p className="mt-2 text-xs text-red-300">{run.message}</p>
                )}
                {/* Expanded: the label image beside its results, like the single form.
                    The image only mounts (and decodes) when its card is opened. */}
                {run?.state === "done" && expanded === index && (
                  <div className="mt-4 grid items-start gap-4 lg:grid-cols-2">
                    <div className="rounded-2xl bg-black/20 lg:sticky lg:top-8">
                      {/* Blob previews are local object URLs; next/image is not a fit here. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imageUrls.get(item.imageFileName)}
                        alt={item.imageFileName}
                        className="max-h-128 w-full object-contain p-3"
                      />
                    </div>
                    <VerificationResults result={run.result} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
