import { FeatureIcon } from "./icons";
import type { FeatureItem } from "../../data/landing";
import { Section, SectionHeader } from "./Section";

export interface FeaturesSectionProps {
  title: string;
  subtitle?: string;
  features: FeatureItem[];
  align?: "center" | "left";
  className?: string;
  id?: string;
}

export default function FeaturesSection({
  title,
  subtitle,
  features,
  align = "center",
  className,
  id,
}: FeaturesSectionProps) {
  return (
    <Section className={className} id={id}>
      <SectionHeader title={title} subtitle={subtitle} align={align} />
      <div className="mx-auto max-w-5xl space-y-6">
        {features.map((feature, index) => {
          const isEven = index % 2 === 0;
          const reverse = !isEven;
          return (
            <div
              key={feature.title}
              className={`flex flex-col gap-8 rounded-xl border border-slate-200 bg-white p-6 md:p-8 ${
                reverse ? "md:flex-row-reverse" : "md:flex-row"
              }`}
            >
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-700 self-start">
                <FeatureIcon name={feature.icon} props={{ className: "h-7 w-7" }} />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-slate-900">{feature.title}</h3>
                <p className="mt-2 text-slate-600">{feature.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}
