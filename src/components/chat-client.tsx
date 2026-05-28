"use client";

import { useState, useTransition } from "react";
import { PromptInputBox } from "@/components/ui/ai-prompt-box";

type Message = { role: "user" | "assistant"; content: string };

export function ChatClient() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Ask me what is due, what changed, or what you should do first.",
    },
  ]);
  const [pending, startTransition] = useTransition();

  function sendMessage(message: string) {
    if (!message.trim()) return;
    setMessages((current) => [...current, { role: "user", content: message }]);
    startTransition(async () => {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await response.json();
      setMessages((current) => [
        ...current,
        { role: "assistant", content: response.ok ? data.answer : data.error },
      ]);
    });
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <div className="min-h-[45vh] space-y-3 rounded-lg border border-border bg-card/70 p-4 shadow-sm backdrop-blur">
        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            className={
              message.role === "user"
                ? "ml-auto max-w-2xl rounded-lg bg-primary px-4 py-3 text-sm text-primary-foreground"
                : "max-w-2xl rounded-lg border border-border bg-background/70 px-4 py-3 text-sm"
            }
          >
            {message.content}
          </div>
        ))}
        {pending ? (
          <div className="max-w-2xl rounded-lg border border-border bg-background/70 px-4 py-3 text-sm text-muted">
            Reading the latest synced Canvas facts...
          </div>
        ) : null}
      </div>
      <PromptInputBox isLoading={pending} onSend={sendMessage} />
    </div>
  );
}
