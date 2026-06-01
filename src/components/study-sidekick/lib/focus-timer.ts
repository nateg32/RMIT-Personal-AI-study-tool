"use client";

export const FOCUS_TIMER_STORAGE_KEY = "study-sidekick-focus-timer-v1";
export const FOCUS_TIMER_EVENT = "study-sidekick-focus-timer-change";

export type FocusTimerPhase = "focus" | "break" | "complete";

export type FocusTimerSnapshot = {
  id: string;
  timerKey: string;
  title: string;
  blockName: string;
  task?: string | null;
  phase: FocusTimerPhase;
  totalSeconds: number;
  secondsLeft: number;
  running: boolean;
  endsAt?: number | null;
  href?: string | null;
  source: "canvas" | "custom";
  sessionId?: string | null;
  assignmentId?: string | null;
  customSessionId?: string | null;
  activeBlockIndex: number;
  updatedAt: number;
};

const COMPLETED_VISIBLE_MS = 30 * 60 * 1000;
const PAUSED_VISIBLE_MS = 12 * 60 * 60 * 1000;

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normaliseSnapshot(value: unknown): FocusTimerSnapshot | null {
  if (!isObject(value)) return null;
  if (
    typeof value.id !== "string" ||
    typeof value.timerKey !== "string" ||
    typeof value.title !== "string" ||
    typeof value.blockName !== "string" ||
    typeof value.totalSeconds !== "number" ||
    typeof value.secondsLeft !== "number" ||
    typeof value.running !== "boolean" ||
    typeof value.updatedAt !== "number"
  ) {
    return null;
  }

  return {
    id: value.id,
    timerKey: value.timerKey,
    title: value.title,
    blockName: value.blockName,
    task: typeof value.task === "string" ? value.task : null,
    phase: value.phase === "break" || value.phase === "complete" ? value.phase : "focus",
    totalSeconds: Math.max(1, value.totalSeconds),
    secondsLeft: Math.max(0, value.secondsLeft),
    running: value.running,
    endsAt: typeof value.endsAt === "number" ? value.endsAt : null,
    href: typeof value.href === "string" ? value.href : null,
    source: value.source === "custom" ? "custom" : "canvas",
    sessionId: typeof value.sessionId === "string" ? value.sessionId : null,
    assignmentId: typeof value.assignmentId === "string" ? value.assignmentId : null,
    customSessionId: typeof value.customSessionId === "string" ? value.customSessionId : null,
    activeBlockIndex: typeof value.activeBlockIndex === "number" ? Math.max(0, value.activeBlockIndex) : 0,
    updatedAt: value.updatedAt,
  };
}

function emitFocusTimerChange(snapshot: FocusTimerSnapshot | null) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(FOCUS_TIMER_EVENT, { detail: snapshot }));
}

export function readFocusTimerSnapshot() {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(FOCUS_TIMER_STORAGE_KEY);
    if (!stored) return null;
    return normaliseSnapshot(JSON.parse(stored));
  } catch {
    window.localStorage.removeItem(FOCUS_TIMER_STORAGE_KEY);
    return null;
  }
}

export function writeFocusTimerSnapshot(snapshot: FocusTimerSnapshot) {
  if (typeof window === "undefined") return;
  const safeSnapshot = normaliseSnapshot(snapshot);
  if (!safeSnapshot) return;
  window.localStorage.setItem(FOCUS_TIMER_STORAGE_KEY, JSON.stringify(safeSnapshot));
  emitFocusTimerChange(safeSnapshot);
}

export function clearFocusTimerSnapshot() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(FOCUS_TIMER_STORAGE_KEY);
  emitFocusTimerChange(null);
}

export function focusTimerResumeHref(snapshot: FocusTimerSnapshot, origin?: string) {
  const base = snapshot.href || "/study-sessions";
  const url = new URL(base, origin || (typeof window === "undefined" ? "http://localhost" : window.location.origin));
  url.searchParams.set("focus", "1");
  url.searchParams.set("resume", "1");
  url.searchParams.set("block", String(snapshot.activeBlockIndex));
  url.searchParams.set("stage", snapshot.phase === "break" || snapshot.phase === "complete" ? "break" : "focus");

  if (snapshot.sessionId) url.searchParams.set("sessionId", snapshot.sessionId);
  if (snapshot.assignmentId) url.searchParams.set("assignmentId", snapshot.assignmentId);
  if (snapshot.customSessionId) url.searchParams.set("customSessionId", snapshot.customSessionId);

  return `${url.pathname}${url.search}`;
}

export function focusTimerSecondsLeft(snapshot: FocusTimerSnapshot, now = Date.now()) {
  if (snapshot.running && snapshot.endsAt) {
    return Math.max(0, Math.ceil((snapshot.endsAt - now) / 1000));
  }
  return Math.max(0, snapshot.secondsLeft);
}

export function isFocusTimerSnapshotVisible(snapshot: FocusTimerSnapshot | null, now = Date.now()) {
  if (!snapshot) return false;
  const secondsLeft = focusTimerSecondsLeft(snapshot, now);
  if (secondsLeft > 0) return now - snapshot.updatedAt < PAUSED_VISIBLE_MS;
  return now - snapshot.updatedAt < COMPLETED_VISIBLE_MS;
}
