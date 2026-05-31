"use client";

import { useMemo, useState } from "react";
import { personalGreeting } from "@/lib/display";
import ViewHeader from "../components/ViewHeader";
import type {
  AssignmentSummary,
  CourseDashboardSummary,
  DailyBrief,
  DashboardSummary,
  StudySessionRecord,
  StudySidekickActions,
} from "../types";
import { assignmentTypeLabel, estimateEffort, formatRelative, riskTone, statusLabel } from "../lib/client-utils";
import { buildFocusStats } from "../lib/streak";

type DashboardViewProps = {
  dashboard: DashboardSummary;
  dailyBrief: DailyBrief | null;
  sessions: StudySessionRecord[];
  actions: StudySidekickActions;
  onCreateSession: (assignmentId: string) => void;
};

function MissionCard({
  assignment,
  index,
  onCreateSession,
  disabled,
  disabledReason,
}: {
  assignment: AssignmentSummary;
  index: number;
  onCreateSession: (assignmentId: string) => void;
  disabled?: boolean;
  disabledReason?: string | null;
}) {
  const styles = ["sticky-note-mint", "sticky-note-peach", "sticky-note-lavender"];
  const icons = ["assignment", "history_edu", "calculate"];
  return (
    <div className={`${styles[index % styles.length]} p-lg rounded-lg bubbly-shadow flex flex-col h-full relative group`}>
      <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          className="p-xs bg-white/50 rounded-full hover:bg-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => onCreateSession(assignment.id)}
          disabled={disabled}
          title={disabledReason || undefined}
          aria-label={`Create study session for ${assignment.name}`}
        >
          <span className="material-symbols-outlined text-[18px]">edit</span>
        </button>
      </div>
      <div className="flex items-start gap-md mb-md">
        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm">
          <span className="material-symbols-outlined text-primary">{icons[index % icons.length]}</span>
        </div>
        <div className="min-w-0">
          <span className="font-label-sm text-label-sm text-primary uppercase">{assignment.courseName}</span>
          <h4 className="font-headline-md text-headline-md text-on-primary-container line-clamp-2">
            {assignment.name}
          </h4>
          <p className="font-label-md text-label-md text-on-surface-variant mt-xs">
            {assignmentTypeLabel(assignment)} - {formatRelative(assignment.dueAt)}
          </p>
        </div>
      </div>
      {assignment.priorityReason ? (
        <p className="font-body-md text-on-primary-container/80 line-clamp-2 mb-md">{assignment.priorityReason}</p>
      ) : null}
      <div className="mt-auto flex items-center justify-between z-10 gap-sm">
        <span className="px-md py-xs bg-white/60 rounded-full font-label-sm text-label-sm border border-primary/20">
          {estimateEffort(assignment)}
        </span>
        <button
          type="button"
          className="font-bold text-primary flex items-center gap-xs disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => onCreateSession(assignment.id)}
          disabled={disabled}
          title={disabledReason || undefined}
        >
          Plan it
          <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
        </button>
      </div>
      <span className="material-symbols-outlined absolute bottom-2 right-2 text-primary opacity-20 text-[60px]">
        bookmark_added
      </span>
    </div>
  );
}

function SubjectCard({ course }: { course: CourseDashboardSummary }) {
  const next = course.nextAssignment;
  return (
    <article className="bg-surface-container-low border-2 border-surface-variant rounded-lg p-md bubbly-shadow min-w-0">
      <div className="flex items-start justify-between gap-sm">
        <div className="min-w-0">
          <p className="font-label-sm text-label-sm text-primary uppercase line-clamp-1">
            {course.courseCode || "Canvas course"}
          </p>
          <h3 className="font-headline-md text-headline-md text-on-surface line-clamp-2">{course.name}</h3>
        </div>
        <span className={`font-label-sm text-label-sm px-sm py-xs rounded-full border ${riskTone(course.riskLevel)}`}>
          {course.riskLevel}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-xs my-md text-center">
        <div className="bg-white/60 rounded-lg p-xs">
          <p className="font-headline-md text-headline-md">{course.unsubmittedAssignments}</p>
          <p className="font-label-sm text-label-sm text-on-surface-variant">Open</p>
        </div>
        <div className="bg-white/60 rounded-lg p-xs">
          <p className="font-headline-md text-headline-md">{course.dueThisWeek + course.dueToday}</p>
          <p className="font-label-sm text-label-sm text-on-surface-variant">Week</p>
        </div>
        <div className="bg-white/60 rounded-lg p-xs">
          <p className="font-headline-md text-headline-md">{course.recentFiles}</p>
          <p className="font-label-sm text-label-sm text-on-surface-variant">Files</p>
        </div>
      </div>
      <p className="font-label-md text-label-md text-on-surface-variant line-clamp-2">
        {next ? `Next: ${next.name} (${formatRelative(next.dueAt)})` : "No open Canvas task found for this course."}
      </p>
    </article>
  );
}

