"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";

export function CanvasConnectForm() {
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setMessage("");
        startTransition(async () => {
          const response = await fetch("/api/onboarding/connect-canvas", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              canvasBaseUrl: form.get("canvasBaseUrl"),
              accessToken: form.get("accessToken"),
            }),
          });
          const data = await response.json();
          setMessage(response.ok ? "Canvas connected. Run Sync now." : data.error);
        });
      }}
    >
      <label className="block space-y-2 text-sm font-medium">
        <span>Canvas base URL</span>
        <Input name="canvasBaseUrl" defaultValue="https://rmit.instructure.com" required />
      </label>
      <label className="block space-y-2 text-sm font-medium">
        <span>Canvas access token</span>
        <Input name="accessToken" type="password" autoComplete="off" required />
      </label>
      <div className="flex items-center gap-3">
        <Button disabled={pending} type="submit">
          Save connection
        </Button>
        {message ? <p className="text-sm text-muted">{message}</p> : null}
      </div>
    </form>
  );
}
