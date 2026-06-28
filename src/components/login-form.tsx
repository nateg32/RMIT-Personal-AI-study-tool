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
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (message) {
      const url = new URL(window.location.href);
      window.history.replaceState(null, "", url.pathname);
    }
  }, [message]);

  return (
    <form
      className="flex flex-col gap-md"
      style={{ width: "100%" }}
      onSubmit={(event) => {
        event.preventDefault();
        setMessage("");
        startTransition(async () => {
          const response = await fetch(codeSent ? "/api/auth/verify-otp" : "/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(codeSent ? { email, token: code } : { email }),
          });
          const data = await response.json();

          if (!response.ok) {
            setMessage(data.error);
            return;
          }

          if (codeSent) {
            window.location.href = data.redirectTo || "/dashboard";
            return;
          }

          setCodeSent(true);
          setMessage(
            data.demo
              ? data.message
              : "Check your email for the sign-in code, then enter it below.",
          );
        });
      }}
    >
      <label className="flex flex-col gap-xs font-label-md text-label-md text-on-surface">
        RMIT email
        <Input
          autoComplete="email"
          className="h-12 rounded-lg px-md text-body-md"
          name="email"
          type="email"
          placeholder="student@example.com"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>
      {codeSent ? (
        <label className="flex flex-col gap-xs font-label-md text-label-md text-on-surface">
          Sign-in code
          <Input
            autoComplete="one-time-code"
            className="h-12 rounded-lg px-md text-body-md tracking-[0.24em]"
            name="code"
            inputMode="numeric"
            maxLength={10}
            pattern="\d{6,10}"
            placeholder="Code from email"
            required
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 10))}
          />
        </label>
      ) : null}
      <Button className="w-full h-12 rounded-lg text-body-md text-white" disabled={pending} type="submit">
        {codeSent ? "Verify code" : "Send sign-in code"}
      </Button>
      {codeSent ? (
        <button
          className="text-sm font-medium text-primary"
          disabled={pending}
          type="button"
          onClick={() => {
            setCode("");
            setCodeSent(false);
            setMessage("");
          }}
        >
          Use a different email
        </button>
      ) : null}
      {message ? <p className="font-body-md text-body-md text-on-surface-variant">{message}</p> : null}
    </form>
  );
}