function syncNotice(dashboard: DashboardSummary, isSyncing?: boolean) {
  if (isSyncing) {
    return "Canvas is syncing now. Courses are refreshed one by one so the dashboard can keep responding.";
  }

  const lastSync = dashboard.lastSuccessfulSyncAt || dashboard.lastSyncAt;

  if (!dashboard.canvasConfigured) {
    return "Canvas is not connected yet. Connect Canvas in Settings to import courses, assignments, files, and announcements.";
  }

  if (dashboard.syncStatus === "error") {
    return `The last Canvas sync attempt hit an error${
      dashboard.syncError ? `: ${dashboard.syncError}` : ""
    }. Last successful sync: ${lastSync ? new Date(lastSync).toLocaleString("en-AU") : "never"}.`;
  }

  if (!lastSync) {
    return "Canvas has not completed a successful sync yet. Use Sync now to import your dashboard data.";
  }

  return `Canvas was last synced ${new Date(lastSync).toLocaleString(
    "en-AU",
  )}. That is outside the freshness window, so the dashboard may be out of date until the next refresh finishes.`;
}

export default function DashboardView({ dashboard, dailyBrief, sessions, actions, onCreateSession }: DashboardViewProps) {
  const [search, setSearch] = useState("");
  const greeting = useMemo(
    () => personalGreeting(dashboard.userName, dashboard.timezone),
    [dashboard.timezone, dashboard.userName],
  );
  const missionAssignments = useMemo(() => {
    const query = search.trim().toLowerCase();
    const items = dashboard.priorityItems?.length
      ? dashboard.priorityItems
      : dashboard.unsubmitted.length
        ? dashboard.unsubmitted
      : [...dashboard.dueToday, ...dashboard.dueThisWeek];
    return items
      .filter((item) =>
        query ? `${item.courseName} ${item.name} ${item.description || ""}`.toLowerCase().includes(query) : true,
      )
      .slice(0, 3);
  }, [dashboard.dueThisWeek, dashboard.dueToday, dashboard.priorityItems, dashboard.unsubmitted, search]);
  const nextDeadline = missionAssignments[0];
  const briefJson = dailyBrief?.generatedJson;
  const courseBreakdown = dashboard.courseBreakdown || [];
  const focusStats = useMemo(
    () => buildFocusStats(sessions, dashboard.timezone),
    [dashboard.timezone, sessions],
  );
  const actionsDisabled = Boolean(actions.isBusy);
  const briefingSummary =
    dashboard.priorityItems?.length
      ? dashboard.todayMission[0]
      : briefJson?.summary || dailyBrief?.summary || "Sync Canvas to build your daily brief.";

  return (
    <div className="p-margin-desktop min-h-screen flex flex-col">
      <ViewHeader
        searchPlaceholder="Search assignments or files..."
        searchValue={search}
        onSearchChange={setSearch}
        actions={actions}
      />

      <div className="flex-grow flex flex-col w-full max-w-7xl mx-auto">
        <section className="flex flex-col md:flex-row justify-between items-start md:items-end gap-md mb-xl mt-md">
          <div>
            <h1 className="font-display-lg text-display-lg text-primary">{greeting}</h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant">
              Your Canvas command centre is prioritised by due date, submission status, and risk.
            </p>
          </div>
          <div className="flex flex-wrap gap-sm">
            <button
              type="button"
              className="bg-surface-container text-on-surface-variant border-2 border-surface-variant px-md py-sm rounded-full font-bold hover-squish flex items-center gap-xs disabled:opacity-60"
              onClick={actions.onGenerateBrief}
              disabled={actionsDisabled}
              title={actions.disabledReason || undefined}
            >
              <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
              {actions.isGeneratingBrief ? "Generating..." : "Generate brief"}
            </button>
            <button
              type="button"
              className="bg-surface-container text-on-surface-variant border-2 border-surface-variant px-md py-sm rounded-full font-bold hover-squish flex items-center gap-xs disabled:opacity-60"
              onClick={actions.onSyncCanvas}
              disabled={actionsDisabled}
              title={actions.disabledReason || undefined}
            >
              <span className="material-symbols-outlined text-[18px]">sync</span>
              {actions.isSyncing ? "Syncing..." : "Sync now"}
            </button>
            <button
              type="button"
              className="bg-primary text-on-primary px-lg py-sm rounded-full font-bold hover-squish shadow-md flex items-center gap-sm"
              onClick={actions.onStartSession}
            >
              <span className="material-symbols-outlined">play_arrow</span>
              Start focus session
            </button>
          </div>
        </section>

        {dashboard.stale || actions.isSyncing ? (
          <div className="mb-lg bg-tertiary-container/40 border-2 border-tertiary-fixed-dim rounded-lg p-md flex items-start gap-sm">
            <span className="material-symbols-outlined text-tertiary mt-0.5">
              {actions.isSyncing ? "sync" : "warning"}
            </span>
            <p className="font-body-md text-body-md text-on-tertiary-container">
              {syncNotice(dashboard, actions.isSyncing)}
            </p>
          </div>
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter mb-xl">
          <div className="lg:col-span-8 sticky-note-yellow bubbly-shadow p-lg rounded-lg flex flex-col md:flex-row gap-lg items-center relative overflow-hidden">
            <div className="flex-1 z-10">
              <h3 className="font-headline-md text-headline-md mb-sm flex items-center gap-xs text-on-tertiary-fixed-variant">
                Daily Briefing
                <span className="material-symbols-outlined text-tertiary" style={{ fontVariationSettings: "'FILL' 1" }}>
                  stars
                </span>
              </h3>
              <p className="font-body-md mb-md text-on-tertiary-fixed-variant opacity-80">
                {briefingSummary}
              </p>
              <div className="flex gap-lg">
                <div className="flex flex-col">
                  <span className="font-display-lg text-display-lg text-primary leading-none">{dashboard.dueToday.length}</span>
                  <span className="font-label-md text-label-md uppercase tracking-wider opacity-70">Due Today</span>
                </div>
                <div className="w-[2px] h-12 bg-on-tertiary-fixed-variant/10 rounded-full" />
                <div className="flex flex-col">
                  <span className="font-display-lg text-display-lg text-secondary leading-none">
                    {dashboard.dueThisWeek.length}
                  </span>
                  <span className="font-label-md text-label-md uppercase tracking-wider opacity-70">This Week</span>
                </div>
              </div>
            </div>
            <div className="md:w-1/3 z-10 relative">
              <div className="bg-white/40 backdrop-blur-sm p-md rounded-lg border border-white/60">
                <p className="font-label-sm text-label-sm text-primary-fixed-dim uppercase mb-xs">Next Deadline</p>
                <p className="font-bold text-body-md text-primary mb-xs line-clamp-2">
                  {nextDeadline?.name || "No urgent task"}
                </p>
                <div className="w-full bg-white/50 h-2 rounded-full overflow-hidden">
                  <div className="bg-primary w-3/4 h-full rounded-full" />
                </div>
                <p className="font-label-sm text-label-sm text-right mt-xs">{formatRelative(nextDeadline?.dueAt)}</p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 flex flex-col gap-sm">
            <button
              type="button"
              className="flex-1 bg-surface-container-low border-2 border-surface-variant p-md rounded-lg bubbly-shadow flex items-center justify-between hover-squish text-left"
              onClick={() => actions.onNavigate("risk")}
              aria-label={`Open risk level details. Current risk is ${dashboard.riskLevel}.`}
            >
              <div>
                <p className="font-label-sm text-label-sm text-on-surface-variant uppercase">Risk Level</p>
                <p className="font-headline-md text-headline-md font-bold capitalize">{dashboard.riskLevel}</p>
              </div>
              <span className="material-symbols-outlined text-primary text-[40px]">check_circle</span>
            </button>
            <button
              type="button"
              className="flex-1 bg-surface-container-low border-2 border-surface-variant p-md rounded-lg bubbly-shadow flex items-center justify-between hover-squish text-left"
              onClick={() => actions.onNavigate("assignments")}
              aria-label={`Open unsubmitted assignments. ${dashboard.unsubmitted.length} tasks need attention.`}
            >
              <div>
                <p className="font-label-sm text-label-sm text-on-surface-variant uppercase">Unsubmitted</p>
                <p className="font-headline-md text-headline-md font-bold">{dashboard.unsubmitted.length} Tasks</p>
              </div>
              <span className="material-symbols-outlined text-error text-[40px]">pending_actions</span>
            </button>
            <button
              type="button"
              className="flex-1 bg-surface-container-low border-2 border-surface-variant p-md rounded-lg bubbly-shadow flex items-center justify-between hover-squish text-left"
              onClick={() => actions.onNavigate("streak")}
              aria-label={`Open focus streak details. Current streak is ${focusStats.protectedStreak} days.`}
            >
              <div>
                <p className="font-label-sm text-label-sm text-on-surface-variant uppercase">Focus Streak</p>
                <p className="font-headline-md text-headline-md font-bold">
                  {focusStats.protectedStreak} {focusStats.protectedStreak === 1 ? "Day" : "Days"}
                </p>
                {focusStats.streakAtRisk ? (
                  <p className="font-label-sm text-label-sm text-tertiary">Protect it today</p>
                ) : null}
              </div>
              <span className="material-symbols-outlined text-secondary text-[40px]">local_fire_department</span>
            </button>
          </div>
        </div>

        {courseBreakdown.length ? (
          <section className="mb-xl">
            <div className="flex items-center justify-between mb-md">
              <h2 className="font-headline-lg text-headline-lg text-primary flex items-center gap-sm">
                Subject Radar
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                  school
                </span>
              </h2>
              <span className="font-label-md text-label-md text-on-surface-variant">
                {courseBreakdown.length} synced subjects
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-gutter">
              {courseBreakdown.map((course) => (
                <SubjectCard key={course.courseId} course={course} />
              ))}
            </div>
          </section>
        ) : null}

        <section className="mb-xl">
          <div className="flex items-center justify-between mb-lg">
            <h2 className="font-headline-lg text-headline-lg text-primary flex items-center gap-sm">
              Today&apos;s Mission
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                flag
              </span>
            </h2>
            <button
              type="button"
              className="text-primary font-bold flex items-center gap-xs hover:underline transition-all"
              onClick={() => actions.onNavigate("assignments")}
            >
              View Planner
              <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
            </button>
          </div>
          {missionAssignments.length ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
              {missionAssignments.map((assignment, index) => (
                <MissionCard
                  key={assignment.id}
                  assignment={assignment}
                  index={index}
                  onCreateSession={onCreateSession}
                  disabled={actionsDisabled}
                  disabledReason={actions.disabledReason}
                />
              ))}
            </div>
          ) : (
            <div className="bg-surface-container-low border-2 border-dashed border-outline-variant rounded-lg p-xl text-center">
              <span className="material-symbols-outlined text-primary text-[48px]">cloud_sync</span>
              <h3 className="font-headline-md text-headline-md text-primary mt-sm">No Canvas assignments loaded yet</h3>
              <p className="font-body-md text-on-surface-variant mt-xs">Connect Canvas in Settings, then run Sync now.</p>
            </div>
          )}
        </section>

        <section className="mt-auto py-lg text-center flex flex-col items-center">
          <div className="max-w-2xl px-lg py-md bg-white/30 backdrop-blur-sm rounded-xl border border-surface-variant relative">
            <span className="material-symbols-outlined text-primary-fixed-dim absolute -top-4 -left-4 text-3xl animate-pulse">
              auto_awesome
            </span>
            <p className="font-headline-md italic text-on-surface-variant leading-relaxed">
              {`"${briefJson?.motivationalLine || "Win the day by shrinking the problem."}"`}
            </p>
            <div className="mt-sm flex items-center justify-center gap-xs">
              <p className="font-label-md text-tertiary uppercase tracking-widest">
                {nextDeadline ? `${nextDeadline.courseName}: ${statusLabel(nextDeadline)}` : "Canvas ready"}
              </p>
              <span className={`font-label-sm text-label-sm px-sm py-1 rounded-full border ${riskTone(dashboard.riskLevel)}`}>
                {dashboard.riskLevel}
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
