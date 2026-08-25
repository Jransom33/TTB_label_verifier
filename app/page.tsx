"use client";

// The page is a client component only for this one piece of state: which
// verification mode (single label or batch CSV) is currently shown.
import { useState } from "react";
import { BatchVerification } from "@/components/batch-verification";
import { LabelVerificationForm } from "@/components/label-verification-form";

const MODES = [
  { id: "single", label: "Single label" },
  { id: "batch", label: "Batch CSV" },
] as const;

export default function Home() {
  const [mode, setMode] = useState<(typeof MODES)[number]["id"]>("single");

  return (
    <main className="flex min-h-screen flex-col items-center bg-[#f4f4f2] px-4 py-16">
      <h1 className="max-w-2xl text-center font-serif text-5xl leading-tight tracking-tight text-forest">
        TTB Label Verifier
      </h1>
      <p className="mt-3 max-w-md text-center text-sm text-forest/60">
        Compare a label image against the application data it should match.
      </p>

      {/* Mode toggle: one label at a time, or a CSV-driven batch. */}
      <div className="mt-6 mb-10 flex rounded-full border border-forest/15 bg-white p-1">
        {MODES.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setMode(id)}
            className={`rounded-full px-5 py-1.5 text-sm font-medium transition-colors ${
              mode === id ? "bg-forest text-white" : "text-forest/60 hover:text-forest"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "single" ? <LabelVerificationForm /> : <BatchVerification />}
    </main>
  );
}
