"use client";

import { useState, type FormEvent } from "react";
import ViewHeader from "../components/ViewHeader";
import type { DashboardSummary, StudySidekickActions } from "../types";

const categories = [
  "Canvas sync",
  "Login or account",
  "AI chat",
  "Study sessions",
  "Files or uploads",
  "Dashboard data",
  "Bug or broken button",
  "Feature request",
  "Other",
] as const;

const priorities = ["Low", "Normal", "High", "Urgent"] as const;

type TicketResponse = {
  ok: boolean;
  ticketId: string;
};

type SupportViewProps = {
  dashboard: DashboardSummary;
  actions: StudySidekickActions;
};

export default function SupportView({ dashboard, actions }: SupportViewProps) {
  const [category, setCategory] = useState<(typeof categories)[number]>("Canvas sync");
  const [priority, setPriority] = useState<(typeof priorities)[number]>("Normal");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [stepsToReproduce, setStepsToReproduce] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [lastSubmittedAt, setLastSubmittedAt] = useState<number | null>(null);

  const submitTicket = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;
    if (lastSubmittedAt && Date.now() - lastSubmittedAt < 10_000) {
      setMessage("Give it a few seconds before sending another ticket. This keeps the support desk clean.");
      return;
    }

    setIsSubmitting(true);
    setMessage(null);
    setTicketId(null);

    try {
      const response = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          priority,
          subject,
          description,
          stepsToReproduce,
          currentUrl: typeof window !== "undefined" ? window.location.href : "",
          userAgent: typeof window !== "undefined" ? window.navigator.userAgent : "",
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as Partial<TicketResponse> & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not submit support ticket.");

      setTicketId(payload.ticketId || null);
      setLastSubmittedAt(Date.now());
      setMessage("Ticket sent to the configured support inbox.");
      setSubject("");
      setDescription("");
      setStepsToReproduce("");
      setPriority("Normal");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not submit support ticket.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="px-margin-desktop pb-xl min-h-screen">
      <ViewHeader
        title="Support Desk"
        searchPlaceholder="Search support..."
        searchValue=""
        onSearchChange={() => undefined}
        actions={actions}
        showSearch={false}
      />

      <div className="max-w-7xl mx-auto w-full">
        <section className="mb-lg grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-gutter items-end">
          <div>
            <p className="font-label-md text-label-md text-primary uppercase tracking-widest font-bold mb-xs">
              Help desk
            </p>
            <h1 className="font-display-lg text-display-lg text-primary">Report an issue</h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant max-w-3xl mt-xs">
              Send a clean support ticket with what happened, where it happened, and what you tried. It goes straight
              to the configured support inbox.
            </p>
          </div>
          <div className="bg-primary-container/30 border-2 border-primary-fixed-dim rounded-lg p-md">
            <p className="font-label-sm text-label-sm text-primary uppercase tracking-widest font-bold">Signed in as</p>
            <p className="font-headline-md text-headline-md text-on-surface mt-xs">{dashboard.userName}</p>
            <p className="font-body-md text-on-surface-variant mt-xs">
              Last Canvas sync: {dashboard.lastSuccessfulSyncAt || dashboard.lastSyncAt || "Never"}
            </p>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
          <form
            className="lg:col-span-8 straight-panel bg-surface-container-lowest border-2 border-primary-fixed-dim rounded-lg p-lg"
            onSubmit={submitTicket}
          >
            <div className="flex items-center gap-sm mb-md">
              <span className="material-symbols-outlined text-primary">confirmation_number</span>
              <h2 className="font-headline-md text-headline-md text-primary">New ticket</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-sm">
              <label className="block">
                <span className="font-label-md text-label-md text-on-surface-variant">Category</span>
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value as (typeof categories)[number])}
                  className="mt-xs w-full bg-white border-2 border-surface-variant rounded-lg p-sm font-body-md focus:outline-none focus:border-primary"
                >
                  {categories.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="font-label-md text-label-md text-on-surface-variant">Priority</span>
                <select
                  value={priority}
                  onChange={(event) => setPriority(event.target.value as (typeof priorities)[number])}
                  className="mt-xs w-full bg-white border-2 border-surface-variant rounded-lg p-sm font-body-md focus:outline-none focus:border-primary"
                >
                  {priorities.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block mt-md">
              <span className="font-label-md text-label-md text-on-surface-variant">Short summary</span>
              <input
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                className="mt-xs w-full bg-white border-2 border-surface-variant rounded-lg p-sm font-body-md focus:outline-none focus:border-primary"
                placeholder="Example: Canvas sync times out on Cloud Foundations"
                minLength={4}
                maxLength={160}
                required
              />
            </label>

            <label className="block mt-md">
              <span className="font-label-md text-label-md text-on-surface-variant">What happened?</span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="mt-xs w-full bg-white border-2 border-surface-variant rounded-lg p-sm font-body-md focus:outline-none focus:border-primary min-h-40 resize-y"
                placeholder="Tell us what you expected, what actually happened, and any error message you saw."
                minLength={12}
                maxLength={4000}
                required
              />
            </label>

            <label className="block mt-md">
              <span className="font-label-md text-label-md text-on-surface-variant">Steps you tried</span>
              <textarea
                value={stepsToReproduce}
                onChange={(event) => setStepsToReproduce(event.target.value)}
                className="mt-xs w-full bg-white border-2 border-surface-variant rounded-lg p-sm font-body-md focus:outline-none focus:border-primary min-h-28 resize-y"
                placeholder="Optional: list the buttons you clicked or anything you already tried."
                maxLength={2000}
              />
            </label>

            <div className="mt-md rounded-lg border-2 border-surface-variant bg-surface-container p-sm">
              <p className="font-label-md text-label-md text-on-surface-variant">
                The ticket includes your signed-in profile, this page URL, and browser info. It never includes Canvas
                tokens, Gemini keys, or uploaded file contents.
              </p>
              <p className="mt-xs font-label-md text-label-md text-on-surface-variant">
                Spam protection is active: duplicate tickets, repeated text, and rapid-fire submissions are blocked.
              </p>
            </div>

            <button
              type="submit"
              className="mt-md w-full bg-primary text-on-primary rounded-full py-md font-bold bubbly-button disabled:opacity-60 flex items-center justify-center gap-sm"
              disabled={isSubmitting}
            >
              <span className="material-symbols-outlined">{isSubmitting ? "sync" : "send"}</span>
              {isSubmitting ? "Sending ticket..." : "Send support ticket"}
            </button>

            {message ? (
              <div
                className={`mt-md rounded-lg border-2 p-md ${
                  ticketId ? "border-primary-fixed-dim bg-primary-container/30" : "border-error/30 bg-error-container/50"
                }`}
              >
                <p className="font-body-md text-on-surface">{message}</p>
                {ticketId ? (
                  <p className="font-label-md text-label-md text-primary mt-xs">Reference: {ticketId}</p>
                ) : null}
              </div>
            ) : null}
          </form>

          <aside className="lg:col-span-4 space-y-gutter">
            <div className="straight-panel bg-surface-container-lowest border-2 border-surface-variant rounded-lg p-md">
              <div className="flex items-center gap-sm mb-sm">
                <span className="material-symbols-outlined text-primary">support_agent</span>
                <h3 className="font-headline-md text-headline-md text-primary">What to include</h3>
              </div>
              <ul className="space-y-sm font-body-md text-on-surface-variant">
                <li>Which page or button broke.</li>
                <li>The exact error text if you saw one.</li>
                <li>What course, assignment, or file was involved.</li>
                <li>Whether it happens every time or only sometimes.</li>
              </ul>
            </div>

            <div className="straight-panel bg-primary-container/25 border-2 border-primary-fixed-dim rounded-lg p-md">
              <div className="flex items-center gap-sm mb-sm">
                <span className="material-symbols-outlined text-primary">privacy_tip</span>
                <h3 className="font-headline-md text-headline-md text-primary">Privacy</h3>
              </div>
              <p className="font-body-md text-on-surface-variant">
                Keep passwords and access tokens out of the ticket. If a token may have leaked, rotate it in Canvas and
                reconnect from Settings.
              </p>
            </div>

            <div className="straight-panel bg-surface-container-lowest border-2 border-surface-variant rounded-lg p-md">
              <div className="flex items-center gap-sm mb-sm">
                <span className="material-symbols-outlined text-primary">shield</span>
                <h3 className="font-headline-md text-headline-md text-primary">Anti-spam</h3>
              </div>
              <p className="font-body-md text-on-surface-variant">
                The support desk accepts a few clean reports per hour and blocks exact duplicates. If you need to add
                more detail, update the description instead of sending the same ticket again.
              </p>
            </div>

            <button
              type="button"
              className="w-full bg-white border-2 border-primary-fixed-dim text-primary rounded-full py-sm font-label-md text-label-md bubbly-button flex items-center justify-center gap-sm"
              onClick={() => actions.onOpenChat("Help me write a support ticket for the issue I am seeing.")}
            >
              <span className="material-symbols-outlined">auto_awesome</span>
              Draft with AI first
            </button>
          </aside>
        </div>
      </div>
    </div>
  );
}
