"use client";

import { Search, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

type AnimatedGlowingSearchBarProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> & {
  wrapperClassName?: string;
};

export function AnimatedGlowingSearchBar({
  className,
  wrapperClassName,
  placeholder = "Search...",
  ...props
}: AnimatedGlowingSearchBarProps) {
  return (
    <div className={cn("relative w-full", wrapperClassName)}>
      <div className="group relative">
        <div className="absolute -inset-[1px] -z-0 overflow-hidden rounded-full opacity-60 blur-[2px] transition group-hover:opacity-90 group-focus-within:opacity-100">
          <div className="absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 animate-[gradient-rotate_7s_linear_infinite] bg-[conic-gradient(from_var(--gradient-angle),transparent_0deg,var(--primary)_70deg,transparent_128deg,var(--info)_190deg,var(--warning)_250deg,transparent_320deg)]" />
        </div>
        <div className="relative flex h-12 items-center rounded-full border-2 border-surface-variant bg-card/95 shadow-sm backdrop-blur">
          <Search className="ml-3 h-4 w-4 text-muted" />
          <input
            className={cn(
              "h-full min-w-0 flex-1 bg-transparent px-3 text-sm text-foreground outline-none placeholder:text-muted",
              className,
            )}
            placeholder={placeholder}
            {...props}
          />
          <div className="mr-2 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface-container text-muted">
            <SlidersHorizontal className="h-4 w-4" />
          </div>
        </div>
      </div>
    </div>
  );
}
