"use client";

import { useMemo } from "react";
import ViewHeader from "../components/ViewHeader";
import type { AssignmentSummary, DashboardSummary, RiskLevel, StudySidekickActions } from "../types";
import {
  assignmentTypeLabel,
  estimateEffort,
  formatDate,
  formatRelative,
  isSubmitted,
  riskForAssignment,
  riskTone,
  statusLabel,
} from "../lib/client-utils";

type RiskViewProps = {
  assignments: AssignmentSummary[];
  dashboard: DashboardSummary;
  actions: StudySidekickActions;
  onCreateSession: (assignmentId: string) => void;
  isCreatingSession: boolean;
};

const riskOrder: Record<RiskLevel, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

function uniqueAssignments(assignments: AssignmentSummary[]) {
  const seen = new Set<string>();
  return assignments.filter((assignment) => {
    if (seen.has(assignment.id)) return false;
    seen.add(assignment.id);
    return true;
  });
}

function riskSentence(risk: RiskLevel, count: number) {
  if (risk === "critical") return `${count} item${count === 1 ? "" : "s"} need action within about 24 hours or are already overdue.`;
  if (risk === "high") return `${count} item${count === 1 ? "" : "s"} should be planned in the next few days.`;
  if (risk === "medium") return `${count} item${count === 1 ? "" : "s"} sit in the weekly planning window.`;
  return `${count} item${count === 1 ? "" : "s"} are calm, submitted, or not dated yet.`;
}

