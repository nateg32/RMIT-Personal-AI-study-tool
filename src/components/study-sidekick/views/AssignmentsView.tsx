"use client";

import { useMemo, useState } from "react";
import ViewHeader from "../components/ViewHeader";
import type { AssignmentSummary, CourseSummary, StudySidekickActions } from "../types";
import { assignmentTypeLabel, compactText, estimateEffort, formatDate, formatRelative, isSubmitted, riskForAssignment, riskTone, statusLabel } from "../lib/client-utils";

type AssignmentsViewProps = {
  assignments: AssignmentSummary[];
  courses: CourseSummary[];
  actions: StudySidekickActions;
  onCreateSession: (assignmentId: string) => void;
  onSelectAssignment: (assignmentId: string) => void;
  isCreatingSession: boolean;
};

type FilterMode = "due" | "submitted" | "unsubmitted" | "all";

function openCanvas(url?: string | null) {
  if (url) window.open(url, "_blank", "noopener,noreferrer");
}

export default function AssignmentsView({
  assignments,
  courses,
  actions,
  onCreateSession,
  onSelectAssignment,
  isCreatingSession,
}: AssignmentsViewProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterMode>("due");
  const [courseId, setCourseId] = useState("all");

  const courseNameById = useMemo(() => new Map(courses.map((course) => [course.id, course.name])), [courses]);
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

      <div className="max-w-7xl mx-auto w-full mb-md">
        <h1 className="font-display-lg text-display-lg text-primary">Assignments & Tasks</h1>
        <p className="font-body-lg text-on-surface-variant mt-sm">
          Live Canvas assignments with submission status, due dates, rubric hints, and study-session actions.
        </p>
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
        <div className="ml-auto hidden sm:block">
          <button
            type="button"
            className="bg-primary-container text-on-primary-container px-lg py-sm rounded-full font-label-md text-label-md flex items-center gap-sm bubbly-button border-2 border-primary-fixed-dim disabled:opacity-60"
            onClick={() => filteredAssignments[0] && onCreateSession(filteredAssignments[0].id)}
            disabled={!filteredAssignments.length || isCreatingSession}
          >
            <span className="material-symbols-outlined">add</span>
            Create Study Session
          </button>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-gutter max-w-7xl mx-auto w-full">
        {filteredAssignments.map((assignment, index) => {
          const risk = riskForAssignment(assignment);
          const palette =
            index % 3 === 0
              ? "bg-tertiary-container border-tertiary-fixed-dim text-on-tertiary-container"
              : index % 3 === 1
                ? "bg-secondary-container border-secondary-fixed-dim text-on-secondary-container"
                : "bg-primary-container border-primary-fixed-dim text-on-primary-container";

          return (
            <article
              key={assignment.id}
              className={`sticky-note p-md rounded-lg bubbly-shadow border-2 flex flex-col justify-between min-h-[300px] folded-corner ${palette}`}
            >
              <div>
                <div className="flex justify-between items-start mb-sm gap-sm">
                  <span className="px-sm py-xs bg-white/60 rounded-full font-label-sm text-label-sm line-clamp-1">
                    {assignment.courseCode || assignment.courseName}
                  </span>
                  <span className="px-sm py-xs bg-white/50 rounded-full font-label-sm text-label-sm line-clamp-1">
                    {assignmentTypeLabel(assignment)}
                  </span>
                  <span
                    className={`font-label-sm text-label-sm px-sm py-xs rounded-full border bg-white/70 ${riskTone(risk)}`}
                  >
                    {risk}
                  </span>
                </div>
                <h3 className="font-headline-md text-headline-md mb-xs line-clamp-2">{assignment.name}</h3>
                <p className="font-body-md opacity-80 mb-md line-clamp-3">
                  {compactText(assignment.description || assignment.rubricSummary, "Canvas details will appear after sync.")}
                </p>
                {assignment.rubricSummary ? (
                  <div className="bg-white/50 rounded-lg p-sm border border-white/70 mb-md">
                    <p className="font-label-sm text-label-sm uppercase opacity-70">Rubric signal</p>
                    <p className="font-body-md line-clamp-2">{assignment.rubricSummary}</p>
                  </div>
                ) : null}
                {assignment.priorityReason ? (
                  <p className="font-label-md text-label-md opacity-80 mb-md">
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
                <div className="flex gap-sm">
                  <button
                    type="button"
                    className="flex-1 bg-white/80 text-on-surface py-xs rounded-lg font-label-md text-label-md bubbly-button"
                    onClick={() => onCreateSession(assignment.id)}
                    disabled={isCreatingSession}
                  >
                    Create Study Session
                  </button>
                  <button
                    type="button"
                    className="px-sm bg-white/40 rounded-lg hover:bg-white/60 transition-all"
                    onClick={() => onSelectAssignment(assignment.id)}
                    aria-label="Open study planner"
                  >
                    <span className="material-symbols-outlined">timer</span>
                  </button>
                  <button
                    type="button"
                    className="px-sm bg-white/40 rounded-lg hover:bg-white/60 transition-all"
                    onClick={() => openCanvas(assignment.htmlUrl)}
                    aria-label="Open in Canvas"
                  >
                    <span className="material-symbols-outlined">open_in_new</span>
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
