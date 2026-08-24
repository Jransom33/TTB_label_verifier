import { LabelVerificationForm } from "@/components/label-verification-form";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center bg-[#f4f4f2] px-4 py-16">
      <h1 className="max-w-2xl text-center font-serif text-5xl leading-tight tracking-tight text-forest">
        TTB Label Verifier
      </h1>
      <p className="mt-3 mb-10 max-w-md text-center text-sm text-forest/60">
        Compare a label image against the application data it should match.
      </p>
      <LabelVerificationForm />
    </main>
  );
}
