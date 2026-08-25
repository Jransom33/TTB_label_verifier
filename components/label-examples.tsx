import Image, { type StaticImageData } from "next/image";
import type { ApplicationData } from "@/domain/application";
import sakura from "@/examples/Sakura_sake.png";
import tenuta from "@/examples/Tenuta_wine.png";
import oldTom from "@/examples/old_toms_distillery.png";

// Bundled sample labels with the application values each one should match.
export const LABEL_EXAMPLES = [
  {
    id: "sakura",
    name: "Sakura Moon",
    image: sakura,
    fileName: "Sakura_sake.png",
    applicationData: {
      brandName: "SAKURA MOON",
      classType: "SAKE",
      alcoholContent: "15% ALC./VOL.",
      netContents: "720 mL",
      countryOfOrigin: "PRODUCT OF JAPAN",
    },
  },
  {
    id: "old-tom",
    name: "Old Tom Distillery",
    image: oldTom,
    fileName: "old_toms_distillery.png",
    applicationData: {
      brandName: "OLD TOM DISTILLERY",
      classType: "KENTUCKY STRAIGHT BOURBON WHISKEY",
      alcoholContent: "45% Alc./Vol. (90 Proof)",
      netContents: "750 mL",
    },
  },
  {
    id: "tenuta",
    name: "Tenuta Belmonte",
    image: tenuta,
    fileName: "Tenuta_wine.png",
    applicationData: {
      brandName: "TENUTA BELMONTE",
      classType: "CHIANTI CLASSICO",
      alcoholContent: "13.5% ALC./VOL.",
      netContents: "750 mL",
      producer: "TENUTA BELMONTE S.R.L., GREVE IN CHIANTI, ITALY",
      countryOfOrigin: "PRODUCT OF ITALY",
    },
  },
] satisfies {
  id: string;
  name: string;
  image: StaticImageData;
  fileName: string;
  applicationData: ApplicationData;
}[];

export type LabelExample = (typeof LABEL_EXAMPLES)[number];

export function LabelExamples({ onSelect }: { onSelect: (example: LabelExample) => void }) {
  return (
    <section className="mb-8">
      <h2 className="text-sm font-medium text-forest/80">Try an example</h2>
      <p className="mt-1 text-xs text-forest/50">
        Click a label to load its image and the application values it should match.
      </p>
      <div className="mt-4 flex flex-wrap gap-4">
        {LABEL_EXAMPLES.map((example) => (
          <button
            key={example.id}
            type="button"
            onClick={() => onSelect(example)}
            className="flex w-40 flex-col items-center gap-2 rounded-2xl border border-forest/15 p-3 transition-colors hover:border-forest/40 hover:bg-forest/5"
          >
            <Image
              src={example.image}
              alt={`${example.name} label`}
              sizes="160px"
              className="h-28 w-full rounded-xl object-contain"
            />
            <span className="text-sm text-forest/70">{example.name}</span>
          </button>
        ))}
      </div>
      <hr className="mt-8 border-forest/10" />
    </section>
  );
}
