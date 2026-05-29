"use client";

import { useState, useTransition } from "react";
import { RefreshCcw } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";

export function SyncButton() {
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const needsConnection = message.toLowerCase().includes("canvas is not connected");

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        disabled={pending}
        onClick={() => {
          setMessage("");
          startTransition(async () => {
            const response = await fetch("/api/canvas/sync", { method: "POST" });
            const data = await response.json();
            setMessage(
              response.ok
                ? `Synced ${data.courses || 0} courses`
                : data.error || "Sync failed",
            );
          });
        }}
      >
        <RefreshCcw className={pending ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
        Sync now
      </Button>
      {message ? (
        <p className={needsConnection ? "text-sm text-warning" : "text-sm text-muted"}>
          {needsConnection ? "Canvas is not connected for this deployment yet." : message}
        </p>
      ) : null}
      {needsConnection ? (
        <ButtonLink href="/settings" variant="secondary">
          Connect Canvas
        </ButtonLink>
      ) : null}
    </div>
  );
}
