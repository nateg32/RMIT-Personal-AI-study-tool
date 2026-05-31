import { describe, expect, it } from "vitest";
import { __studyAgentTest } from "@/lib/ai/study-agent";
import type { CanvasAssignmentSummary } from "@/lib/types";

const courses = [
  {
    id: "algos",
    canvasCourseId: 123,
    name: "Algorithms and Analysis (2610)",
    courseCode: "COSC2123",
  },
  {
    id: "cloud",
    canvasCourseId: 456,
    name: "Cloud Foundations (2610)",
    courseCode: "COSC2757",
  },
];

const assignments: CanvasAssignmentSummary[] = [
  {
    id: "graph",
    courseId: "algos",
    canvasAssignmentId: 1,
    courseName: "Algorithms and Analysis (2610)",
    courseCode: "COSC2123",
    name: "Graph Algorithms in Action: Modeling a Disease Outbreak",
    assignmentType: "assignment",
  },
  {
    id: "quiz-week-6",
    courseId: "algos",
    canvasAssignmentId: 2,
    courseName: "Algorithms and Analysis (2610)",
    courseCode: "COSC2123",
    name: "Week 6 Quiz",
    assignmentType: "quiz",
  },
  {
    id: "cloud-assignment",
    courseId: "cloud",
    canvasAssignmentId: 3,
    courseName: "Cloud Foundations (2610)",
    courseCode: "COSC2757",
    name: "Assignment 3",
    assignmentType: "assignment",
  },
];

describe("study agent matching", () => {
  it("treats completed remove requests as dashboard hide requests", () => {
    expect(__studyAgentTest.wantsHide("can u remove the algorithims assignment, ive already finished")).toBe(true);
  });

  it("matches common algorithm misspellings to the Algorithms course", () => {
    const match = __studyAgentTest.bestCourseMatch("hide algorithim assignments from dashboard", courses);
    expect(match?.id).toBe("algos");
  });

  it("understands plural assignment-group dashboard requests", () => {
    expect(__studyAgentTest.wantsAssignmentGroup("hide algorithim assignments from dashboard")).toBe(true);
  });

  it("falls back to the single real assignment in a course instead of a quiz", () => {
    const match = __studyAgentTest.bestSingleAssignmentInCourse(
      courses[0],
      assignments,
      "remove the algorithims assignment because it is done",
    );
    expect(match?.id).toBe("graph");
  });

  it("still handles specific assignment names", () => {
    const match = __studyAgentTest.bestAssignmentMatch("hide week 6 quiz from dashboard", assignments);
    expect(match?.id).toBe("quiz-week-6");
  });
});
