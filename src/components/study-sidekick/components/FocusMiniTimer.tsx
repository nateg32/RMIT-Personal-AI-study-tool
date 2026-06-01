"use client";

import { useEffect, useMemo, useState } from "react";
import {
  FOCUS_TIMER_EVENT,
  FOCUS_TIMER_STORAGE_KEY,
  type FocusTimerSnapshot,
  focusTimerResumeHref,
  focusTimerSecondsLeft,
  isFocusTimerSnapshotVisible,
  readFocusTimerSnapshot,
} from "../lib/focus-timer";

function clock(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const rest = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${rest}`;
}

function statusLabel(snapshot: FocusTimerSnapshot, secondsLeft: number) {
  if (secondsLeft <= 0) return "Check-in ready";
  if (snapshot.phase === "break") return "Break";
  return snapshot.running ? "Focus running" : "Paused";
}

export default function FocusMiniTimer({ onOpen }: { onOpen?: () => void }) {
  const [snapshot, setSnapshot] = useState<FocusTimerSnapshot | null>(() =>
    typeof window === "undefined" ? null : readFocusTimerSnapshot(),
  );
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === FOCUS_TIMER_STORAGE_KEY) {
        setSnapshot(readFocusTimerSnapshot());
        setNow(Date.now());
      }
    };

    const handleFocusEvent = (event: Event) => {
      const detail = event instanceof CustomEvent ? (event.detail as FocusTimerSnapshot | null) : null;
      setSnapshot(detail);
      setNow(Date.now());
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(FOCUS_TIMER_EVENT, handleFocusEvent);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(FOCUS_TIMER_EVENT, handleFocusEvent);
    };
  }, []);

  useEffect(() => {
    if (!snapshot) return;
    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => window.clearInterval(interval);
  }, [snapshot]);

  const view = useMemo(() => {
    if (!snapshot || !isFocusTimerSnapshotVisible(snapshot, now)) return null;
    const secondsLeft = focusTimerSecondsLeft(snapshot, now);
    const progress = Math.max(
      0,
      Math.min(100, ((snapshot.totalSeconds - secondsLeft) / snapshot.totalSeconds) * 100),
    );
    return {
      secondsLeft,
      progress,
      label: statusLabel(snapshot, secondsLeft),
    };
  }, [now, snapshot]);

  if (!snapshot || !view) return null;

  const openFocus = () => {
    window.location.assign(focusTimerResumeHref(snapshot));
    if (!snapshot.href) onOpen?.();
  };

  return (
    <button
      type="button"
      onClick={openFocus}
      className="fixed bottom-24 right-4 z-[65] w-[min(21rem,calc(100vw-2rem))] rounded-lg border-2 border-primary-fixed-dim bg-surface-container-lowest/95 p-sm text-left shadow-xl backdrop-blur-md transition-all hover:-translate-y-0.5 hover:border-primary active:translate-y-0 md:bottom-6 md:right-6"
      style={{ position: "fixed" }}
      aria-label={`Open active focus session, ${clock(view.secondsLeft)} remaining`}
    >
      <div className="flex items-start gap-sm">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-container text-primary">
          <span className="material-symbols-outlined text-[20px]">
            {snapshot.phase === "break" ? "spa" : view.secondsLeft <= 0 ? "task_alt" : "timer"}
          </span>
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-sm">
            <p className="font-label-md text-label-md uppercase tracking-wide text-primary">{view.label}</p>
            <p className="font-label-lg text-label-lg font-bold text-primary">{clock(view.secondsLeft)}</p>
          </div>
          <p className="mt-0.5 truncate font-label-lg text-label-lg font-bold text-on-surface">
            {snapshot.blockName}
          </p>
          {snapshot.task ? (
            <p className="mt-0.5 truncate font-body-sm text-body-sm text-on-surface-variant">{snapshot.task}</p>
          ) : null}
          <div className="mt-sm h-1.5 overflow-hidden rounded-full bg-surface-variant">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${view.progress}%` }} />
          </div>
        </div>
      </div>
    </button>
  );
}
