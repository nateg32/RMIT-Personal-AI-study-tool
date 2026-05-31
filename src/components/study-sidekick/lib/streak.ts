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

export function completedMinutes(session: StudySessionRecord) {
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

export function xpForFocusMinutes(minutes: number) {
  const safeMinutes = Math.max(0, Math.round(minutes));
  if (!safeMinutes) return 0;

  const deepWorkBonus =
    safeMinutes >= 90 ? 140 : safeMinutes >= 50 ? 80 : safeMinutes >= 25 ? 35 : safeMinutes >= 10 ? 10 : 0;

  return safeMinutes * 4 + deepWorkBonus;
}

export function xpForSession(session: StudySessionRecord) {
  return xpForFocusMinutes(completedMinutes(session));
}

export function levelFromXp(totalXp: number) {
  let level = 1;
  let remainingXp = Math.max(0, Math.round(totalXp));
  let nextLevelXp = 500;

  while (remainingXp >= nextLevelXp) {
    remainingXp -= nextLevelXp;
    level += 1;
    nextLevelXp = 500 + (level - 1) * 150;
  }

  const titles = [
    "Getting started",
    "Momentum builder",
    "Steady learner",
    "Deep work regular",
    "Locked-in student",
    "Exam-season calm",
  ];

  return {
    currentLevelXp: remainingXp,
    level,
    nextLevelXp,
    progressPercent: nextLevelXp ? Math.round((remainingXp / nextLevelXp) * 100) : 0,
    title: titles[Math.min(titles.length - 1, level - 1)],
    xpToNextLevel: Math.max(0, nextLevelXp - remainingXp),
  };
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
  let totalXp = 0;
  let longestSessionMinutes = 0;
  let deepWorkSessions = 0;
  let quickWinSessions = 0;

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
    totalXp += xpForFocusMinutes(minutes);
    longestSessionMinutes = Math.max(longestSessionMinutes, minutes);
    if (minutes >= 50) deepWorkSessions += 1;
    if (minutes > 0 && minutes < 25) quickWinSessions += 1;
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
  const weekMinutes = sevenDayTrail.reduce((total, day) => total + day.minutes, 0);
  const weekFocusedDays = sevenDayTrail.filter((day) => day.focused).length;
  const weekGoalMinutes = 180;
  const weeklyProgressPercent = Math.min(100, Math.round((weekMinutes / weekGoalMinutes) * 100));
  const averageSessionMinutes = startedSessions ? Math.round(focusedMinutes / startedSessions) : 0;
  const completionRate = startedSessions ? Math.round((completedSessions / startedSessions) * 100) : 0;
  const consistencyScore = Math.min(
    100,
    Math.round((weekFocusedDays / 7) * 55 + Math.min(1, weekMinutes / weekGoalMinutes) * 35 + (completionRate / 100) * 10),
  );
  const bestDay = Array.from(dayTotals.entries()).reduce(
    (best, [key, value]) => (value.minutes > best.minutes ? { key, minutes: value.minutes } : best),
    { key: "", minutes: 0 },
  );
  const level = levelFromXp(totalXp);

  const badges = [
    {
      description: "Create or start one session to begin the loop.",
      earned: activeDays.size > 0,
      icon: "auto_awesome",
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
    {
      description: "Earn 1,500 XP from focused minutes.",
      earned: totalXp >= 1500,
      icon: "bolt",
      label: "XP collector",
    },
    {
      description: "Complete five deeper sessions of 50 minutes or more.",
      earned: deepWorkSessions >= 5,
      icon: "psychology",
      label: "Deep work mode",
    },
  ];

  const nextNudge = activeDays.has(today)
    ? "You have protected today. Finish one small block to make the streak feel earned."
    : streakAtRisk
      ? "Your streak is alive, but today needs one session before midnight."
      : "Start with one tiny session today. The reward is showing up, not perfection.";

  return {
    activeDays: activeDays.size,
    averageSessionMinutes,
    badges,
    bestDay,
    completedBlocks,
    completedSessions,
    completionRate,
    consistencyScore,
    currentStreak,
    deepWorkSessions,
    focusedDays: focusedDays.size,
    focusedMinutes,
    level,
    longestStreak,
    longestSessionMinutes,
    nextNudge,
    plannedMinutes,
    protectedStreak,
    quickWinSessions,
    sevenDayTrail,
    startedSessions,
    streakAtRisk,
    todayActive: activeDays.has(today),
    todayMinutes,
    totalXp,
    weekFocusedDays,
    weeklyProgressPercent,
    weekGoalMinutes,
    weekMinutes,
  };
}
