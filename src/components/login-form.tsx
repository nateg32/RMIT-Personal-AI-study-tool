"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";

function getAuthErrorMessage() {
  if (typeof window === "undefined") return "";

  const url = new URL(window.location.href);
  const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
  const error =
    hash.get("error_description") ||
    hash.get("error") ||
    url.searchParams.get("error");

  return error
    ? `${error}. Request a fresh magic link from this page and use the newest email.`
    : "";
}

export function LoginForm() {
  const [message, setMessage] = useState(() => getAuthErrorMessage());
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (message) {
      const url = new URL(window.location.href);
      window.history.replaceState(null, "", url.pathname);
    }
  }, [message]);

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
