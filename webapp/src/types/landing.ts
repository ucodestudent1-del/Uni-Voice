import type { ReactNode } from "react";

export interface FeatureItem {
  title: string;
  description: string;
  icon: FeatureIcon;
  details: ReactNode;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface TemplateModule {
  id: string;
  name: string;
  description: string;
  color: "slate" | "primary" | "teal" | "amber";
  accentColor: string;
  preview: ReactNode;
}

export type FeatureIcon =
  | "calculator"
  | "document-lock"
  | "shield-lock"
  | "globe-currency"
  | "clock-arrow"
  | "document-sparkle";
