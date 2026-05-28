"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DailyBriefButton() {
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-3">
      <Button
        data-daily-brief-button
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            const response = await fetch("/api/daily-brief/generate", { method: "POST" });
            const data = await response.json();
            setMessage(response.ok ? data.brief.summary : data.error);
          });
        }}
      >
        <Sparkles className="h-4 w-4" />
        Generate brief
      </Button>
      {message ? <p className="text-sm text-muted">{message}</p> : null}
    </div>
  );
}
