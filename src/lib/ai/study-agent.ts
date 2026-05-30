import type { User } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { auditLog } from "@/lib/audit";
import { isDemoUser } from "@/lib/auth";
import {
  getAssignmentContextForUser,
  getCustomFocusContextForUser,
  getStudySessionGeminiMaterialsForUser,
} from "@/lib/data/assignment-context";
import {
  canvasAssignmentKey,
  getDashboardPreferences,
  resetDashboardPreferences,
  saveDashboardPreferences,
} from "@/lib/data/preferences";
import { getDb } from "@/lib/db";
import { env } from "@/lib/env";
import { generateStudySession } from "@/lib/ai/gemini";
import { isSubmitted, sortByPriority } from "@/lib/prioritization";
import type { CanvasAssignmentSummary, DashboardSummary } from "@/lib/types";

type CourseLike = {
  id: string;
  canvasCourseId?: number;
  name: string;
  courseCode?: string | null;
};

export type StudyAgentEvent =
  | {
      type: "study_session_created";
      label: string;
      assignmentId?: string | null;
      sessionId?: string | null;
      view: "sessions";
    }
  | {
      type: "dashboard_item_hidden";
      itemType: "assignment" | "course";
      itemId: string;
      label: string;
      view: "dashboard";
    }
  | {
      type: "dashboard_scope_reset";
      label: string;
      view: "dashboard";
    };

export type StudyAgentResult = {
  answer: string;
  agentEvents: StudyAgentEvent[];
  provider: "agent";
  model: null;
};

type StudyAgentInput = {
  user: User;
  message: string;
  dashboard: DashboardSummary;
  assignments: CanvasAssignmentSummary[];
  courses: CourseLike[];
};

const STOP_WORDS = new Set([
  "about",
  "assignment",
  "assignments",
  "canvas",
  "course",
  "courses",
  "dashboard",
  "for",
  "from",
  "hide",
  "make",
  "plan",
  "remove",
  "session",
  "study",
  "task",
  "tasks",
  "the",
  "this",
  "with",
]);

