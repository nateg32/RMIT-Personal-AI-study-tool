"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { CheckCircle2, Pause, Play, RotateCcw, SkipForward } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { StudyPlan } from "@/lib/types";
import { cn } from "@/lib/utils";

type StudySessionRunnerProps = {
  sessionId: string;
  initialPlan: StudyPlan;
  status: string;
};

function secondsToClock(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${remainder.toString().padStart(2, "0")}`;
}

function taskKey(blockIndex: number, taskIndex: number) {
  return `${blockIndex}:${taskIndex}`;
}

export function StudySessionRunner({ sessionId, initialPlan, status }: StudySessionRunnerProps) {
  const [plan, setPlan] = useState(initialPlan);
  const [activeBlockIndex, setActiveBlockIndex] = useState(initialPlan.activeBlockIndex || 0);
  const [remainingSeconds, setRemainingSeconds] = useState(
    (initialPlan.blocks?.[initialPlan.activeBlockIndex || 0]?.minutes || 25) * 60,
  );
  const [running, setRunning] = useState(false);
  const [pending, startTransition] = useTransition();
  const activeBlock = plan.blocks[activeBlockIndex] || plan.blocks[0];
  const blockSeconds = Math.max(60, (activeBlock?.minutes || 1) * 60);
  const completedTasks = plan.completedTasks || {};

  const progress = useMemo(() => {
    if (!activeBlock) return 0;
    return Math.min(100, Math.max(0, ((blockSeconds - remainingSeconds) / blockSeconds) * 100));
  }, [activeBlock, blockSeconds, remainingSeconds]);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      setRemainingSeconds((current) => {
        if (current <= 1) {
          setRunning(false);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  function persist(nextPlan: StudyPlan, nextStatus = status) {
    startTransition(async () => {
      await fetch(`/api/study-sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus, generatedPlanJson: nextPlan }),
      });
    });
  }

  function toggleTask(blockIndex: number, nextTaskIndex: number) {
    const nextPlan = {
      ...plan,
      completedTasks: {
        ...completedTasks,
        [taskKey(blockIndex, nextTaskIndex)]: !completedTasks[taskKey(blockIndex, nextTaskIndex)],
      },
    };
    setPlan(nextPlan);
    persist(nextPlan, "active");
  }

  function jumpToBlock(nextIndex: number) {
    const nextBlock = plan.blocks[nextIndex];
    if (!nextBlock) return;
    const nextPlan = { ...plan, activeBlockIndex: nextIndex };
    setActiveBlockIndex(nextIndex);
    setRemainingSeconds(nextBlock.minutes * 60);
    setRunning(false);
    setPlan(nextPlan);
    persist(nextPlan, "active");
  }

  if (!activeBlock) return null;

  return (
    <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
      <div className="rounded-lg border border-border bg-background/70 p-5">
        <div
          className="mx-auto grid h-48 w-48 place-items-center rounded-full border border-border"
          style={{
            background: `conic-gradient(var(--primary) ${progress * 3.6}deg, color-mix(in srgb, var(--border) 80%, transparent) 0deg)`,
          }}
        >
          <div className="grid h-40 w-40 place-items-center rounded-full bg-card text-center shadow-inner">
            <div>
              <p className="font-mono text-4xl font-semibold">{secondsToClock(remainingSeconds)}</p>
              <p className="mt-1 text-xs text-muted">{activeBlock.name}</p>
            </div>
          </div>
        </div>
        <div className="mt-5 flex justify-center gap-2">
          <Button
            type="button"
            onClick={() => setRunning((current) => !current)}
            className="min-w-24"
            disabled={pending}
          >
            {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {running ? "Pause" : "Start"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setRemainingSeconds(blockSeconds)}
            aria-label="Reset timer"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => jumpToBlock(Math.min(activeBlockIndex + 1, plan.blocks.length - 1))}
            aria-label="Next block"
          >
            <SkipForward className="h-4 w-4" />
          </Button>
        </div>
        {activeBlock.breakMinutes ? (
          <p className="mt-4 rounded-md bg-primary/10 px-3 py-2 text-center text-xs text-primary">
            Break after this: {activeBlock.breakMinutes} min
          </p>
        ) : null}
      </div>

      <div className="space-y-4">
        <div>
          {plan.assignmentBrief ? <p className="text-sm text-muted">{plan.assignmentBrief}</p> : null}
          {plan.rubricFocus?.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {plan.rubricFocus.slice(0, 4).map((item) => (
                <Badge key={item} tone="medium" className="max-w-full truncate">
                  {item}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>

        <div className="grid gap-3">
          {plan.blocks.map((block, blockIndex) => (
            <div
              key={`${block.name}-${blockIndex}`}
              className={cn(
                "rounded-lg border p-4 transition",
                blockIndex === activeBlockIndex ? "border-primary bg-primary/5" : "border-border bg-card/80",
              )}
            >
              <button
                type="button"
                className="flex w-full items-start justify-between gap-3 text-left"
                onClick={() => jumpToBlock(blockIndex)}
              >
                <span>
                  <span className="font-medium">{block.name}</span>
                  {block.goal ? <span className="mt-1 block text-sm text-muted">{block.goal}</span> : null}
                </span>
                <Badge tone={blockIndex === activeBlockIndex ? "high" : "neutral"}>{block.minutes} min</Badge>
              </button>
              <div className="mt-3 grid gap-2">
                {block.tasks.map((task, taskIndex) => {
                  const checked = Boolean(completedTasks[taskKey(blockIndex, taskIndex)]);
                  return (
                    <label key={task} className="flex cursor-pointer items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleTask(blockIndex, taskIndex)}
                        className="mt-1 h-4 w-4 accent-[var(--primary)]"
                      />
                      <span className={checked ? "text-muted line-through" : ""}>{task}</span>
                    </label>
                  );
                })}
              </div>
              {block.resources?.length ? (
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted">
                  {block.resources.map((resource) => (
                    <span key={resource} className="rounded-md border border-border px-2 py-1">
                      {resource}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-border bg-card/80 p-4">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            Definition of done
          </div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
            {plan.definitionOfDone.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
