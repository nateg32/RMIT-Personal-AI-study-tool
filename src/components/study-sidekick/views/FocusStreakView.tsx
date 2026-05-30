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
      <ViewHeader title="Focus Streak" actions={actions} />

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-gutter">
        <section className="straight-panel overflow-hidden rounded-lg border-2 border-primary-fixed-dim bg-primary-container/35 p-lg">
          <div className="grid grid-cols-1 gap-lg lg:grid-cols-[1fr_22rem] lg:items-center">
            <div>
              <p className="font-label-md text-label-md uppercase tracking-wide text-primary">Tiny wins, repeated daily</p>
              <h1 className="mt-xs font-display-lg text-display-lg text-primary">
                {stats.streakAtRisk ? `${streakLabel} at risk` : `${streakLabel} streak`}
              </h1>
              <p className="mt-sm max-w-3xl font-body-lg text-body-lg text-on-surface-variant">
                A streak is counted when you create, start, or make progress on a study session. The goal is psychological:
                lower the friction, protect the identity, and reward showing up.
              </p>
              <div className="mt-md flex flex-wrap gap-sm">
                <button
                  type="button"
                  className="bubbly-button rounded-full bg-primary px-lg py-sm font-bold text-on-primary"
                  onClick={actions.onStartSession}
                >
                  Protect today
                </button>
                <button
                  type="button"
                  className="bubbly-button rounded-full border-2 border-primary-fixed-dim bg-white px-lg py-sm font-label-md text-label-md text-primary"
                  onClick={() => actions.onOpenChat("Help me protect my focus streak today with the smallest useful study block.")}
                >
                  Ask for a tiny plan
                </button>
              </div>
            </div>

            <div className="rounded-lg border-2 border-primary-fixed-dim bg-white/70 p-lg text-center">
              <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full border-4 border-primary-fixed-dim bg-primary-container">
                <span className="material-symbols-outlined text-[64px] text-primary">local_fire_department</span>
              </div>
              <p className="mt-md font-headline-md text-headline-md text-primary">
                {stats.todayActive ? "Today is protected" : "Today needs one block"}
              </p>
              <p className="mt-xs font-body-md text-body-md text-on-surface-variant">{stats.nextNudge}</p>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-gutter md:grid-cols-4">
          {[
            ["Current streak", stats.protectedStreak, stats.streakAtRisk ? "At risk today" : "Protected rhythm"],
            ["Longest streak", stats.longestStreak, "Best run so far"],
            ["Focus minutes", formatMinutes(stats.focusedMinutes), "Logged through sessions"],
            ["Blocks ticked", stats.completedBlocks, `${progressPercent}% checklist progress`],
          ].map(([label, value, hint]) => (
            <article key={label} className="straight-panel rounded-lg border-2 border-surface-variant bg-surface-container-lowest p-md">
              <p className="font-label-sm text-label-sm uppercase tracking-wide text-on-surface-variant">{label}</p>
              <p className="mt-xs font-display-sm text-[2rem] font-bold leading-tight text-primary">{value}</p>
              <p className="mt-xs font-body-md text-body-md text-on-surface-variant">{hint}</p>
            </article>
          ))}
        </section>

        <section className="grid grid-cols-1 gap-gutter xl:grid-cols-[1fr_0.8fr]">
          <div className="straight-panel rounded-lg border-2 border-surface-variant bg-surface-container-lowest p-lg">
            <div className="flex flex-col gap-sm md:flex-row md:items-end md:justify-between">
              <div>
                <p className="font-label-md text-label-md uppercase tracking-wide text-primary">Last seven days</p>
                <h2 className="font-headline-lg text-headline-lg text-on-surface">Consistency trail</h2>
              </div>
              <p className="font-body-md text-body-md text-on-surface-variant">
                {stats.focusedDays} focused days - {stats.startedSessions} sessions started
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

            <div className="mt-lg rounded-lg border-2 border-primary-fixed-dim bg-primary-container/30 p-md">
              <p className="font-headline-sm text-headline-sm text-primary">Reward loop</p>
              <p className="mt-xs font-body-md text-body-md text-on-surface-variant">
                Keep the reward tiny and immediate: start a session, finish one block, then close the day with a checked
                streak dot. The app counts the habit automatically from saved sessions.
              </p>
            </div>
          </div>

          <aside className="space-y-gutter">
            <div className="straight-panel rounded-lg border-2 border-surface-variant bg-surface-container-lowest p-lg">
              <p className="font-label-md text-label-md uppercase tracking-wide text-primary">Today&apos;s easiest win</p>
              <h2 className="mt-xs font-headline-md text-headline-md text-on-surface">
                {nextAssignment ? nextAssignment.name : "Create one short session"}
              </h2>
              <p className="mt-sm font-body-md text-body-md text-on-surface-variant">
                {nextAssignment
                  ? `Use a 25-minute block. The goal is not finishing everything, just opening the loop and making the next step obvious.`
                  : "No Canvas task is loaded. Create a custom focus session and count today as a win."}
              </p>
              <button
                type="button"
                className="mt-md bubbly-button w-full rounded-full bg-primary py-sm font-bold text-on-primary"
                onClick={actions.onStartSession}
              >
                Start the smallest block
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
