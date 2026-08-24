import type {
  FieldStatus,
  VerificationOutcome,
  VerificationResult,
} from "@/domain/verification";
import type { VerificationField } from "@/domain/verification-rules";

// Shared card chrome and field display names, also used by the form.
export const CARD = "rounded-3xl bg-card p-6 text-white shadow-[0_24px_60px_rgba(20,28,26,0.28)]";

export const FIELD_LABELS: Record<VerificationField, string> = {
  brandName: "Brand name",
  classType: "Class / type",
  alcoholContent: "Alcohol content",
  netContents: "Net contents",
  producer: "Producer",
  countryOfOrigin: "Country of origin",
  governmentWarning: "Government warning",
};

const STATUS_TONE: Record<FieldStatus | VerificationOutcome, string> = {
  match: "bg-emerald-400/15 text-emerald-300",
  pass: "bg-emerald-400/15 text-emerald-300",
  needs_review: "bg-amber-400/15 text-amber-300",
  mismatch: "bg-red-400/15 text-red-300",
  fail: "bg-red-400/15 text-red-300",
  missing: "bg-white/10 text-white/60",
  unreadable: "bg-white/10 text-white/60",
};

const StatusBadge = ({ status }: { status: FieldStatus | VerificationOutcome }) => (
  <span
    className={`rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${STATUS_TONE[status]}`}
  >
    {status.replace("_", " ")}
  </span>
);

export function VerificationResults({
  result,
  elapsedMs,
}: {
  result: VerificationResult;
  elapsedMs?: number | null;
}) {
  return (
    <section className={CARD}>
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-2xl tracking-tight">
          Result
          {elapsedMs != null && (
            <span className="ml-2 text-sm font-sans text-white/40">
              in {(elapsedMs / 1000).toFixed(1)}s
            </span>
          )}
        </h3>
        <StatusBadge status={result.outcome} />
      </div>
      <ul className="mt-4 space-y-3">
        {result.fields.map((field) => (
          <li key={field.field} className="rounded-2xl bg-black/20 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">{FIELD_LABELS[field.field]}</p>
              <StatusBadge status={field.status} />
            </div>
            <dl className="mt-2 space-y-1 text-xs">
              <div className="flex gap-2">
                <dt className="w-16 shrink-0 text-white/40">Expected</dt>
                <dd className="text-white/70">{field.expected ?? "—"}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-16 shrink-0 text-white/40">Extracted</dt>
                <dd className="text-white/70">{field.extracted ?? "Not read from label"}</dd>
              </div>
            </dl>
            {field.explanation ? (
              <p className="mt-1 text-xs text-white/50">{field.explanation}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
