"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart2,
  CalendarClock,
  FileText,
  MessageSquareText,
  Search,
  Send,
  Settings,
  Sparkles,
  TimerReset,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type Action = {
  id: string;
  label: string;
  icon: React.ReactNode;
  description?: string;
  shortcut?: string;
  end?: string;
  href?: string;
};

const defaultActions: Action[] = [
  {
    id: "assignments",
    label: "Review assignments",
    icon: <CalendarClock className="h-4 w-4 text-[var(--warning)]" />,
    description: "Due dates",
    shortcut: "A",
    end: "Open",
    href: "/assignments",
  },
  {
    id: "brief",
    label: "Generate daily brief",
    icon: <Sparkles className="h-4 w-4 text-[var(--primary)]" />,
    description: "Today",
    shortcut: "B",
    end: "Action",
  },
  {
    id: "chat",
    label: "Ask Canvas AI",
    icon: <MessageSquareText className="h-4 w-4 text-[var(--info)]" />,
    description: "Grounded chat",
    shortcut: "C",
    end: "Open",
    href: "/chat",
  },
  {
    id: "sessions",
    label: "Start focus session",
    icon: <TimerReset className="h-4 w-4 text-[var(--primary)]" />,
    description: "Study plan",
    shortcut: "F",
    end: "Open",
    href: "/study-sessions",
  },
  {
    id: "files",
    label: "Check recent files",
    icon: <FileText className="h-4 w-4 text-[var(--info)]" />,
    description: "Canvas files",
    shortcut: "R",
    end: "Open",
    href: "/files",
  },
  {
    id: "settings",
    label: "Canvas connection",
    icon: <Settings className="h-4 w-4 text-muted" />,
    description: "Private token",
    shortcut: "S",
    end: "Settings",
    href: "/settings",
  },
  {
    id: "progress",
    label: "View study progress",
    icon: <BarChart2 className="h-4 w-4 text-[var(--warning)]" />,
    description: "Streaks",
    shortcut: "P",
    end: "Soon",
  },
];

function useDebounce<T>(value: T, delay = 180): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedValue(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

export function ActionSearchBar({
  actions = defaultActions,
  onAction,
  placeholder = "Search actions, files, assignments...",
  className,
}: {
  actions?: Action[];
  onAction?: (action: Action) => void;
  placeholder?: string;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const debouncedQuery = useDebounce(query);

  const result = useMemo(() => {
    const normalized = debouncedQuery.toLowerCase().trim();
    if (!normalized) return actions;
    return actions.filter((action) =>
      `${action.label} ${action.description || ""} ${action.end || ""}`.toLowerCase().includes(normalized),
    );
  }, [actions, debouncedQuery]);

  return (
    <div className={cn("relative w-full max-w-2xl", className)}>
      <label className="sr-only" htmlFor="dashboard-command-search">
        Search dashboard actions
      </label>
      <div className="relative">
        <Input
          id="dashboard-command-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => window.setTimeout(() => setIsFocused(false), 140)}
          placeholder={placeholder}
          className="h-11 rounded-lg border-border bg-card/90 pl-10 pr-10 shadow-sm backdrop-blur"
        />
        <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
          <Search className="h-4 w-4" />
        </div>
        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted">
          <AnimatePresence mode="popLayout">
            {query ? (
              <motion.div
                key="send"
                initial={{ y: -8, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 8, opacity: 0 }}
              >
                <Send className="h-4 w-4" />
              </motion.div>
            ) : (
              <motion.span
                key="hint"
                initial={{ y: -8, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 8, opacity: 0 }}
                className="font-mono text-xs"
              >
                /
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>
        {isFocused ? (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className="absolute left-0 right-0 top-12 z-30 overflow-hidden rounded-lg border border-border bg-card/95 shadow-xl backdrop-blur"
          >
            <ul className="max-h-80 overflow-auto p-1">
              {result.length ? (
                result.map((action) => (
                  <li key={action.id}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm transition hover:bg-background"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => onAction?.(action)}
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background">
                          {action.icon}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{action.label}</span>
                          {action.description ? (
                            <span className="block truncate text-xs text-muted">{action.description}</span>
                          ) : null}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2 text-xs text-muted">
                        {action.shortcut ? <span className="font-mono">{action.shortcut}</span> : null}
                        {action.end ? <span>{action.end}</span> : null}
                      </span>
                    </button>
                  </li>
                ))
              ) : (
                <li className="px-3 py-6 text-center text-sm text-muted">No matching actions.</li>
              )}
            </ul>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
