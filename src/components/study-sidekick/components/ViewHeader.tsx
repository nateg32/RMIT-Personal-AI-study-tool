import type { StudySidekickActions } from "../types";

type ViewHeaderProps = {
  title?: string;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  actions: StudySidekickActions;
  showSearch?: boolean;
};

export default function ViewHeader({
  title = "Study Command Centre",
  actions,
}: ViewHeaderProps) {
  return (
    <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md mb-lg -mx-margin-desktop px-margin-desktop py-md">
      <div className="flex justify-between items-center w-full max-w-7xl mx-auto">
        <div className="flex items-center gap-md flex-1 min-w-0">
          <span className="font-headline-lg text-headline-lg font-bold text-primary whitespace-nowrap">
            {title}
          </span>
        </div>
        <nav className="flex items-center gap-sm">
          <button
            type="button"
            className="p-sm rounded-full text-on-surface-variant hover:bg-primary-container/50 transition-all duration-200 active:scale-95"
            onClick={actions.onOpenAnnouncements}
            aria-label="Open announcements"
          >
            <span className="material-symbols-outlined">notifications</span>
          </button>
          <button
            type="button"
            className="p-sm rounded-full text-on-surface-variant hover:bg-primary-container/50 transition-all duration-200 active:scale-95"
            onClick={() => actions.onOpenChat("What should I focus on today?")}
            aria-label="Ask Sidekick"
          >
            <span className="material-symbols-outlined">auto_awesome</span>
          </button>
          <button
            type="button"
            className="w-10 h-10 rounded-full bg-primary-container border-2 border-primary overflow-hidden hover:scale-105 transition-transform flex items-center justify-center"
            onClick={actions.onOpenSettings}
            aria-label="Open settings"
          >
            <span className="material-symbols-outlined text-primary">person</span>
          </button>
        </nav>
      </div>
      {actions.actionMessage ? (
        <div className="max-w-7xl mx-auto mt-sm" aria-live="polite" role="status">
          <p className="soft-status-pill inline-flex max-w-full items-center gap-xs rounded-full border-2 border-primary-fixed-dim bg-primary-container/45 px-sm py-xs font-label-md text-label-md text-primary">
            <span className="status-dot h-2 w-2 shrink-0 rounded-full bg-primary" />
            <span className="truncate">{actions.actionMessage}</span>
          </p>
        </div>
      ) : null}
    </header>
  );
}
