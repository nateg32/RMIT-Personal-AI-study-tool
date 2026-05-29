import type { StudySidekickActions } from "../types";

type ViewHeaderProps = {
  title?: string;
  searchPlaceholder: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  actions: StudySidekickActions;
};

export default function ViewHeader({
  title = "Study Command Centre",
  searchPlaceholder,
  searchValue,
  onSearchChange,
  actions,
}: ViewHeaderProps) {
  return (
    <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md mb-lg -mx-margin-desktop px-margin-desktop py-md">
      <div className="flex justify-between items-center w-full max-w-7xl mx-auto">
        <div className="flex items-center gap-md flex-1 min-w-0">
          <span className="font-headline-lg text-headline-lg font-bold text-primary whitespace-nowrap">
            {title}
          </span>
          <div className="hidden lg:flex items-center bg-surface-container rounded-full px-md py-xs border-2 border-surface-variant flex-1 max-w-md">
            <span className="material-symbols-outlined text-on-surface-variant mr-sm">search</span>
            <input
              className="bg-transparent border-none focus:outline-none focus:ring-0 text-body-md w-full placeholder:text-on-surface-variant/50"
              placeholder={searchPlaceholder}
              type="search"
              value={searchValue}
              onChange={(event) => onSearchChange(event.target.value)}
            />
          </div>
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
        <p className="max-w-7xl mx-auto mt-sm font-label-md text-label-md text-on-surface-variant">
          {actions.actionMessage}
        </p>
      ) : null}
    </header>
  );
}
