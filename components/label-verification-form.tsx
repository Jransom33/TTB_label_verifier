"use client";

import { useState, type FormEvent } from "react";
import { LabelExamples, type LabelExample } from "@/components/label-examples";
import { LabelImageUpload } from "@/components/label-image-upload";
import { CARD, FIELD_LABELS, VerificationResults } from "@/components/verification-results";
import type { ApplicationData } from "@/domain/application";
import type { VerificationResult } from "@/domain/verification";
import type { VerificationField } from "@/domain/verification-rules";

// Input constraints mirror applicationDataSchema; the server remains the authority.
const TEXT_FIELDS: {
  name: Exclude<VerificationField, "governmentWarning">;
  required?: boolean;
  maxLength: number;
  placeholder: string;
}[] = [
  { name: "brandName", required: true, maxLength: 200, placeholder: "Old Tom Distillery" },
  {
    name: "classType",
    required: true,
    maxLength: 200,
    placeholder: "Kentucky Straight Bourbon Whiskey",
  },
  {
    name: "alcoholContent",
    required: true,
    maxLength: 100,
    placeholder: "45% Alc./Vol. (90 Proof)",
  },
  { name: "netContents", required: true, maxLength: 100, placeholder: "750 mL" },
  { name: "producer", maxLength: 500, placeholder: "Old Tom Distilling Co., Bardstown, KY" },
  { name: "countryOfOrigin", maxLength: 100, placeholder: "United States" },
];

const FALLBACK_ERROR = "The request could not be completed. Try again later.";

export function LabelVerificationForm() {
  const [file, setFile] = useState<File | null>(null);
  const [values, setValues] = useState<Partial<ApplicationData>>({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VerificationResult | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file || pending) return;
    setPending(true);
    setError(null);
    setResult(null);

    // Trim every text entry and omit blank optional fields entirely.
    const applicationData = Object.fromEntries(
      Object.entries(values)
        .map(([key, value]) => [key, value?.trim()])
        .filter(([, value]) => value),
    );

    const body = new FormData();
    body.set("image", file);
    body.set("applicationData", JSON.stringify(applicationData));

    try {
      const response = await fetch("/api/verifications", { method: "POST", body });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.message || FALLBACK_ERROR);
      setResult(payload.data);
    } catch (caught) {
      setError(caught instanceof Error && caught.message ? caught.message : FALLBACK_ERROR);
    } finally {
      setPending(false);
    }
  };

  // Prefill the form from a bundled example and load its image as the upload file.
  const applyExample = async ({ image, fileName, applicationData }: LabelExample) => {
    setValues(applicationData);
    setError(null);
    setResult(null);
    try {
      setFile(new File([await (await fetch(image.src)).blob()], fileName, { type: "image/png" }));
    } catch {
      setError(FALLBACK_ERROR);
    }
  };

  return (
    <div className="w-full max-w-5xl">
      <LabelExamples onSelect={applyExample} />
      <form onSubmit={onSubmit} className="grid w-full items-start gap-6 lg:grid-cols-2">
        {/* Sticky so the label image stays visible while comparing results. */}
        <div className={`${CARD} lg:sticky lg:top-8`}>
          <LabelImageUpload file={file} onFileChange={setFile} />
        </div>
        {/* Form for entering application data */}
        <div className="space-y-6">
          <div className={CARD}>
            <h2 className="font-serif text-2xl tracking-tight">Verify a label</h2>
            <p className="mt-1 text-sm text-white/50">
              Enter the application values the label should match.
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {TEXT_FIELDS.map(({ name, required, maxLength, placeholder }) => (
                <label key={name} className="block text-sm">
                  <span className="font-medium text-white/80">
                    {FIELD_LABELS[name]}
                    {!required && (
                      <span className="ml-1.5 text-xs font-normal text-white/40">Optional</span>
                    )}
                  </span>
                  <input
                    name={name}
                    required={required}
                    maxLength={maxLength}
                    placeholder={placeholder}
                    value={values[name] ?? ""}
                    onChange={(event) =>
                      setValues((prev) => ({ ...prev, [name]: event.target.value }))
                    }
                    className="mt-1.5 w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-white placeholder:text-white/30 outline-none transition-colors focus:border-white/50"
                  />
                </label>
              ))}
            </div>
            {/* Submit button and optional fields message */}
            <div className="mt-6 flex items-center justify-between gap-3">
              <p className="text-xs text-white/40">
                {file
                  ? "Optional fields are verified only when supplied."
                  : "Add a label image to submit."}
              </p>
              <button
                type="submit"
                disabled={!file || pending}
                className="rounded-full bg-white px-5 py-2 text-sm font-medium text-forest transition-colors hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pending ? "Verifying…" : "Verify label"}
              </button>
            </div>

            {error ? (
              <p role="alert" className="mt-4 text-sm text-red-300">
                {error}
              </p>
            ) : null}
          </div>
          {/* Display the verification results */}
          {result ? <VerificationResults result={result} /> : null}
        </div>
      </form>
    </div>
  );
}
