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
    ? "border-red-200 bg-red-50 dark:bg-red-950/30"
    : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900";
  return (
    <div className={`rounded-xl border ${border} p-6`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className={`text-lg font-semibold ${danger ? "text-red-900" : "text-slate-900 dark:text-slate-100"}`}>{title}</h3>
          {description && <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{description}</p>}
        </div>
        {actions && <div className="ml-4 flex-shrink-0">{actions}</div>}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}