function normalise(value: string) {
  return value
    .toLowerCase()
    .replace(/&amp;/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value: string) {
  return normalise(value)
    .split(" ")
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

function scoreCandidate(query: string, candidate: string) {
  const normalisedQuery = normalise(query);
  const normalisedCandidate = normalise(candidate);
  if (!normalisedCandidate) return 0;
  if (normalisedQuery.includes(normalisedCandidate)) return 120;

  const queryTokens = tokens(query);
  const candidateTokens = new Set(tokens(candidate));
  return queryTokens.reduce((score, token) => {
    if (candidateTokens.has(token)) return score + 8;
    if (normalisedCandidate.includes(token)) return score + 3;
    return score;
  }, 0);
}

function parseDurationMinutes(message: string) {
  const hourMatch = message.match(/\b(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)\b/i);
  if (hourMatch) return Math.max(15, Math.min(480, Math.round(Number(hourMatch[1]) * 60)));
  const minuteMatch = message.match(/\b(\d{2,3})\s*(?:m|min|mins|minute|minutes)\b/i);
  if (minuteMatch) return Math.max(15, Math.min(480, Math.round(Number(minuteMatch[1]))));
  return 50;
}

function wantsCapabilityList(message: string) {
  return /\b(agent|tools?|actions?|capabilit|what can you do|what are you able)\b/i.test(message);
}

function wantsStudySession(message: string) {
  return (
    /\b(create|make|build|generate|start|draft)\b/i.test(message) &&
    /\b(study session|focus session|session|battle plan|study plan|plan)\b/i.test(message)
  );
}

function wantsHide(message: string) {
  return /\b(hide|remove|delete|exclude)\b/i.test(message) && /\b(dashboard|scope|sidekick|view)\b/i.test(message);
}

function wantsScopeReset(message: string) {
  return /\b(show everything|reset dashboard|reset scope|unhide all|restore dashboard|include everything)\b/i.test(message);
}

function isMostUrgentRequest(message: string) {
  return /\b(most urgent|urgent|top|first|next|due soon|priority|important)\b/i.test(message);
}

function topOpenAssignment(assignments: CanvasAssignmentSummary[], dashboard: DashboardSummary) {
  const dashboardItems = [
    ...(dashboard.priorityItems || []),
    ...dashboard.dueToday,
    ...dashboard.dueThisWeek,
    ...dashboard.unsubmitted,
  ];
  const merged = new Map<string, CanvasAssignmentSummary>();
  [...dashboardItems, ...assignments].forEach((assignment) => merged.set(assignment.id, assignment));
  return sortByPriority(Array.from(merged.values()).filter((assignment) => !isSubmitted(assignment)))[0] || null;
}

function bestAssignmentMatch(message: string, assignments: CanvasAssignmentSummary[]) {
  const scored = assignments
    .map((assignment) => ({
      assignment,
      score: Math.max(
        scoreCandidate(message, assignment.name),
        scoreCandidate(message, `${assignment.courseName} ${assignment.name}`),
        scoreCandidate(message, `${assignment.courseCode || ""} ${assignment.name}`),
      ),
    }))
    .sort((left, right) => right.score - left.score);

  if (!scored[0] || scored[0].score < 8) return null;
  if (scored[1] && scored[0].score === scored[1].score && scored[0].score < 40) return null;
  return scored[0].assignment;
}

function bestCourseMatch(message: string, courses: CourseLike[]) {
  const scored = courses
    .map((course) => ({
      course,
      score: Math.max(
        scoreCandidate(message, course.name),
        scoreCandidate(message, `${course.courseCode || ""} ${course.name}`),
      ),
    }))
    .sort((left, right) => right.score - left.score);

  if (!scored[0] || scored[0].score < 8) return null;
  if (scored[1] && scored[0].score === scored[1].score && scored[0].score < 40) return null;
  return scored[0].course;
}

function capabilitiesAnswer(): StudyAgentResult {
  return {
    provider: "agent",
    model: null,
    agentEvents: [],
    answer: [
      "Yep. Sidekick now has a small, safe tool belt.",
      "I can:",
      "- Create a study session for your most urgent assignment or a named assignment.",
      "- Build a custom focus plan from what you type.",
      "- Hide a named course or assignment from the dashboard scope.",
      "- Reset the dashboard scope so everything shows again.",
      "- Rank what to do next using Canvas due dates, submission status, files, rubrics, and uploaded materials.",
      "I still keep Canvas read-only: I will not submit work, message lecturers, delete Canvas data, or change grades.",
    ].join("\n"),
  };
}

async function createStudySessionTool(input: StudyAgentInput, assignment: CanvasAssignmentSummary | null) {
  const durationMinutes = parseDurationMinutes(input.message);
  const isCustom = !assignment;
  const context = assignment
    ? await getAssignmentContextForUser(input.user, assignment.id)
    : await getCustomFocusContextForUser(input.user, {
        title: "Custom focus session",
        focus: input.message,
      });

  if (!context) {
    return {
      provider: "agent" as const,
      model: null,
      agentEvents: [],
      answer: "I could not find enough context to create that session. Try naming the assignment exactly, or paste a short custom focus.",
    };
  }

  const mediaMaterials = await getStudySessionGeminiMaterialsForUser(input.user, {
    assignmentId: assignment?.id || null,
    courseId: context.course.id,
    query: `${context.assignment.name} ${context.assignment.description || ""} ${input.message}`,
  });

  const plan = await generateStudySession({
    context,
    mediaMaterials,
    durationMinutes,
    mode: "Plan assignment",
    energyLevel: "Medium",
    targetOutcome: "Credit",
    timezone: input.user.timezone,
    extraContext: isCustom ? input.message : undefined,
  });

  let sessionId: string | null = null;
  if (!isDemoUser(input.user) && env.DATABASE_URL) {
    const db = getDb();
    const session = await db.studySession.create({
      data: {
        userId: input.user.id,
        assignmentId: assignment?.id || null,
        title: plan.title,
        durationMinutes: plan.durationMinutes,
        mode: "Plan assignment",
        targetOutcome: "Credit",
        energyLevel: "Medium",
        generatedPlanJson: plan as unknown as Prisma.InputJsonValue,
      },
      select: { id: true },
    });
    sessionId = session.id;
    await auditLog({
      userId: input.user.id,
      action: "study_agent.study_session_created",
      metadata: { assignmentId: assignment?.id || null, sessionId },
    });
  }

  const confidence = plan.contextConfidence || context.contextConfidence;
  const missingContext = context.missingContext.length
    ? `\n\nMissing context I noticed: ${context.missingContext.slice(0, 2).join(" ")}`
    : "";

  return {
    provider: "agent" as const,
    model: null,
    agentEvents: [
      {
        type: "study_session_created" as const,
        label: `Study session created: ${plan.title}`,
        assignmentId: assignment?.id || null,
        sessionId,
        view: "sessions" as const,
      },
    ],
    answer: [
      `Done. I created a ${plan.durationMinutes}-minute study session: ${plan.title}.`,
      `Context confidence: ${confidence}.`,
      `Next action: ${plan.nextAction}`,
      "I opened Study Sessions so you can review the blocks, tweak anything, then start the timer.",
      missingContext,
    ]
      .filter(Boolean)
      .join("\n\n"),
  };
}

async function hideAssignmentTool(input: StudyAgentInput, assignment: CanvasAssignmentSummary) {
  if (isDemoUser(input.user) || !env.DATABASE_URL) {
    return {
      provider: "agent" as const,
      model: null,
      agentEvents: [],
      answer: "I can hide dashboard items once the app is connected to the real database. Demo mode does not save dashboard scope.",
    };
  }

  const db = getDb();
  const saved = await db.assignment.findFirst({
    where: { id: assignment.id, userId: input.user.id },
    include: { course: { select: { canvasCourseId: true } } },
  });
  if (!saved) {
    return {
      provider: "agent" as const,
      model: null,
      agentEvents: [],
      answer: "I could not find that assignment in your saved dashboard scope.",
    };
  }

  const preferences = await getDashboardPreferences(input.user.id);
  const key = canvasAssignmentKey(saved.course.canvasCourseId, saved.canvasAssignmentId);
  await saveDashboardPreferences(input.user.id, {
    ...preferences,
    excludedAssignmentIds: Array.from(new Set([...preferences.excludedAssignmentIds, saved.id])),
    excludedCanvasAssignmentKeys: key
      ? Array.from(new Set([...preferences.excludedCanvasAssignmentKeys, key]))
      : preferences.excludedCanvasAssignmentKeys,
  });
  await auditLog({
    userId: input.user.id,
    action: "study_agent.assignment_hidden",
    metadata: { assignmentId: saved.id, canvasAssignmentId: saved.canvasAssignmentId },
  });

  return {
    provider: "agent" as const,
    model: null,
    agentEvents: [
      {
        type: "dashboard_item_hidden" as const,
        itemType: "assignment" as const,
        itemId: saved.id,
        label: `Hidden from dashboard: ${assignment.name}`,
        view: "dashboard" as const,
      },
    ],
    answer: `Done. I hid "${assignment.name}" from your dashboard scope and future Canvas syncs. You can restore it from Settings by resetting the dashboard scope.`,
  };
}

async function hideCourseTool(input: StudyAgentInput, course: CourseLike) {
  if (isDemoUser(input.user) || !env.DATABASE_URL) {
    return {
      provider: "agent" as const,
      model: null,
      agentEvents: [],
      answer: "I can hide courses once the app is connected to the real database. Demo mode does not save dashboard scope.",
    };
  }

  const db = getDb();
  const saved = await db.course.findFirst({
    where: { id: course.id, userId: input.user.id },
    select: { id: true, canvasCourseId: true, name: true },
  });
  if (!saved) {
    return {
      provider: "agent" as const,
      model: null,
      agentEvents: [],
      answer: "I could not find that course in your saved dashboard scope.",
    };
  }

  const preferences = await getDashboardPreferences(input.user.id);
  await saveDashboardPreferences(input.user.id, {
    ...preferences,
    excludedCourseIds: Array.from(new Set([...preferences.excludedCourseIds, saved.id])),
    excludedCanvasCourseIds: Array.from(new Set([...preferences.excludedCanvasCourseIds, saved.canvasCourseId])),
  });
  await auditLog({
    userId: input.user.id,
    action: "study_agent.course_hidden",
    metadata: { courseId: saved.id, canvasCourseId: saved.canvasCourseId, name: saved.name },
  });

  return {
    provider: "agent" as const,
    model: null,
    agentEvents: [
      {
        type: "dashboard_item_hidden" as const,
        itemType: "course" as const,
        itemId: saved.id,
        label: `Hidden from dashboard: ${saved.name}`,
        view: "dashboard" as const,
      },
    ],
    answer: `Done. I hid "${saved.name}" from your dashboard scope and future Canvas syncs. You can bring it back from Settings by resetting the dashboard scope.`,
  };
}

async function resetScopeTool(input: StudyAgentInput) {
  if (isDemoUser(input.user) || !env.DATABASE_URL) {
    return {
      provider: "agent" as const,
      model: null,
      agentEvents: [],
      answer: "Demo mode does not have a saved dashboard scope to reset.",
    };
  }

  await resetDashboardPreferences(input.user.id);
  await auditLog({ userId: input.user.id, action: "study_agent.dashboard_scope_reset", metadata: {} });
  return {
    provider: "agent" as const,
    model: null,
    agentEvents: [
      {
        type: "dashboard_scope_reset" as const,
        label: "Dashboard scope reset.",
        view: "dashboard" as const,
      },
    ],
    answer: "Done. I reset the dashboard scope, so hidden courses and assignments can show again on the next refresh/sync.",
  };
}

export async function runStudyAgent(input: StudyAgentInput): Promise<StudyAgentResult | null> {
  const message = input.message.trim();

  if (wantsCapabilityList(message)) return capabilitiesAnswer();

  if (wantsScopeReset(message)) {
    return resetScopeTool(input);
  }

  if (wantsHide(message)) {
    const wantsCourse = /\b(course|subject|class)\b/i.test(message);
    const wantsAssignment = /\b(assignment|task|quiz|assessment)\b/i.test(message);
    const course = wantsCourse ? bestCourseMatch(message, input.courses) : null;
    const assignment = wantsAssignment || !course ? bestAssignmentMatch(message, input.assignments) : null;

    if (course && (!assignment || wantsCourse)) return hideCourseTool(input, course);
    if (assignment) return hideAssignmentTool(input, assignment);

    return {
      provider: "agent",
      model: null,
      agentEvents: [],
      answer:
        "I can hide items from the dashboard, but I need a clearer name. Try: `hide Cloud Foundations from dashboard` or `hide Week 6 Quiz from dashboard`.",
    };
  }

  if (wantsStudySession(message)) {
    const assignment = isMostUrgentRequest(message)
      ? topOpenAssignment(input.assignments, input.dashboard)
      : bestAssignmentMatch(message, input.assignments);
    return createStudySessionTool(input, assignment);
  }

  return null;
}
