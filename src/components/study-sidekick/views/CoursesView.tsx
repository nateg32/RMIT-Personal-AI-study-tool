"use client";

import { useMemo, useState } from "react";
import ViewHeader from "../components/ViewHeader";
import type { AssignmentSummary, CourseSummary, FileSummary, StudySidekickActions } from "../types";
import { formatRelative, isSubmitted, riskForAssignment } from "../lib/client-utils";

type CoursesViewProps = {
  courses: CourseSummary[];
  assignments: AssignmentSummary[];
  files: FileSummary[];
  actions: StudySidekickActions;
  onCourseFiles: () => void;
  onCourseTasks: () => void;
  onHideCourse: (courseId: string) => void;
};

export default function CoursesView({
  courses,
  assignments,
  files,
  actions,
  onCourseFiles,
  onCourseTasks,
  onHideCourse,
}: CoursesViewProps) {
  const [search, setSearch] = useState("");
  const visibleCourses = useMemo(() => {
    const query = search.trim().toLowerCase();
    return courses.filter((course) =>
      query ? `${course.name} ${course.courseCode || ""} ${course.term || ""}`.toLowerCase().includes(query) : true,
    );
  }, [courses, search]);

  return (
    <div className="px-margin-desktop pb-xl">
      <ViewHeader
        searchPlaceholder="Search your courses..."
        searchValue={search}
        onSearchChange={setSearch}
        actions={actions}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto] items-end mb-lg gap-md mt-lg max-w-7xl mx-auto w-full">
        <div className="flex-1 min-w-0">
          <div className="mb-xs">
            <span className="font-label-md text-label-md text-primary uppercase tracking-widest font-bold">
              Current Enrolment
            </span>
          </div>
          <h2 className="font-display-lg text-display-lg text-on-surface">Your Curated Library</h2>
          <p className="font-body-lg text-body-lg text-on-surface-variant max-w-3xl whitespace-normal">
            Canvas courses grouped with assignments, files, announcements, and module resources.
          </p>
        </div>
        <div className="flex flex-wrap gap-sm lg:justify-end">
          <button
            type="button"
            className="flex items-center gap-sm bg-surface-container border-2 border-outline-variant px-lg py-md rounded-full font-label-md text-label-md hover:bg-surface-variant transition-all active:scale-95"
            onClick={actions.onSyncCanvas}
          >
            <span className="material-symbols-outlined">sync</span> Sync Canvas
          </button>
          <button
            type="button"
            className="flex items-center gap-sm bg-primary text-on-primary px-lg py-md rounded-full font-label-md text-label-md hover:shadow-lg transition-all active:scale-95"
            onClick={() => actions.onNavigate("settings")}
          >
            <span className="material-symbols-outlined">settings</span> Connection
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-gutter max-w-7xl mx-auto w-full">
        {visibleCourses.map((course, index) => {
          const courseAssignments = assignments.filter((assignment) => assignment.courseName === course.name);
          const courseFiles = files.filter((file) => file.courseName === course.name);
          const unsubmitted = courseAssignments.filter((assignment) => !isSubmitted(assignment));
          const next = unsubmitted
            .filter((assignment) => assignment.dueAt)
            .sort((a, b) => new Date(a.dueAt || 0).getTime() - new Date(b.dueAt || 0).getTime())[0];
          const completion = courseAssignments.length
            ? Math.round(((courseAssignments.length - unsubmitted.length) / courseAssignments.length) * 100)
            : 0;
          const risk = next ? riskForAssignment(next) : "low";
          const palette =
            index % 3 === 0
              ? "bg-primary-container/20 border-primary-container text-primary"
              : index % 3 === 1
                ? "bg-tertiary-container/30 border-tertiary-container text-tertiary"
                : "bg-secondary-container/20 border-secondary-container text-secondary";
          const icon = index % 3 === 0 ? "school" : index % 3 === 1 ? "history_edu" : "calculate";

          return (
            <article
              key={course.id}
              className={`${palette} border-2 p-md rounded-lg bubbly-shadow relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300`}
            >
              <div className="absolute -right-base -top-base opacity-10 group-hover:rotate-12 transition-transform">
                <span className="material-symbols-outlined text-[120px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  {icon}
                </span>
              </div>
              <div className="relative z-10">
                <div className="flex justify-between items-start mb-lg gap-sm">
                  <div className="w-12 h-12 bg-white/70 rounded-full flex items-center justify-center">
                    <span className="material-symbols-outlined">{icon}</span>
                  </div>
                  <span className="bg-white/70 px-sm py-xs rounded-full font-label-sm text-label-sm capitalize">
                    {risk}
                  </span>
                </div>
                <h3 className="font-headline-md text-headline-md text-on-background mb-base line-clamp-2">
                  {course.name}
                </h3>
                <div className="flex items-center gap-sm text-on-surface-variant mb-md">
                  <span className="material-symbols-outlined text-md">event</span>
                  <span className="font-label-md text-label-md">
                    {next ? `${next.name} - ${formatRelative(next.dueAt)}` : course.term || "No upcoming due date"}
                  </span>
                </div>
                <div className="mb-lg">
                  <div className="flex justify-between items-center mb-xs">
                    <span className="font-label-sm text-label-sm text-on-surface-variant">Submitted progress</span>
                    <span className="font-label-sm text-label-sm font-bold">{completion}%</span>
                  </div>
                  <div className="h-4 bg-surface-container-highest rounded-full overflow-hidden">
                    <div className="h-full bg-current progress-candy" style={{ width: `${completion}%` }} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-sm mb-lg">
                  <div className="bg-surface-container-low p-sm rounded-md flex flex-col items-center border border-outline-variant">
                    <span className="font-headline-md text-headline-md">{courseAssignments.length}</span>
                    <span className="font-label-sm text-label-sm text-on-surface-variant">Assignments</span>
                  </div>
                  <div className="bg-surface-container-low p-sm rounded-md flex flex-col items-center border border-outline-variant">
                    <span className="font-headline-md text-headline-md">{courseFiles.length}</span>
                    <span className="font-label-sm text-label-sm text-on-surface-variant">Files</span>
                  </div>
                </div>
                <div className="flex gap-sm">
                  <button
                    type="button"
                    className="flex-grow flex items-center justify-center gap-xs bg-white/80 border-2 border-current/20 py-sm rounded-full font-label-md text-label-md hover:bg-white transition-all"
                    onClick={onCourseFiles}
                  >
                    <span className="material-symbols-outlined text-sm">folder</span> Files
                  </button>
                  <button
                    type="button"
                    className="flex-grow flex items-center justify-center gap-xs bg-white/80 border-2 border-current/20 py-sm rounded-full font-label-md text-label-md hover:bg-white transition-all"
                    onClick={onCourseTasks}
                  >
                    <span className="material-symbols-outlined text-sm">assignment</span> Tasks
                  </button>
                  <button
                    type="button"
                    className="w-11 flex items-center justify-center bg-white/70 border-2 border-current/20 py-sm rounded-full font-label-md text-label-md hover:bg-white transition-all"
                    onClick={() => onHideCourse(course.id)}
                    aria-label="Remove course from dashboard"
                    title="Remove from dashboard and future syncs"
                  >
                    <span className="material-symbols-outlined text-sm">delete</span>
                  </button>
                </div>
              </div>
            </article>
          );
        })}

        {!visibleCourses.length ? (
          <div className="border-4 border-dashed border-outline-variant p-md rounded-lg flex flex-col items-center justify-center min-h-[320px] text-center group hover:border-primary/50 transition-all">
            <div className="w-16 h-16 bg-surface-container rounded-full flex items-center justify-center mb-md">
              <span className="material-symbols-outlined text-[40px] text-on-surface-variant">cloud_sync</span>
            </div>
            <h3 className="font-headline-md text-headline-md text-on-surface-variant">No courses shown</h3>
            <p className="font-body-md text-on-surface-variant mt-sm px-lg">
              Sync Canvas or reset your dashboard scope in Settings.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
