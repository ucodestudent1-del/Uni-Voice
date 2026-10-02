import type { FeatureItem, FeatureIcon } from "@/types/landing";
import { Section, SectionHeader } from "./Section";
import { Calculator, FileLock, Shield, Globe, Clock, FileText } from "lucide-react";
import type { ComponentType } from "react";
import type { SVGProps } from "react";

const iconMap: Record<FeatureIcon, ComponentType<SVGProps<SVGSVGElement>>> = {
  calculator: Calculator,
  "document-lock": FileLock,
  "shield-lock": Shield,
  "globe-currency": Globe,
  "clock-arrow": Clock,
  "document-sparkle": FileText,
};

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
      <div className="mx-auto max-w-5xl space-y-4">
        {features.map((feature) => {
          const Icon = iconMap[feature.icon];
          return (
            <div
              key={feature.title}
              className="flex flex-col gap-6 rounded-xl border border-color-subtle bg-surface p-6 md:flex-row md:items-start"
            >
              <div className="flex-shrink-0 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-bg text-primary">
                <Icon className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-primary">{feature.title}</h3>
                <p className="mt-2 text-secondary">{feature.description}</p>
                {feature.details}
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}