export default function RiskView({
  assignments,
  dashboard,
  actions,
  onCreateSession,
  isCreatingSession,
}: RiskViewProps) {
  const openAssignments = useMemo(
    () =>
      uniqueAssignments([
        ...(dashboard.priorityItems || []),
        ...dashboard.dueToday,
        ...dashboard.dueThisWeek,
        ...dashboard.unsubmitted,
        ...assignments,
      ]),
    [assignments, dashboard.dueThisWeek, dashboard.dueToday, dashboard.priorityItems, dashboard.unsubmitted],
  );

  const unsubmitted = useMemo(() => openAssignments.filter((assignment) => !isSubmitted(assignment)), [openAssignments]);
  const topRisks = useMemo(
    () =>
      [...unsubmitted]
        .sort((left, right) => {
          const riskDelta = riskOrder[riskForAssignment(right)] - riskOrder[riskForAssignment(left)];
          if (riskDelta !== 0) return riskDelta;
          const scoreDelta = (right.priorityScore || 0) - (left.priorityScore || 0);
          if (scoreDelta !== 0) return scoreDelta;
          const leftDue = left.dueAt ? new Date(left.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
          const rightDue = right.dueAt ? new Date(right.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
          return leftDue - rightDue;
        })
        .slice(0, 6),
    [unsubmitted],
  );

  const riskCounts = useMemo(
    () =>
      (["critical", "high", "medium", "low"] as const).map((risk) => ({
        count: openAssignments.filter((assignment) => riskForAssignment(assignment) === risk).length,
        risk,
      })),
    [openAssignments],
  );

  const courseBreakdown = useMemo(
    () =>
      [...(dashboard.courseBreakdown || [])].sort(
        (left, right) => riskOrder[right.riskLevel] - riskOrder[left.riskLevel] || right.unsubmittedAssignments - left.unsubmittedAssignments,
      ),
    [dashboard.courseBreakdown],
  );

  const topDriver = topRisks[0];

  return (
    <div className="min-h-screen px-margin-desktop pb-lg">
      <ViewHeader title="Risk Level" actions={actions} />

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-gutter">
        <section className="straight-panel rounded-lg border-2 border-primary-fixed-dim bg-primary-container/30 p-lg">
          <div className="flex flex-col gap-md lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="font-label-md text-label-md uppercase tracking-wide text-primary">Academic risk radar</p>
              <h1 className="mt-xs font-display-lg text-display-lg text-primary capitalize">{dashboard.riskLevel}</h1>
              <p className="mt-sm max-w-3xl font-body-lg text-body-lg text-on-surface-variant">
                This score is based on due dates, submission state, points, and the open Canvas tasks inside your dashboard scope.
              </p>
            </div>
            <div className="flex flex-wrap gap-sm">
              <button
                type="button"
                className="bubbly-button rounded-full border-2 border-primary-fixed-dim bg-white px-lg py-sm font-label-md text-label-md text-primary"
                onClick={actions.onSyncCanvas}
                disabled={actions.isSyncing}
              >
                {actions.isSyncing ? "Syncing..." : "Sync Canvas"}
              </button>
              <button
                type="button"
                className="bubbly-button rounded-full bg-primary px-lg py-sm font-bold text-on-primary"
                onClick={() => actions.onNavigate("assignments")}
              >
                Open tasks
              </button>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-gutter md:grid-cols-4">
          {riskCounts.map(({ count, risk }) => (
            <article key={risk} className={`straight-panel rounded-lg border-2 p-md ${riskTone(risk)}`}>
              <p className="font-label-sm text-label-sm uppercase tracking-wide">{risk}</p>
              <p className="mt-xs font-display-sm text-[2rem] font-bold leading-tight">{count}</p>
              <p className="mt-xs font-body-md text-body-md opacity-80">{riskSentence(risk, count)}</p>
            </article>
          ))}
        </section>

        <section className="grid grid-cols-1 gap-gutter xl:grid-cols-[1.15fr_0.85fr]">
          <div className="straight-panel rounded-lg border-2 border-surface-variant bg-surface-container-lowest p-lg">
            <div className="flex flex-col gap-sm md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-label-md text-label-md uppercase tracking-wide text-primary">What is driving risk</p>
                <h2 className="font-headline-lg text-headline-lg text-on-surface">Start here first</h2>
              </div>
              {topDriver ? (
                <button
                  type="button"
                  className="bubbly-button rounded-full border-2 border-primary-fixed-dim bg-primary-container px-md py-sm font-label-md text-label-md text-primary"
                  onClick={() => onCreateSession(topDriver.id)}
                  disabled={isCreatingSession}
                >
                  Plan top task
                </button>
              ) : null}
            </div>

            <div className="mt-md space-y-sm">
              {topRisks.length ? (
                topRisks.map((assignment) => {
                  const risk = riskForAssignment(assignment);
                  return (
                    <article
                      key={assignment.id}
                      className="rounded-lg border-2 border-surface-variant bg-surface-container-low p-md"
                    >
                      <div className="flex flex-col gap-sm md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                          <div className="mb-xs flex flex-wrap items-center gap-xs">
                            <span className={`rounded-full border px-sm py-1 font-label-sm text-label-sm ${riskTone(risk)}`}>
                              {risk}
                            </span>
                            <span className="rounded-full bg-white px-sm py-1 font-label-sm text-label-sm text-on-surface-variant">
                              {assignmentTypeLabel(assignment)}
                            </span>
                            <span className="rounded-full bg-white px-sm py-1 font-label-sm text-label-sm text-on-surface-variant">
                              {statusLabel(assignment)}
                            </span>
                          </div>
                          <h3 className="font-headline-md text-headline-md text-on-surface">{assignment.name}</h3>
                          <p className="mt-xs font-body-md text-body-md text-on-surface-variant">
                            {assignment.courseName} - {formatDate(assignment.dueAt)} - {formatRelative(assignment.dueAt)}
                          </p>
                          {assignment.priorityReason ? (
                            <p className="mt-xs font-label-md text-label-md text-primary">{assignment.priorityReason}</p>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-xs">
                          <button
                            type="button"
                            className="bubbly-button rounded-full border-2 border-primary-fixed-dim bg-white px-md py-xs font-label-md text-label-md text-primary"
                            onClick={() => onCreateSession(assignment.id)}
                            disabled={isCreatingSession}
                          >
                            Plan
                          </button>
                          {assignment.htmlUrl ? (
                            <button
                              type="button"
                              className="bubbly-button rounded-full border-2 border-surface-variant bg-white px-md py-xs font-label-md text-label-md text-on-surface"
                              onClick={() => window.open(assignment.htmlUrl || undefined, "_blank", "noopener,noreferrer")}
                            >
                              Canvas
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  );
                })
              ) : (
                <div className="rounded-lg border-2 border-dashed border-outline-variant bg-surface-container-low p-xl text-center">
                  <span className="material-symbols-outlined text-[48px] text-primary">task_alt</span>
                  <p className="mt-sm font-headline-md text-headline-md text-primary">Nothing urgent is showing.</p>
                  <p className="font-body-md text-body-md text-on-surface-variant">
                    Sync Canvas or reset hidden items if you expected more assignments here.
                  </p>
                </div>
              )}
            </div>
          </div>

          <aside className="space-y-gutter">
            <div className="straight-panel rounded-lg border-2 border-surface-variant bg-surface-container-lowest p-lg">
              <p className="font-label-md text-label-md uppercase tracking-wide text-primary">Today&apos;s move</p>
              <h2 className="mt-xs font-headline-md text-headline-md text-on-surface">
                {topDriver ? topDriver.name : "Keep the system fresh"}
              </h2>
              <p className="mt-sm font-body-md text-body-md text-on-surface-variant">
                {topDriver
                  ? `${estimateEffort(topDriver)} is a realistic first pass. Open the brief, confirm the deliverables, then start a focused block.`
                  : "Use Sync Canvas, then check the assignments page for anything hidden or unsynced."}
              </p>
              <button
                type="button"
                className="mt-md bubbly-button w-full rounded-full bg-primary py-sm font-bold text-on-primary"
                onClick={() => (topDriver ? onCreateSession(topDriver.id) : actions.onSyncCanvas())}
                disabled={isCreatingSession || actions.isSyncing}
              >
                {topDriver ? "Create focus plan" : "Sync Canvas"}
              </button>
            </div>

            <div className="straight-panel rounded-lg border-2 border-surface-variant bg-surface-container-lowest p-lg">
              <p className="font-label-md text-label-md uppercase tracking-wide text-primary">By subject</p>
              <div className="mt-md space-y-sm">
                {courseBreakdown.slice(0, 6).map((course) => (
                  <button
                    key={course.courseId}
                    type="button"
                    className="w-full rounded-lg border-2 border-surface-variant bg-surface-container-low p-sm text-left bubbly-button"
                    onClick={() => actions.onNavigate("courses")}
                  >
                    <div className="flex items-start justify-between gap-sm">
                      <div className="min-w-0">
                        <p className="font-label-sm text-label-sm uppercase text-on-surface-variant">
                          {course.courseCode || "Canvas course"}
                        </p>
                        <p className="font-headline-sm text-headline-sm text-on-surface line-clamp-2">{course.name}</p>
                      </div>
                      <span className={`rounded-full border px-sm py-1 font-label-sm text-label-sm ${riskTone(course.riskLevel)}`}>
                        {course.riskLevel}
                      </span>
                    </div>
                    <p className="mt-xs font-label-md text-label-md text-on-surface-variant">
                      {course.unsubmittedAssignments} open - {course.dueToday + course.dueThisWeek} due this week
                    </p>
                  </button>
                ))}
                {!courseBreakdown.length ? (
                  <p className="font-body-md text-body-md text-on-surface-variant">No course breakdown yet. Run a Canvas sync first.</p>
                ) : null}
              </div>
            </div>
          </aside>
        </section>
      </div>
    </div>
  );
}
