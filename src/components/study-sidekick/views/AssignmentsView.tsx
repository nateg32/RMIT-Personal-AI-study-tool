"use client";

import { useMemo, useState } from "react";
import ViewHeader from "../components/ViewHeader";
import type { AssignmentSummary, CourseSummary, StudySidekickActions } from "../types";
import { assignmentTypeLabel, compactText, estimateEffort, formatDate, formatRelative, isSubmitted, riskForAssignment, riskTone, statusLabel } from "../lib/client-utils";
import { openExternalUrl } from "../lib/safe-url";

type AssignmentsViewProps = {
  assignments: AssignmentSummary[];
  courses: CourseSummary[];
  actions: StudySidekickActions;
  onCreateSession: (assignmentId: string) => void;
  onSelectAssignment: (assignmentId: string) => void;
  onUpdateAssignmentStatus: (assignmentId: string, status: "open" | "submitted_elsewhere") => Promise<void>;
  onHideAssignment: (assignmentId: string) => void;
  isCreatingSession: boolean;
  hiddenAssignmentIds?: string[];
};

type FilterMode = "due" | "submitted" | "unsubmitted" | "all";

export default function AssignmentsView({
  assignments,
  courses,
  actions,
  onCreateSession,
  onUpdateAssignmentStatus,
  isCreatingSession,
  hiddenAssignmentIds = [],
}: AssignmentsViewProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterMode>("due");
  const [courseId, setCourseId] = useState("all");

  const courseNameById = useMemo(() => new Map(courses.map((course) => [course.id, course.name])), [courses]);
  const hiddenAssignmentSet = useMemo(() => new Set(hiddenAssignmentIds), [hiddenAssignmentIds]);
  const actionsDisabled = Boolean(actions.isBusy);
  const filteredAssignments = useMemo(() => {
    const query = search.trim().toLowerCase();
    return assignments
      .filter((assignment) => {
        if (filter === "submitted" && !isSubmitted(assignment)) return false;
        if (filter === "unsubmitted" && isSubmitted(assignment)) return false;
        if (filter === "due" && isSubmitted(assignment)) return false;
        if (courseId !== "all" && assignment.courseName !== courseNameById.get(courseId)) return false;
        if (!query) return true;
        return `${assignment.name} ${assignment.courseName} ${assignment.description || ""} ${assignment.rubricSummary || ""}`
          .toLowerCase()
          .includes(query);
      })
      .sort((a, b) => {
        const priorityDelta = (b.priorityScore || 0) - (a.priorityScore || 0);
        if (priorityDelta !== 0) return priorityDelta;
        const aDue = a.dueAt ? new Date(a.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
        const bDue = b.dueAt ? new Date(b.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
        return aDue - bDue;
      });
  }, [assignments, courseId, courseNameById, filter, search]);

  const completed = assignments.filter(isSubmitted).length;
  const completion = assignments.length ? Math.round((completed / assignments.length) * 100) : 0;

  return (
    <div className="pb-lg px-margin-desktop min-h-screen">
      <ViewHeader
        searchPlaceholder="Search tasks..."
        searchValue={search}
        onSearchChange={setSearch}
        actions={actions}
      />

      <div className="max-w-7xl mx-auto mb-md flex w-full flex-col gap-md md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-display-lg text-display-lg text-primary">Assignments & Tasks</h1>
          <p className="font-body-lg text-on-surface-variant mt-sm">
            Live Canvas assignments with submission status, due dates, rubric hints, and study-session actions.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center justify-center gap-xs self-start rounded-full border-2 border-surface-variant bg-surface-container px-lg py-sm font-label-md text-label-md text-on-surface transition-all duration-200 hover:border-primary-fixed hover:bg-primary-container disabled:cursor-not-allowed disabled:opacity-60 md:self-auto"
          onClick={actions.onSyncAssignments}
          disabled={actionsDisabled}
          title={actions.disabledReason || "Refresh assignments and submission status only"}
        >
          <span className={`material-symbols-outlined text-[18px] ${actions.isSyncingAssignments ? "animate-spin" : ""}`}>
            sync
          </span>
          {actions.isSyncingAssignments ? "Refreshing..." : "Refresh assignments"}
        </button>
      </div>

      <section className="flex flex-wrap items-center gap-sm mb-xl max-w-7xl mx-auto w-full">
        <span className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mr-xs">Filter:</span>
        {[
          ["due", "Due Soon"],
          ["submitted", "Submitted"],
          ["unsubmitted", "Unsubmitted"],
          ["all", "All"],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`px-md py-sm rounded-full font-label-md text-label-md shadow-sm bubbly-button border-2 ${
              filter === id
                ? "bg-primary text-on-primary border-primary"
                : "bg-surface-container border-surface-variant text-on-surface-variant hover:bg-primary-container hover:border-primary-fixed"
            }`}
            onClick={() => setFilter(id as FilterMode)}
          >
            {label}
          </button>
        ))}
        <select
          value={courseId}
          onChange={(event) => setCourseId(event.target.value)}
          className="px-md py-sm rounded-full bg-surface-container border-2 border-surface-variant text-on-surface-variant font-label-md text-label-md focus:outline-none focus:border-primary"
        >
          <option value="all">All courses</option>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.courseCode ? `${course.courseCode} - ${course.name}` : course.name}
            </option>
          ))}
        </select>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-gutter max-w-7xl mx-auto w-full">
        {filteredAssignments.map((assignment, index) => {
          const risk = riskForAssignment(assignment);
          const isHidden = hiddenAssignmentSet.has(assignment.id);
          const mutationDisabled = isCreatingSession || actionsDisabled;
          const palette =
            index % 3 === 0
              ? "bg-tertiary-container border-tertiary-fixed-dim text-on-tertiary-container"
              : index % 3 === 1
                ? "bg-secondary-container border-secondary-fixed-dim text-on-secondary-container"
                : "bg-primary-container border-primary-fixed-dim text-on-primary-container";

          return (
            <article
              key={assignment.id}
              className={`straight-panel p-lg rounded-lg border-2 flex min-h-[340px] flex-col justify-between overflow-visible ${palette}`}
            >
              <div>
                <div className="mb-md flex flex-wrap items-center gap-xs">
                  <span className="rounded-full bg-white/65 px-sm py-xs font-label-sm text-label-sm line-clamp-1">
                    {assignment.courseCode || assignment.courseName}
                  </span>
                  <span className="rounded-full bg-white/50 px-sm py-xs font-label-sm text-label-sm line-clamp-1">
                    {assignmentTypeLabel(assignment)}
                  </span>
                  <span
                    className={`ml-auto rounded-full border bg-white/75 px-sm py-xs font-label-sm text-label-sm ${riskTone(risk)}`}
                  >
                    {risk}
                  </span>
                </div>
                <h3 className="font-headline-md text-headline-md mb-xs line-clamp-2">{assignment.name}</h3>
                <p className="font-body-md opacity-80 mb-md line-clamp-2">
                  {compactText(assignment.description || assignment.rubricSummary, "Canvas details will appear after sync.")}
                </p>
                {assignment.priorityReason ? (
                  <p className="font-label-md text-label-md opacity-80 line-clamp-2">
                    Priority: {assignment.priorityReason}
                  </p>
                ) : null}
              </div>

              <div className="space-y-md">
                <div className="flex justify-between items-center gap-sm">
                  <div className="flex items-center gap-xs">
                    <span className="material-symbols-outlined text-sm">calendar_today</span>
                    <span className="font-label-md text-label-md">{formatDate(assignment.dueAt)}</span>
                  </div>
                  <div className="flex items-center gap-xs">
                    <span className="material-symbols-outlined text-sm">
                      {isSubmitted(assignment) ? "check_circle" : "pending"}
                    </span>
                    <span className="font-label-md text-label-md">{statusLabel(assignment)}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between font-label-sm text-label-sm opacity-80">
                  <span>{formatRelative(assignment.dueAt)}</span>
                  <span>{assignment.pointsPossible ? `${assignment.pointsPossible} pts` : "No points listed"}</span>
                  <span>{estimateEffort(assignment)}</span>
                </div>
                <div className="flex flex-wrap gap-sm pt-xs">
                  <button
                    type="button"
                    className="flex min-w-[9rem] flex-1 items-center justify-center gap-xs rounded-full bg-white/85 px-md py-sm font-label-md text-label-md text-on-surface bubbly-button disabled:opacity-60"
                    onClick={() => onCreateSession(assignment.id)}
                    disabled={mutationDisabled || isHidden}
                    title={actions.disabledReason || (isHidden ? "Already removed from dashboard scope" : undefined)}
                  >
                    <span className="material-symbols-outlined text-[18px]">timer</span>
                    Plan session
                  </button>
                  <button
                    type="button"
                    className="flex items-center justify-center gap-xs rounded-full bg-white/50 px-md py-sm font-label-md text-label-md transition-all hover:bg-white/70 disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() =>
                      onUpdateAssignmentStatus(
                        assignment.id,
                        isSubmitted(assignment) ? "open" : "submitted_elsewhere",
                      )
                    }
                    disabled={actionsDisabled || isHidden}
                    aria-label={isSubmitted(assignment) ? "Reopen assignment locally" : "Mark done elsewhere"}
                    title={actions.disabledReason || (isHidden ? "Already removed from dashboard scope" : undefined)}
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {isSubmitted(assignment) ? "undo" : "task_alt"}
                    </span>
                    <span>{isSubmitted(assignment) ? "Reopen" : "Done"}</span>
                  </button>
                  <button
                    type="button"
                    className="flex items-center justify-center gap-xs rounded-full bg-white/50 px-md py-sm font-label-md text-label-md transition-all hover:bg-white/70 disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => openExternalUrl(assignment.htmlUrl)}
                    aria-label="Open in Canvas"
                  >
                    <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                    <span>Open</span>
                  </button>
                </div>
              </div>
            </article>
          );
        })}

        {!filteredAssignments.length ? (
          <div className="col-span-full p-xl rounded-lg bg-white border-2 border-dashed border-surface-variant flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center mx-auto mb-md">
                <span className="material-symbols-outlined text-primary text-display-lg">sync</span>
              </div>
              <p className="font-headline-md text-headline-md text-on-surface-variant">No assignments match this view</p>
              <p className="font-label-md text-label-md text-outline">Try another filter or sync Canvas.</p>
            </div>
          </div>
        ) : null}

        <div className="xl:col-span-2 bg-surface-container p-md rounded-lg border-2 border-surface-variant flex flex-col md:flex-row items-center gap-lg">
          <div className="flex-1 w-full">
            <h3 className="font-headline-md text-headline-md text-primary mb-xs">Your Canvas progress</h3>
            <p className="font-body-md text-on-surface-variant mb-md">
              {completed} submitted out of {assignments.length} synced assignments.
            </p>
            <div className="w-full bg-white rounded-full h-4 relative overflow-hidden border-2 border-primary-fixed">
              <div className="h-full bg-primary progress-candy" style={{ width: `${completion}%` }} />
            </div>
            <div className="flex justify-between mt-sm">
              <span className="font-label-sm text-label-sm text-on-surface-variant">{filteredAssignments.length} shown</span>
              <span className="font-label-sm text-label-sm text-primary font-bold">{completion}% submitted</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
