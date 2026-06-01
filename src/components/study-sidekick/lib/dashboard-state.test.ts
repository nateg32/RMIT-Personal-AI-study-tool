import { describe, expect, it } from "vitest";
import {
  markAssignmentSubmittedElsewhere,
  removeDashboardAssignments,
  scrubDailyBriefAssignments,
} from "./dashboard-state";
import type { AssignmentSummary, DailyBrief, DashboardSummary } from "../types";

const cloud: AssignmentSummary = {
  id: "aws-22",
  courseId: "cloud",
  canvasAssignmentId: 22,
  courseName: "Cloud Foundations (2610)",
  courseCode: "COSC2757",
  name: "Milestone 2.2 AWS Academy Labs and Activities",
  priorityReason: "Overdue and unsubmitted",
  dueStatus: "overdue",
  workflowState: "unsubmitted",
};

const cyber: AssignmentSummary = {
  id: "cyber-2",
  courseId: "cyber",
  canvasAssignmentId: 2,
  courseName: "Introduction to Cyber Security (2602)",
  courseCode: "INTE2625",
  name: "Assignment 2: Industry-focused assessment",
  priorityReason: "Due in 3 days",
  dueStatus: "due_this_week",
  workflowState: "unsubmitted",
};

const dashboard: DashboardSummary = {
  userName: "Nathaniel",
  timezone: "Australia/Sydney",
  stale: false,
  todayMission: [
    "Cloud Foundations (2610): Milestone 2.2 AWS Academy Labs and Activities - Overdue and unsubmitted",
    "Introduction to Cyber Security (2602): Assignment 2: Industry-focused assessment - Due in 3 days",
  ],
  dueToday: [],
  dueThisWeek: [cyber],
  unsubmitted: [cloud, cyber],
  announcements: [],
  files: [],
  riskLevel: "critical",
  priorityItems: [cloud, cyber],
  syncSummary: {
    visibleCourses: 2,
    hiddenCourses: 0,
    assignments: 2,
    unsubmittedAssignments: 2,
    announcements: 0,
    files: 0,
    resources: 0,
    manualMaterials: 0,
  },
  courseBreakdown: [
    {
      courseId: "cloud",
      name: "Cloud Foundations (2610)",
      active: true,
      totalAssignments: 1,
      submittedAssignments: 0,
      unsubmittedAssignments: 1,
      overdueAssignments: 1,
      dueToday: 0,
      dueThisWeek: 0,
      recentAnnouncements: 0,
      recentFiles: 0,
      riskLevel: "critical",
      nextAssignment: cloud,
    },
  ],
};

describe("dashboard state cleanup", () => {
  it("removes hidden assignments from every dashboard collection and rebuilds today's mission", () => {
    const next = removeDashboardAssignments(dashboard, (assignment) => assignment.id === cloud.id, {
      reduceAssignmentCount: true,
    });

    expect(next.priorityItems?.map((assignment) => assignment.id)).toEqual(["cyber-2"]);
    expect(next.unsubmitted.map((assignment) => assignment.id)).toEqual(["cyber-2"]);
    expect(next.todayMission).toEqual([
      "Introduction to Cyber Security (2602): Assignment 2: Industry-focused assessment - Due in 3 days",
    ]);
    expect(next.syncSummary?.assignments).toBe(1);
    expect(next.syncSummary?.unsubmittedAssignments).toBe(1);
    expect(next.courseBreakdown?.[0].unsubmittedAssignments).toBe(0);
    expect(next.courseBreakdown?.[0].nextAssignment).toBeNull();
  });

  it("marks done-elsewhere assignments as submitted and removes them from mission without reducing assignment count", () => {
    const submitted = markAssignmentSubmittedElsewhere(cloud, "2026-06-01T02:00:00.000Z");
    const next = removeDashboardAssignments(dashboard, (assignment) => assignment.id === cloud.id);

    expect(submitted.workflowState).toBe("submitted_elsewhere");
    expect(submitted.dueStatus).toBe("submitted");
    expect(next.syncSummary?.assignments).toBe(2);
    expect(next.syncSummary?.unsubmittedAssignments).toBe(1);
    expect(next.todayMission[0]).toContain("Assignment 2");
  });

  it("scrubs stale brief lines that mention hidden or completed assignments", () => {
    const brief: DailyBrief = {
      summary: "Start with Milestone 2.2 AWS Academy Labs and Activities.",
      riskLevel: "critical",
      generatedJson: {
        summary: "Milestone 2.2 AWS Academy Labs and Activities is urgent.",
        focusItems: ["Milestone 2.2 AWS Academy Labs and Activities", "Assignment 2: Industry-focused assessment"],
        dueToday: ["Cloud Foundations: Milestone 2.2 AWS Academy Labs and Activities"],
        dueThisWeek: ["Introduction to Cyber Security: Assignment 2: Industry-focused assessment"],
        suggestedOrder: ["Milestone 2.2 AWS Academy Labs and Activities first"],
      },
    };

    const next = scrubDailyBriefAssignments(brief, [cloud]);

    expect(next?.summary).toContain("Dashboard updated");
    expect(next?.generatedJson?.focusItems).toEqual(["Assignment 2: Industry-focused assessment"]);
    expect(next?.generatedJson?.dueToday).toEqual([]);
    expect(next?.generatedJson?.dueThisWeek).toEqual(["Introduction to Cyber Security: Assignment 2: Industry-focused assessment"]);
  });
});
