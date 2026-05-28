"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, BrainCog, Loader2, MessageSquareText, Search, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type PromptMode = "canvas" | "plan" | "search";

type PromptInputBoxProps = {
  onSend?: (message: string) => void;
  isLoading?: boolean;
  placeholder?: string;
  className?: string;
};

const modes: Array<{ id: PromptMode; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: "canvas", label: "Canvas", icon: MessageSquareText },
  { id: "plan", label: "Plan", icon: BrainCog },
  { id: "search", label: "Search", icon: Search },
];

export const PromptInputBox = React.forwardRef<HTMLDivElement, PromptInputBoxProps>(
  (
    {
      onSend = () => {},
      isLoading = false,
      placeholder = "Ask what is due, what changed, or what to do first...",
      className,
    },
    ref,
  ) => {
    const [input, setInput] = React.useState("");
    const [mode, setMode] = React.useState<PromptMode>("canvas");
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);
    const hasContent = input.trim().length > 0;

    React.useEffect(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      textarea.style.height = "0px";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 132)}px`;
    }, [input]);

    const submit = () => {
      const nextInput = input.trim();
      if (!nextInput || isLoading) return;
      const prefix = mode === "canvas" ? "" : `[${mode}:] `;
      onSend(`${prefix}${nextInput}`);
      setInput("");
    };

    return (
      <TooltipPrimitive.Provider delayDuration={180}>
        <div
          ref={ref}
          className={cn(
            "rounded-lg border border-border bg-card/95 p-2 shadow-sm backdrop-blur transition focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15",
            className,
          )}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
            disabled={isLoading}
            placeholder={placeholder}
            rows={1}
            className="max-h-32 min-h-11 w-full resize-none bg-transparent px-2 py-2 text-sm text-foreground outline-none placeholder:text-muted disabled:opacity-60"
          />

          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1">
              {modes.map((item) => {
                const Icon = item.icon;
                const active = mode === item.id;
                return (
                  <TooltipPrimitive.Root key={item.id}>
                    <TooltipPrimitive.Trigger asChild>
                      <button
                        type="button"
                        onClick={() => setMode(item.id)}
                        className={cn(
                          "flex h-8 items-center gap-1 rounded-md border px-2 text-xs transition",
                          active
                            ? "border-primary/50 bg-primary/10 text-primary"
                            : "border-transparent text-muted hover:border-border hover:bg-background",
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        <AnimatePresence initial={false}>
                          {active ? (
                            <motion.span
                              initial={{ width: 0, opacity: 0 }}
                              animate={{ width: "auto", opacity: 1 }}
                              exit={{ width: 0, opacity: 0 }}
                              className="overflow-hidden whitespace-nowrap"
                            >
                              {item.label}
                            </motion.span>
                          ) : null}
                        </AnimatePresence>
                      </button>
                    </TooltipPrimitive.Trigger>
                    <TooltipPrimitive.Portal>
                      <TooltipPrimitive.Content
                        sideOffset={6}
                        className="z-50 rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground shadow-md"
                      >
                        {item.label}
                        <TooltipPrimitive.Arrow className="fill-card" />
                      </TooltipPrimitive.Content>
                    </TooltipPrimitive.Portal>
                  </TooltipPrimitive.Root>
                );
              })}
            </div>

            <TooltipPrimitive.Root>
              <TooltipPrimitive.Trigger asChild>
                <button
                  type="button"
                  onClick={submit}
                  disabled={!hasContent || isLoading}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-md transition disabled:cursor-not-allowed disabled:opacity-50",
                    hasContent ? "bg-primary text-primary-foreground hover:brightness-95" : "bg-background text-muted",
                  )}
                  aria-label="Send message"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : hasContent ? (
                    <ArrowUp className="h-4 w-4" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                </button>
              </TooltipPrimitive.Trigger>
              <TooltipPrimitive.Portal>
                <TooltipPrimitive.Content
                  sideOffset={6}
                  className="z-50 rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground shadow-md"
                >
                  Send
                  <TooltipPrimitive.Arrow className="fill-card" />
                </TooltipPrimitive.Content>
              </TooltipPrimitive.Portal>
            </TooltipPrimitive.Root>
          </div>
        </div>
      </TooltipPrimitive.Provider>
    );
  },
);
PromptInputBox.displayName = "PromptInputBox";
