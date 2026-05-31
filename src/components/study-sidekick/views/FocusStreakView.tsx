"use client";

import { useMemo } from "react";
import ViewHeader from "../components/ViewHeader";
import type { AssignmentSummary, DashboardSummary, StudySessionRecord, StudySidekickActions } from "../types";
import { buildFocusStats } from "../lib/streak";

type FocusStreakViewProps = {
  assignments: AssignmentSummary[];
  dashboard: DashboardSummary;
  sessions: StudySessionRecord[];
  actions: StudySidekickActions;
};

function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-AU").format(value);
}

function formatDayKey(key: string) {
  if (!key) return "No focused day yet";
  const date = new Date(`${key}T00:00:00`);
  if (Number.isNaN(date.getTime())) return key;
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    weekday: "long",
  }).format(date);
}

function completionPercent(sessions: StudySessionRecord[]) {
  const totals = sessions.reduce(
    (acc, session) => {
      const completed = Object.values(session.generatedPlanJson.completedTasks || {}).filter(Boolean).length;
      const total = session.generatedPlanJson.checklist?.length || 0;
      return {
        completed: acc.completed + completed,
        total: acc.total + total,
      };
    },
    { completed: 0, total: 0 },
  );
  return totals.total ? Math.round((totals.completed / totals.total) * 100) : 0;
}

