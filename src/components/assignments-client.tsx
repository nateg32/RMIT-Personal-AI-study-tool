"use client";

import { useMemo, useState, useTransition } from "react";
import { X } from "lucide-react";
import { AssignmentCard } from "@/components/assignment-card";
import { AnimatedGlowingSearchBar } from "@/components/ui/animated-glowing-search-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isSubmitted, sortByPriority } from "@/lib/prioritization";
import type { CanvasAssignmentSummary, StudyPlan } from "@/lib/types";

export function AssignmentsClient({
  assignments,
  timezone,
}: {
  assignments: CanvasAssignmentSummary[];
  timezone: string;
}) {
  const [status, setStatus] = useState("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<CanvasAssignmentSummary | null>(null);
  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const normalized = query.toLowerCase();
    return sortByPriority(assignments).filter((assignment) => {
      if (status === "submitted" && !isSubmitted(assignment)) return false;
      if (status === "unsubmitted" && isSubmitted(assignment)) return false;
      return `${assignment.courseName} ${assignment.name}`.toLowerCase().includes(normalized);
    });
  }, [assignments, query, status]);

  function createStudySession(form: HTMLFormElement) {
    if (!selected) return;
    const data = new FormData(form);
    setMessage("");
    startTransition(async () => {
      const response = await fetch("/api/study-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId: selected.id,
          durationMinutes: Number(data.get("durationMinutes")),
          mode: data.get("mode"),
          energyLevel: data.get("energyLevel"),
          targetOutcome: data.get("targetOutcome"),
        }),
      });
      const json = await response.json();
      if (response.ok) {
        setPlan(json.plan);
        setMessage("Study session saved.");
      } else {
        setMessage(json.error);
      }
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card/85 p-3 shadow-sm backdrop-blur sm:flex-row">
        <AnimatedGlowingSearchBar
          placeholder="Search assignments"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          wrapperClassName="sm:flex-1"
        />
        <select
          className="h-11 rounded-md border border-border bg-card px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="all">All statuses</option>
          <option value="unsubmitted">Unsubmitted</option>
          <option value="submitted">Submitted</option>
        </select>
      </div>
      <div className="grid gap-4">
        {filtered.map((assignment) => (
          <AssignmentCard
            key={assignment.id}
            assignment={assignment}
            timezone={timezone}
            onCreate={(next) => {
              setSelected(next);
              setPlan(null);
              setMessage("");
            }}
          />
        ))}
      </div>

      {selected ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <Card className="max-h-[90vh] w-full max-w-2xl overflow-auto">
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <Badge tone="neutral">{selected.courseName}</Badge>
                <CardTitle className="mt-3">Create study session</CardTitle>
                <p className="mt-1 text-sm text-muted">{selected.name}</p>
              </div>
              <Button variant="ghost" onClick={() => setSelected(null)} aria-label="Close">
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <form
                className="grid gap-4 sm:grid-cols-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  createStudySession(event.currentTarget);
                }}
              >
                <label className="space-y-2 text-sm font-medium">
                  <span>How long?</span>
                  <select name="durationMinutes" className="h-10 w-full rounded-md border border-border bg-card px-3">
                    <option value="30">30 min</option>
                    <option value="60">1 hour</option>
                    <option value="90">90 min</option>
                    <option value="120">2 hours</option>
                  </select>
                </label>
                <label className="space-y-2 text-sm font-medium">
                  <span>Mode</span>
                  <select name="mode" className="h-10 w-full rounded-md border border-border bg-card px-3">
                    <option>Understand task</option>
                    <option>Plan assignment</option>
                    <option>Write draft</option>
                    <option>Final review</option>
                    <option>Emergency mode</option>
                  </select>
                </label>
                <label className="space-y-2 text-sm font-medium">
                  <span>Energy</span>
                  <select name="energyLevel" className="h-10 w-full rounded-md border border-border bg-card px-3">
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                  </select>
                </label>
                <label className="space-y-2 text-sm font-medium">
                  <span>Target</span>
                  <select name="targetOutcome" className="h-10 w-full rounded-md border border-border bg-card px-3">
                    <option>Just complete</option>
                    <option>Credit</option>
                    <option>Distinction</option>
                    <option>HD</option>
                  </select>
                </label>
                <div className="sm:col-span-2">
                  <Button disabled={pending} type="submit">
                    Generate session
                  </Button>
                  {message ? <p className="mt-3 text-sm text-muted">{message}</p> : null}
                </div>
              </form>

              {plan ? (
                <div className="mt-6 space-y-4">
                  <h3 className="text-lg font-semibold">{plan.title}</h3>
                  {plan.assignmentBrief ? (
                    <p className="rounded-lg border border-border bg-background/70 p-3 text-sm text-muted">
                      {plan.assignmentBrief}
                    </p>
                  ) : null}
                  {plan.rubricFocus?.length ? (
                    <div className="flex flex-wrap gap-2">
                      {plan.rubricFocus.slice(0, 4).map((item) => (
                        <Badge key={item} tone="medium" className="max-w-full">
                          {item}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                  {plan.blocks.map((block) => (
                    <div key={block.name} className="rounded-lg border border-border p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium">{block.name}</p>
                        <Badge tone="medium">{block.minutes} min</Badge>
                      </div>
                      {block.goal ? <p className="mt-2 text-sm text-muted">{block.goal}</p> : null}
                      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted">
                        {block.tasks.map((task) => (
                          <li key={task}>{task}</li>
                        ))}
                      </ul>
                      {block.breakMinutes ? (
                        <p className="mt-3 text-xs text-primary">Break after block: {block.breakMinutes} min</p>
                      ) : null}
                    </div>
                  ))}
                  <Button type="button" onClick={() => window.location.assign("/study-sessions")}>
                    Start focus timer
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
