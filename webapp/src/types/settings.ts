import type { ReactNode } from "react";

export type SettingsTab =
  | "general"
  | "business"
  | "invoicing"
  | "payments"
  | "taxes"
  | "notifications"
  | "templates"
  | "team"
  | "integrations"
  | "security"
  | "billing"
  | "account"
  | "theme";

export interface SettingsNavItem {
  id: SettingsTab;
  label: string;
  description?: string;
  icon: ReactNode;
}

export interface SettingsSection {
  id: string;
  heading?: string;
  items: SettingsNavItem[];
}