function StatTile({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string | number;
  hint: string;
  icon: string;
}) {
  return (
    <article className="straight-panel rounded-lg border-2 border-surface-variant bg-surface-container-lowest p-md">
      <div className="flex items-start justify-between gap-sm">
        <div>
          <p className="font-label-sm text-label-sm uppercase tracking-wide text-on-surface-variant">{label}</p>
          <p className="mt-xs font-display-sm text-[2rem] font-bold leading-tight text-primary">{value}</p>
        </div>
        <span className="material-symbols-outlined text-[32px] text-primary">{icon}</span>
      </div>
      <p className="mt-xs font-body-md text-body-md text-on-surface-variant">{hint}</p>
    </article>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-3 overflow-hidden rounded-full bg-surface-variant">
      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export default function FocusStreakView({
  assignments,
  dashboard,
  sessions,
  actions,
}: FocusStreakViewProps) {
  const stats = useMemo(() => buildFocusStats(sessions, dashboard.timezone), [dashboard.timezone, sessions]);
  const progressPercent = completionPercent(sessions);
  const nextAssignment = assignments.find((assignment) => !assignment.submittedAt) || assignments[0] || null;
  const earnedBadges = stats.badges.filter((badge) => badge.earned).length;
  const streakLabel =
    stats.protectedStreak === 1 ? "1 day" : `${stats.protectedStreak} days`;

  return (
    <div className="min-h-screen px-margin-desktop pb-lg">
      <ViewHeader title="Focus Analytics" actions={actions} />

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-gutter">
        <section className="straight-panel overflow-hidden rounded-lg border-2 border-primary-fixed-dim bg-primary-container/35 p-lg">
          <div className="grid grid-cols-1 gap-lg lg:grid-cols-[1fr_24rem] lg:items-center">
            <div>
              <p className="font-label-md text-label-md uppercase tracking-wide text-primary">Momentum system</p>
              <h1 className="mt-xs font-display-lg text-display-lg text-primary">
                Level {stats.level.level}: {stats.level.title}
              </h1>
              <p className="mt-sm max-w-3xl font-body-lg text-body-lg text-on-surface-variant">
                Earn XP from completed focus minutes, protect your streak with one useful block a day, and use the numbers
                below to make studying feel visible instead of vague.
              </p>
              <div className="mt-md grid max-w-3xl grid-cols-1 gap-sm sm:grid-cols-3">
                <div className="rounded-lg border-2 border-primary-fixed-dim bg-white/75 p-sm">
                  <p className="font-label-sm text-label-sm uppercase text-on-surface-variant">Total XP</p>
                  <p className="font-headline-md text-headline-md text-primary">{formatNumber(stats.totalXp)}</p>
                </div>
                <div className="rounded-lg border-2 border-primary-fixed-dim bg-white/75 p-sm">
                  <p className="font-label-sm text-label-sm uppercase text-on-surface-variant">Streak</p>
                  <p className="font-headline-md text-headline-md text-primary">{streakLabel}</p>
                </div>
                <div className="rounded-lg border-2 border-primary-fixed-dim bg-white/75 p-sm">
                  <p className="font-label-sm text-label-sm uppercase text-on-surface-variant">Studied</p>
                  <p className="font-headline-md text-headline-md text-primary">{formatMinutes(stats.focusedMinutes)}</p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border-2 border-primary-fixed-dim bg-white/75 p-lg">
              <div className="flex items-start justify-between gap-sm">
                <div>
                  <p className="font-label-md text-label-md uppercase tracking-wide text-primary">Next level</p>
                  <h2 className="font-headline-md text-headline-md text-on-surface">
                    {stats.level.xpToNextLevel} XP to level {stats.level.level + 1}
                  </h2>
                </div>
                <span className="material-symbols-outlined text-[42px] text-primary">military_tech</span>
              </div>
              <div className="mt-md">
                <ProgressBar value={stats.level.progressPercent} />
                <div className="mt-xs flex justify-between font-label-sm text-label-sm text-on-surface-variant">
                  <span>{stats.level.currentLevelXp} XP</span>
                  <span>{stats.level.nextLevelXp} XP</span>
                </div>
              </div>
              <p className="mt-md font-body-md text-body-md text-on-surface-variant">{stats.nextNudge}</p>
              <button
                type="button"
                className="mt-md bubbly-button w-full rounded-full bg-primary py-sm font-bold text-on-primary"
                onClick={actions.onStartSession}
              >
                Earn XP now
              </button>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-gutter md:grid-cols-2 xl:grid-cols-4">
          <StatTile
            icon="timer"
            label="Total studied"
            value={formatMinutes(stats.focusedMinutes)}
            hint={`${stats.startedSessions} sessions started`}
          />
          <StatTile
            icon="local_fire_department"
            label="Current streak"
            value={stats.protectedStreak}
            hint={stats.streakAtRisk ? "At risk today" : "Protected rhythm"}
          />
          <StatTile
            icon="psychology"
            label="Deep sessions"
            value={stats.deepWorkSessions}
            hint="50 minutes or longer"
          />
          <StatTile
            icon="checklist"
            label="Checklist progress"
            value={`${progressPercent}%`}
            hint={`${stats.completedBlocks} blocks ticked`}
          />
        </section>

        <section className="grid grid-cols-1 gap-gutter xl:grid-cols-[1fr_0.82fr]">
          <div className="straight-panel rounded-lg border-2 border-surface-variant bg-surface-container-lowest p-lg">
            <div className="flex flex-col gap-sm md:flex-row md:items-end md:justify-between">
              <div>
                <p className="font-label-md text-label-md uppercase tracking-wide text-primary">Last seven days</p>
                <h2 className="font-headline-lg text-headline-lg text-on-surface">Consistency trail</h2>
              </div>
              <p className="font-body-md text-body-md text-on-surface-variant">
                {stats.weekFocusedDays}/7 focused days - {formatMinutes(stats.weekMinutes)} this week
              </p>
            </div>

            <div className="mt-lg grid grid-cols-7 gap-sm">
              {stats.sevenDayTrail.map((day) => (
                <div key={day.key} className="flex flex-col items-center gap-xs">
                  <div
                    className={`flex h-16 w-full min-w-0 items-center justify-center rounded-lg border-2 ${
                      day.active
                        ? day.focused
                          ? "border-primary bg-primary text-on-primary"
                          : "border-primary-fixed-dim bg-primary-container text-primary"
                        : "border-surface-variant bg-surface-container-low text-on-surface-variant"
                    }`}
                    title={`${day.sessions} sessions, ${day.minutes} focused minutes`}
                  >
                    <span className="material-symbols-outlined text-[26px]">
                      {day.active ? (day.focused ? "check_circle" : "edit_calendar") : "radio_button_unchecked"}
                    </span>
                  </div>
                  <p className="font-label-sm text-label-sm text-on-surface-variant">{day.label}</p>
                  <p className="font-label-sm text-label-sm text-primary">{day.minutes ? formatMinutes(day.minutes) : "-"}</p>
                </div>
              ))}
            </div>

            <div className="mt-lg grid grid-cols-1 gap-sm md:grid-cols-2">
              <div className="rounded-lg border-2 border-primary-fixed-dim bg-primary-container/30 p-md">
                <div className="flex items-center justify-between gap-sm">
                  <p className="font-headline-sm text-headline-sm text-primary">Weekly target</p>
                  <p className="font-label-md text-label-md text-on-surface-variant">{stats.weeklyProgressPercent}%</p>
                </div>
                <div className="mt-sm">
                  <ProgressBar value={stats.weeklyProgressPercent} />
                </div>
                <p className="mt-xs font-body-md text-body-md text-on-surface-variant">
                  {formatMinutes(stats.weekMinutes)} of {formatMinutes(stats.weekGoalMinutes)} focused minutes.
                </p>
              </div>
              <div className="rounded-lg border-2 border-primary-fixed-dim bg-primary-container/30 p-md">
                <div className="flex items-center justify-between gap-sm">
                  <p className="font-headline-sm text-headline-sm text-primary">Consistency score</p>
                  <p className="font-label-md text-label-md text-on-surface-variant">{stats.consistencyScore}/100</p>
                </div>
                <div className="mt-sm">
                  <ProgressBar value={stats.consistencyScore} />
                </div>
                <p className="mt-xs font-body-md text-body-md text-on-surface-variant">
                  Based on focused days, weekly minutes, and session completion.
                </p>
              </div>
            </div>
          </div>

          <aside className="space-y-gutter">
            <div className="straight-panel rounded-lg border-2 border-surface-variant bg-surface-container-lowest p-lg">
              <p className="font-label-md text-label-md uppercase tracking-wide text-primary">Motivation signals</p>
              <div className="mt-md space-y-sm">
                {[
                  ["Average focus", formatMinutes(stats.averageSessionMinutes), "Your typical completed study push."],
                  ["Longest session", formatMinutes(stats.longestSessionMinutes), "Proof that you can sit with harder work."],
                  ["Best day", formatDayKey(stats.bestDay.key), stats.bestDay.minutes ? formatMinutes(stats.bestDay.minutes) : "No minutes yet"],
                  ["Quick wins", stats.quickWinSessions, "Small sessions still count when motivation is low."],
                ].map(([label, value, hint]) => (
                  <div key={label} className="rounded-lg border-2 border-surface-variant bg-white p-sm">
                    <p className="font-label-sm text-label-sm uppercase text-on-surface-variant">{label}</p>
                    <p className="font-headline-sm text-headline-sm text-primary">{value}</p>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">{hint}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="straight-panel rounded-lg border-2 border-surface-variant bg-surface-container-lowest p-lg">
              <p className="font-label-md text-label-md uppercase tracking-wide text-primary">Next easiest win</p>
              <h2 className="mt-xs font-headline-md text-headline-md text-on-surface">
                {nextAssignment ? nextAssignment.name : "Create one short session"}
              </h2>
              <p className="mt-sm font-body-md text-body-md text-on-surface-variant">
                {nextAssignment
                  ? "Use a 25-minute block. The goal is to make starting feel automatic, then let the XP and streak do the feedback work."
                  : "No Canvas task is loaded. Create a custom focus session and count today as a win."}
              </p>
              <button
                type="button"
                className="mt-md bubbly-button w-full rounded-full bg-primary py-sm font-bold text-on-primary"
                onClick={actions.onStartSession}
              >
                Start a small block
              </button>
            </div>

            <div className="straight-panel rounded-lg border-2 border-surface-variant bg-surface-container-lowest p-lg">
              <div className="flex items-center justify-between gap-sm">
                <div>
                  <p className="font-label-md text-label-md uppercase tracking-wide text-primary">Badges</p>
                  <h2 className="font-headline-md text-headline-md text-on-surface">{earnedBadges}/{stats.badges.length} earned</h2>
                </div>
                <span className="material-symbols-outlined text-[40px] text-primary">workspace_premium</span>
              </div>
              <div className="mt-md space-y-sm">
                {stats.badges.map((badge) => (
                  <article
                    key={badge.label}
                    className={`rounded-lg border-2 p-sm ${
                      badge.earned
                        ? "border-primary-fixed-dim bg-primary-container/45"
                        : "border-surface-variant bg-surface-container-low"
                    }`}
                  >
                    <div className="flex items-start gap-sm">
                      <span className="material-symbols-outlined text-primary">{badge.earned ? badge.icon : "lock"}</span>
                      <div>
                        <p className="font-headline-sm text-headline-sm text-on-surface">{badge.label}</p>
                        <p className="font-body-md text-body-md text-on-surface-variant">{badge.description}</p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </aside>
        </section>
      </div>
    </div>
  );
}
