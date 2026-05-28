"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";

export function LoginForm() {
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
          const response = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: form.get("email") }),
          });
          const data = await response.json();
          setMessage(
            response.ok
              ? data.demo
                ? data.message
                : "Check your email for a magic link."
              : data.error,
          );
        });
      }}
    >
      <Input name="email" type="email" placeholder="s4169571@student.rmit.edu.au" required />
      <Button className="w-full" disabled={pending} type="submit">
        Send magic link
      </Button>
      {message ? <p className="text-sm text-muted">{message}</p> : null}
    </form>
  );
}
