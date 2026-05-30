import type { StudySessionRecord } from "../types";

const DAY_MS = 24 * 60 * 60 * 1000;

function sessionStatus(session: StudySessionRecord) {
  return session.status.toLowerCase().trim();
}

function completedTaskCount(session: StudySessionRecord) {
  return Object.values(session.generatedPlanJson.completedTasks || {}).filter(Boolean).length;
}

function totalTaskCount(session: StudySessionRecord) {
  return session.generatedPlanJson.checklist?.length || 0;
}

function safeDate(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

export function dayKey(value: string | Date, timezone = "Australia/Sydney") {
  const date = safeDate(value);
  try {
    const parts = new Intl.DateTimeFormat("en-AU", {
      day: "2-digit",
      month: "2-digit",
      timeZone: timezone,
      year: "numeric",
    }).formatToParts(date);
    const year = parts.find((part) => part.type === "year")?.value || `${date.getFullYear()}`;
    const month = parts.find((part) => part.type === "month")?.value || `${date.getMonth() + 1}`.padStart(2, "0");
    const day = parts.find((part) => part.type === "day")?.value || `${date.getDate()}`.padStart(2, "0");
    return `${year}-${month}-${day}`;
  } catch {
    return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}-${`${date.getDate()}`.padStart(2, "0")}`;
  }
}

function dayLabel(value: Date, timezone: string) {
  try {
    return new Intl.DateTimeFormat("en-AU", {
      timeZone: timezone,
      weekday: "short",
    }).format(value);
  } catch {
    return new Intl.DateTimeFormat("en-AU", { weekday: "short" }).format(value);
  }
}

function completedMinutes(session: StudySessionRecord) {
  const status = sessionStatus(session);
  if (["completed", "done"].includes(status)) return session.durationMinutes;
  const completed = completedTaskCount(session);
  const total = totalTaskCount(session);
  if (completed > 0 && total > 0) return Math.max(5, Math.round(session.durationMinutes * (completed / total)));
  if (status === "in_progress") return Math.max(5, Math.round(session.durationMinutes * 0.25));
  return 0;
}

function isFocusSignal(session: StudySessionRecord) {
  const status = sessionStatus(session);
  return ["in_progress", "completed", "done"].includes(status) || completedTaskCount(session) > 0;
}

function countBackwards(activeDays: Set<string>, start: Date, timezone: string) {
  let count = 0;
  for (let offset = 0; offset < 90; offset += 1) {
    const date = new Date(start.getTime() - offset * DAY_MS);
    if (!activeDays.has(dayKey(date, timezone))) break;
    count += 1;
  }
  return count;
}

export function buildFocusStats(
  sessions: StudySessionRecord[],
  timezone = "Australia/Sydney",
  now = new Date(),
) {
  const activeDays = new Set<string>();
  const focusedDays = new Set<string>();
  const today = dayKey(now, timezone);
  const yesterdayDate = new Date(now.getTime() - DAY_MS);
  const yesterday = dayKey(yesterdayDate, timezone);

  let completedBlocks = 0;
  let completedSessions = 0;
  let startedSessions = 0;
  let plannedMinutes = 0;
  let focusedMinutes = 0;
  let todayMinutes = 0;

  const dayTotals = new Map<string, { sessions: number; minutes: number; focused: boolean }>();

  sessions.forEach((session) => {
    const createdKey = dayKey(session.createdAt, timezone);
    const minutes = completedMinutes(session);
    const focused = isFocusSignal(session);
    const focusKey = focused && session.updatedAt ? dayKey(session.updatedAt, timezone) : createdKey;

    activeDays.add(createdKey);
    if (focused) {
      activeDays.add(focusKey);
      focusedDays.add(focusKey);
    }
    completedBlocks += completedTaskCount(session);
    plannedMinutes += session.durationMinutes;
    focusedMinutes += minutes;
    if (focused) startedSessions += 1;
    if (["completed", "done"].includes(sessionStatus(session))) completedSessions += 1;
    if (focusKey === today) todayMinutes += minutes;

    const createdCurrent = dayTotals.get(createdKey) || { focused: false, minutes: 0, sessions: 0 };
    dayTotals.set(createdKey, {
      focused: createdCurrent.focused || (focused && focusKey === createdKey),
      minutes: createdCurrent.minutes + (focusKey === createdKey ? minutes : 0),
      sessions: createdCurrent.sessions + 1,
    });

    if (focused && focusKey !== createdKey) {
      const focusCurrent = dayTotals.get(focusKey) || { focused: false, minutes: 0, sessions: 0 };
      dayTotals.set(focusKey, {
        focused: true,
        minutes: focusCurrent.minutes + minutes,
        sessions: focusCurrent.sessions,
      });
    }
  });

  const currentStreak = countBackwards(activeDays, now, timezone);
  const streakAtRisk = currentStreak === 0 && activeDays.has(yesterday);
  const protectedStreak = currentStreak || countBackwards(activeDays, yesterdayDate, timezone);
  const longestStreak = Array.from(activeDays)
    .sort()
    .reduce(
      (best, key, index, sorted) => {
        if (index === 0) return { current: 1, longest: 1, previous: key };
        const previousDate = new Date(`${best.previous}T00:00:00`);
        const currentDate = new Date(`${key}T00:00:00`);
        const adjacent = Math.round((currentDate.getTime() - previousDate.getTime()) / DAY_MS) === 1;
        const current = adjacent ? best.current + 1 : 1;
        return {
          current,
          longest: Math.max(best.longest, current),
          previous: sorted[index],
        };
      },
      { current: 0, longest: 0, previous: "" },
    ).longest;

  const sevenDayTrail = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now.getTime() - (6 - index) * DAY_MS);
    const key = dayKey(date, timezone);
    const totals = dayTotals.get(key) || { focused: false, minutes: 0, sessions: 0 };
    return {
      active: activeDays.has(key),
      focused: totals.focused,
      key,
      label: dayLabel(date, timezone),
      minutes: totals.minutes,
      sessions: totals.sessions,
    };
  });

  const badges = [
    {
      description: "Create or start one session to begin the loop.",
      earned: activeDays.size > 0,
      icon: "spark",
      label: "Spark started",
    },
    {
      description: "Three steady days turns effort into momentum.",
      earned: protectedStreak >= 3,
      icon: "local_fire_department",
      label: "3-day momentum",
    },
    {
      description: "Seven days means the routine is becoming automatic.",
      earned: protectedStreak >= 7,
      icon: "workspace_premium",
      label: "Weekly rhythm",
    },
    {
      description: "Fourteen days is serious identity-level consistency.",
      earned: protectedStreak >= 14,
      icon: "military_tech",
      label: "Locked-in learner",
    },
  ];

  const nextNudge = activeDays.has(today)
    ? "You have protected today. Finish one small block to make the streak feel earned."
    : streakAtRisk
      ? "Your streak is alive, but today needs one session before midnight."
      : "Start with one tiny session today. The reward is showing up, not perfection.";

  return {
    activeDays: activeDays.size,
    badges,
    completedBlocks,
    completedSessions,
    currentStreak,
    focusedDays: focusedDays.size,
    focusedMinutes,
    longestStreak,
    nextNudge,
    plannedMinutes,
    protectedStreak,
    sevenDayTrail,
    startedSessions,
    streakAtRisk,
    todayActive: activeDays.has(today),
    todayMinutes,
  };
}
