import { type ReactNode, useState } from "react";
import { cn } from "@/lib/utils";
import { Search, Bell, HelpCircle, User, LogOut, Settings as SettingsIcon, Moon, Sun, AlertCircle } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { Button } from "@/components/ui/Button";

export interface TopBarProps {
  onSearchFocus?: () => void;
  onCommandPalette?: () => void;
  notifications?: Array<{ id: string; title: string; message: string; unread: boolean; time: string }>;
  workspaces?: Array<{ id: string; name: string; currency: string }>;
  currentWorkspaceId?: string;
  onWorkspaceChange?: (id: string) => void;
  user?: { name: string; email: string; avatar?: string };
  onLogout?: () => void;
  onSettings?: () => void;
}

export function TopBar({
  onSearchFocus,
  onCommandPalette,
  notifications = [],
  workspaces = [],
  currentWorkspaceId,
  onWorkspaceChange,
  user,
  onLogout,
  onSettings,
}: TopBarProps) {
  const unreadCount = notifications.filter((n) => n.unread).length;

  return (
    <header className="flex h-16 items-center justify-between gap-4 border-b border-color bg-surface px-6">
      <div className="flex items-center gap-4">
        {onCommandPalette && (
          <div className="flex items-center gap-1 rounded-lg border border-input-border bg-surface-alt px-2.5 py-1.5 text-sm text-tertiary min-w-[240px]">
            <kbd className="text-xs text-tertiary">⌘ + K</kbd>
            <span className="text-tertiary">Search…</span>
          </div>
        )}

        {workspaces.length > 1 && onWorkspaceChange && (
          <select
            value={currentWorkspaceId ?? ""}
            onChange={(e) => onWorkspaceChange(e.target.value)}
            className="appearance-none rounded-lg border border-input-border bg-input px-3 py-1.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-primary"
            aria-label="Switch workspace"
          >
            {workspaces.map((ws) => (
              <option key={ws.id} value={ws.id}>
                {ws.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="flex items-center gap-2">
        <ThemeToggle />

        <div className="relative">
          <Button
            variant="ghost"
            size="sm"
            icon={<Bell className="h-5 w-5" />}
            aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
          />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-error text-[10px] font-bold text-on-primary">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </div>

        <Button
          variant="ghost"
          size="sm"
          icon={<HelpCircle className="h-5 w-5" />}
          aria-label="Help"
        />

        {user && (
          <div className="relative group">
            <button
              type="button"
              className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm font-medium text-primary hover:bg-surface-alt focus:outline-none focus:ring-2 focus:ring-primary"
              aria-label="User menu"
              aria-haspopup="menu"
            >
              {user.avatar ? (
                <img src={user.avatar} alt={user.name} className="h-7 w-7 rounded-full object-cover" />
              ) : (
                <User className="h-6 w-6" />
              )}
              <span className="hidden sm:inline-block max-w-[120px] truncate">{user.name}</span>
            </button>
            <div
              role="menu"
              className="invisible absolute right-0 top-full z-40 hidden min-w-48 flex-col gap-1 rounded-lg border border-color bg-surface p-1.5 shadow-lg group-hover:flex"
            >
              <a
                href="#profile"
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-primary hover:bg-surface-alt"
                role="menuitem"
              >
                <User className="h-4 w-4" /> Profile
              </a>
              <a
                href="#settings"
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-primary hover:bg-surface-alt"
                role="menuitem"
                onClick={onSettings}
              >
                <SettingsIcon className="h-4 w-4" /> Settings
              </a>
              <div className="my-1 h-px bg-color-subtle" />
              <button
                onClick={onLogout}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-error-text hover:bg-error-bg"
                role="menuitem"
              >
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

export interface AppShellProps {
  children: ReactNode;
  topBar?: TopBarProps;
  sidebar?: ReactNode;
  bottomBar?: ReactNode;
  className?: string;
}

export function AppShell({ children, topBar, sidebar, bottomBar, className }: AppShellProps) {
  return (
    <div
      className={cn(
        "flex h-screen flex-col bg-page text-primary",
        "overflow-hidden",
        className
      )}
    >
      {topBar && <TopBar {...topBar} />}
      <div className="flex flex-1 overflow-hidden">
        {sidebar && <aside className="flex-shrink-0 overflow-y-auto border-r border-color bg-surface">{sidebar}</aside>}
        <main className="flex-1 overflow-y-auto bg-page p-6">{children}</main>
      </div>
      {bottomBar && <div className="flex-shrink-0 md:hidden">{bottomBar}</div>}
    </div>
  );
}

export default AppShell;
