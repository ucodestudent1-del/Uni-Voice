import React from "react";

interface SettingsCardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  danger?: boolean;
}

export default function SettingsCard({ title, description, children, actions, danger = false }: SettingsCardProps) {
  const border = danger
    ? "status-error-border status-error-bg dark:bg-error-bg"
    : "border-color-subtle border-color bg-surface";
  return (
    <div className={`rounded-xl border ${border} p-6`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className={`text-lg font-semibold ${danger ? "status-error-text" : "text-inverse"}`}>{title}</h3>
          {description && <p className="mt-1 text-sm text-secondary text-tertiary">{description}</p>}
        </div>
        {actions && <div className="ml-4 flex-shrink-0">{actions}</div>}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}








