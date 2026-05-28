"use client";

import { useState, useTransition } from "react";
import { RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SyncButton() {
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-3">
      <Button
        disabled={pending}
        onClick={() => {
          setMessage("");
          startTransition(async () => {
            const response = await fetch("/api/canvas/sync", { method: "POST" });
            const data = await response.json();
            setMessage(response.ok ? `Synced ${data.courses || 0} courses` : data.error);
          });
        }}
      >
        <RefreshCcw className={pending ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
        Sync now
      </Button>
      {message ? <p className="text-sm text-muted">{message}</p> : null}
    </div>
  );
}
