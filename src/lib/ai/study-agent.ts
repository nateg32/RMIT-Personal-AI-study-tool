import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
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

type RecentStudyAgentMessage = {
  role: "user" | "assistant";
  content: string;
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
      itemType: "assignment" | "assignment_group" | "course";
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
  confirmation?: StudyAgentConfirmation;
};

type StudyAgentInput = {
  user: User;
  message: string;
  confirmationToken?: string;
  recentMessages?: RecentStudyAgentMessage[];
  dashboard: DashboardSummary;
  assignments: CanvasAssignmentSummary[];
  courses: CourseLike[];
};

type StudyAgentAction =
  | {
      type: "create_study_session";
      assignmentId?: string | null;
      message: string;
    }
  | {
      type: "hide_assignment";
      assignmentId: string;
      message: string;
    }
  | {
      type: "hide_course_assignments";
      courseId: string;
      message: string;
    }
  | {
      type: "hide_course";
      courseId: string;
      message: string;
    }
  | {
      type: "reset_scope";
      message: string;
    };

type SignedStudyAgentAction = StudyAgentAction & {
  userId: string;
  expiresAt: number;
  nonce: string;
};

export type StudyAgentConfirmation = {
  token: string;
  title: string;
  body: string;
  details: string[];
  confirmLabel: string;
  cancelLabel: string;
  actionType: StudyAgentAction["type"];
};

const STOP_WORDS = new Set([
  "about",
  "already",
  "assignment",
  "assignments",
  "canvas",
  "completed",
  "course",
  "courses",
  "dashboard",
  "done",
  "finished",
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

const SPELLING_FIXES = new Map([
  ["algorithim", "algorithm"],
  ["algorithims", "algorithm"],
  ["alogrithm", "algorithm"],
  ["alogrithms", "algorithm"],
  ["algo", "algorithm"],
  ["algos", "algorithm"],
]);

const CONFIRMATION_TTL_MS = 10 * 60 * 1000;

function base64Url(input: string | Buffer) {
  return Buffer.from(input).toString("base64url");
}

function signingSecret() {
  if (!env.ENCRYPTION_KEY) {
    throw new Error("ENCRYPTION_KEY is required for Study Agent confirmations.");
  }
  return env.ENCRYPTION_KEY;
}

function signAction(action: StudyAgentAction, userId: string) {
  const payload: SignedStudyAgentAction = {
    ...action,
    userId,
    expiresAt: Date.now() + CONFIRMATION_TTL_MS,
    nonce: randomUUID(),
  };
  const encoded = base64Url(JSON.stringify(payload));
  const signature = createHmac("sha256", signingSecret()).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

function verifyActionToken(token: string, userId: string): SignedStudyAgentAction {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) throw new Error("Confirmation expired or invalid. Ask Sidekick to prepare the action again.");

  const expected = createHmac("sha256", signingSecret()).update(encoded).digest("base64url");
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== signatureBuffer.length || !timingSafeEqual(expectedBuffer, signatureBuffer)) {
    throw new Error("Confirmation expired or invalid. Ask Sidekick to prepare the action again.");
  }

  const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as SignedStudyAgentAction;
  if (payload.userId !== userId || payload.expiresAt < Date.now()) {
    throw new Error("Confirmation expired or invalid. Ask Sidekick to prepare the action again.");
  }
  return payload;
}

function confirmationResult(
  input: StudyAgentInput,
  action: StudyAgentAction,
  confirmation: Omit<StudyAgentConfirmation, "token" | "actionType">,
): StudyAgentResult {
  return {
    provider: "agent",
    model: null,
    agentEvents: [],
    answer: "I can do that. Confirm first so I only change your dashboard or sessions when you clearly approve it.",
    confirmation: {
      ...confirmation,
      actionType: action.type,
      token: signAction(action, input.user.id),
    },
  };
}

function normalise(value: string) {
  return value
    .toLowerCase()
    .replace(/&amp;/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalToken(token: string) {
  const fixed = SPELLING_FIXES.get(token) || token;
  if (fixed.endsWith("ies") && fixed.length > 5) return `${fixed.slice(0, -3)}y`;
  if (fixed.endsWith("s") && fixed.length > 5 && !fixed.endsWith("ss") && !fixed.endsWith("is")) {
    return fixed.slice(0, -1);
  }
  return fixed;
}

function tokens(value: string) {
  return normalise(value)
    .split(" ")
    .map(canonicalToken)
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

function boundedEditDistance(left: string, right: string, maxDistance = 2) {
  if (left === right) return 0;
  if (Math.abs(left.length - right.length) > maxDistance) return maxDistance + 1;

  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row++) {
    const current = [row];
    let rowBest = current[0];
    for (let column = 1; column <= right.length; column++) {
      const cost = left[row - 1] === right[column - 1] ? 0 : 1;
      current[column] = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] + cost,
      );
      rowBest = Math.min(rowBest, current[column]);
    }
    if (rowBest > maxDistance) return maxDistance + 1;
    previous = current;
  }
  return previous[right.length];
}

function tokenMatchScore(queryToken: string, candidateToken: string) {
  if (queryToken === candidateToken) return 8;
  if (candidateToken.includes(queryToken) || queryToken.includes(candidateToken)) return 4;
  const distance = boundedEditDistance(queryToken, candidateToken, 2);
  if (distance === 1) return 6;
  if (distance === 2 && Math.min(queryToken.length, candidateToken.length) >= 6) return 3;
  return 0;
}

function scoreCandidate(query: string, candidate: string) {
  const normalisedQuery = normalise(query);
  const normalisedCandidate = normalise(candidate);
  if (!normalisedCandidate) return 0;
  if (normalisedQuery.includes(normalisedCandidate)) return 120;

  const queryTokens = tokens(query);
  const candidateTokens = tokens(candidate);
  return queryTokens.reduce((score, token) => {
    const bestTokenScore = candidateTokens.reduce(
      (best, candidateToken) => Math.max(best, tokenMatchScore(token, candidateToken)),
      0,
    );
    return score + bestTokenScore;
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
  const hasHideVerb = /\b(hide|remove|delete|exclude|ignore)\b/i.test(message);
  const hasScopeWord = /\b(dashboard|scope|sidekick|view|list)\b/i.test(message);
  const hasCompletionSignal = /\b(already|done|finished|completed|complete|submitted)\b/i.test(message);
  const hasStudyObject = /\b(assignment|assignments|assessment|assessments|task|tasks|quiz|quizzes|activity|activities|milestone|lab|labs|course|subject|class)\b/i.test(
    message,
  );
  return hasHideVerb && (hasScopeWord || (hasCompletionSignal && hasStudyObject));
}

function wantsScopeReset(message: string) {
  return /\b(show everything|reset dashboard|reset scope|unhide all|restore dashboard|include everything)\b/i.test(message);
}

function isMostUrgentRequest(message: string) {
  return /\b(most urgent|urgent|top|first|next|due soon|priority|important)\b/i.test(message);
}

function wantsAssignmentGroup(message: string) {
  return /\b(assignments|assessments|tasks|quizzes)\b/i.test(message);
}

function hasPronounReference(message: string) {
  return /\b(it|this|that|that one|this one|the one|same one|one due|due one|one that is due|one that's due)\b/i.test(message);
}

function hasAssignmentReference(message: string) {
  return /\b(assignment|assessment|task|quiz|activity|activities|milestone|lab|labs|deadline|due|aws|academy|submitted|finished|completed|done)\b/i.test(
    message,
  );
}

function hasExplicitCourseReference(message: string) {
  return /\b(course|subject|class)\b/i.test(message);
}

function recentContextText(input: StudyAgentInput) {
  return (input.recentMessages || [])
    .slice(-8)
    .map((message) => message.content)
    .filter((content) => content && content !== "__sidekick_working__")
    .join("\n")
    .slice(-4000);
}

function assignmentReferenceText(input: StudyAgentInput) {
  const context = hasPronounReference(input.message) ? recentContextText(input) : "";
  return [context, input.message].filter(Boolean).join("\n");
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

function assignmentBelongsToCourse(assignment: CanvasAssignmentSummary, course: CourseLike) {
  return (
    assignment.courseId === course.id ||
    normalise(assignment.courseName) === normalise(course.name) ||
    Boolean(course.courseCode && assignment.courseCode && normalise(course.courseCode) === normalise(assignment.courseCode))
  );
}

function bestSingleAssignmentInCourse(
  course: CourseLike,
  assignments: CanvasAssignmentSummary[],
  message: string,
) {
  const courseAssignments = assignments.filter((assignment) => assignmentBelongsToCourse(assignment, course));
  const typedAssignments = courseAssignments.filter((assignment) => assignment.assignmentType === "assignment");
  if (typedAssignments.length === 1) return typedAssignments[0];

  const scored = courseAssignments
    .map((assignment) => ({
      assignment,
      score: scoreCandidate(message, assignment.name),
    }))
    .sort((left, right) => right.score - left.score);

  if (!scored[0] || scored[0].score < 8) return null;
  if (scored[1] && scored[0].score === scored[1].score && scored[0].score < 40) return null;
  return scored[0].assignment;
}

function bestAssignmentMatch(message: string, assignments: CanvasAssignmentSummary[]) {
  const scored = assignments
    .map((assignment) => ({
      assignment,
      score: Math.max(
        scoreCandidate(message, assignment.name),
        scoreCandidate(message, `${assignment.courseName} ${assignment.name}`),
        scoreCandidate(message, `${assignment.courseCode || ""} ${assignment.name}`),
        scoreCandidate(
          message,
          `${assignment.courseName} ${assignment.courseCode || ""} ${assignment.name} ${
            assignment.description || ""
          } ${assignment.rubricSummary || ""}`,
        ),
      ),
    }))
    .sort((left, right) => right.score - left.score);

  if (!scored[0] || scored[0].score < 8) return null;
  if (scored[1] && scored[0].score === scored[1].score && scored[0].score < 40) return null;
  return scored[0].assignment;
}

function extractFocusReferenceText(content: string) {
  const references: string[] = [];
  const patterns = [
    /focus session:\s*([^.\n]+?)(?:\.\s*Current block:|Current block:|Tasks:|$)/i,
    /Help me with this focus session:\s*([^.\n]+?)(?:\.\s*Current block:|Current block:|Tasks:|$)/i,
    /(?:study session|focus plan|session)\s+(?:for|called|named)\s+["“]?([^"”.\n]+)["”]?/i,
  ];

  patterns.forEach((pattern) => {
    const match = content.match(pattern);
    if (match?.[1]) references.push(match[1]);
  });

  return references.map((reference) => reference.replace(/\b(Sprint|Study Session|Focus Session)\b/gi, " ").trim());
}

function assignmentAnchorScore(text: string, assignment: CanvasAssignmentSummary) {
  const normalisedText = normalise(text);
  const normalisedName = normalise(assignment.name);
  if (!normalisedText || !normalisedName) return 0;

  let score = 0;
  if (normalisedName.length >= 10 && normalisedText.includes(normalisedName)) {
    score = Math.max(score, 1000 + normalisedName.length);
  }

  extractFocusReferenceText(text).forEach((reference) => {
    const referenceScore = Math.max(
      scoreCandidate(reference, assignment.name),
      scoreCandidate(reference, `${assignment.courseName} ${assignment.name}`),
      scoreCandidate(reference, `${assignment.courseCode || ""} ${assignment.name}`),
    );
    if (referenceScore >= 40) score = Math.max(score, 520 + referenceScore);
  });

  const milestone = assignment.name.match(/\b(?:milestone|assignment|assessment)\s*\d+(?:\.\d+)?\b/i)?.[0];
  if (milestone && normalisedText.includes(normalise(milestone))) {
    score = Math.max(score, 360 + scoreCandidate(text, assignment.name));
  }

  return score;
}

function bestRecentAssignmentAnchor(input: StudyAgentInput, assignments: CanvasAssignmentSummary[]) {
  const recent = (input.recentMessages || [])
    .filter((message) => message.content && message.content !== "__sidekick_working__")
    .slice(-8)
    .reverse();

  const scored = recent
    .flatMap((message, index) =>
      assignments.map((assignment) => ({
        assignment,
        score:
          assignmentAnchorScore(message.content, assignment) +
          (message.role === "user" ? 90 : 35) +
          Math.max(0, 70 - index * 12) +
          Math.max(0, urgencyMatchBonus(assignment)),
      })),
    )
    .filter((item) => item.score >= 400)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return normalise(right.assignment.name).length - normalise(left.assignment.name).length;
    });

  if (!scored[0]) return null;
  if (scored[1] && scored[0].score - scored[1].score < 18) {
    const currentMessageScore = (assignment: CanvasAssignmentSummary) => scoreCandidate(input.message, assignment.name);
    if (currentMessageScore(scored[0].assignment) <= currentMessageScore(scored[1].assignment)) return null;
  }
  return scored[0].assignment;
}

function urgencyMatchBonus(assignment: CanvasAssignmentSummary) {
  if (isSubmitted(assignment)) return -30;
  let score = 0;
  if (assignment.priorityLabel === "critical") score += 28;
  if (assignment.priorityLabel === "high") score += 20;
  if (assignment.dueStatus === "overdue" || assignment.dueStatus === "due_today") score += 24;
  if (assignment.dueStatus === "due_this_week") score += 14;
  if (assignment.dueAt) {
    const due = new Date(assignment.dueAt).getTime();
    if (Number.isFinite(due)) {
      const hours = (due - Date.now()) / 36e5;
      if (hours >= -96 && hours <= 24) score += 18;
      else if (hours > 24 && hours <= 24 * 7) score += 10;
    }
  }
  return score;
}

function bestContextualAssignment(
  input: StudyAgentInput,
  course: CourseLike | null,
  options: { allowRecentContext: boolean },
) {
  const candidates = course
    ? input.assignments.filter((assignment) => assignmentBelongsToCourse(assignment, course))
    : input.assignments;
  if (!candidates.length) return null;

  const recentAnchor = options.allowRecentContext ? bestRecentAssignmentAnchor(input, candidates) : null;
  if (hasPronounReference(input.message) && recentAnchor) return recentAnchor;

  const direct = bestAssignmentMatch(input.message, candidates);
  if (direct) return direct;

  if (recentAnchor) return recentAnchor;

  const referenceText = options.allowRecentContext ? assignmentReferenceText(input) : input.message;
  const contextual = options.allowRecentContext ? bestAssignmentMatch(referenceText, candidates) : null;
  if (contextual) return contextual;

  const scored = candidates
    .map((assignment) => ({
      assignment,
      score:
        Math.max(
          scoreCandidate(referenceText, assignment.name),
          scoreCandidate(referenceText, `${assignment.courseName} ${assignment.name}`),
          scoreCandidate(referenceText, `${assignment.courseCode || ""} ${assignment.name}`),
          scoreCandidate(
            referenceText,
            `${assignment.courseName} ${assignment.courseCode || ""} ${assignment.name} ${
              assignment.description || ""
            } ${assignment.rubricSummary || ""}`,
          ),
        ) + urgencyMatchBonus(assignment),
    }))
    .sort((left, right) => right.score - left.score);

  if (!scored[0] || scored[0].score < 14) return null;
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

function createStudySessionConfirmation(
  input: StudyAgentInput,
  assignment: CanvasAssignmentSummary | null,
): StudyAgentResult {
  const durationMinutes = parseDurationMinutes(input.message);
  return confirmationResult(
    input,
    {
      type: "create_study_session",
      assignmentId: assignment?.id || null,
      message: input.message,
    },
    {
      title: assignment ? "Create this study session?" : "Create a custom focus session?",
      body: assignment
        ? `I will build a ${durationMinutes}-minute plan for "${assignment.name}" using Canvas facts and your uploaded materials.`
        : `I will turn your message into a ${durationMinutes}-minute custom focus plan.`,
      details: [
        assignment ? `Course: ${assignment.courseName}` : "Source: custom focus",
        assignment?.dueAt ? `Due: ${new Date(assignment.dueAt).toLocaleString("en-AU")}` : "Due date: not set",
        "Canvas remains read-only.",
      ],
      confirmLabel: "Create session",
      cancelLabel: "Not now",
    },
  );
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

function hideAssignmentConfirmation(input: StudyAgentInput, assignment: CanvasAssignmentSummary): StudyAgentResult {
  const completionSignal = /\b(already|done|finished|completed|complete|submitted)\b/i.test(input.message);
  return confirmationResult(
    input,
    {
      type: "hide_assignment",
      assignmentId: assignment.id,
      message: input.message,
    },
    {
      title: "Hide this assignment?",
      body: completionSignal
        ? `I will treat "${assignment.name}" as done inside Sidekick by hiding it from your dashboard scope.`
        : `I will remove "${assignment.name}" from your dashboard scope and future sync views inside Sidekick.`,
      details: [
        `Course: ${assignment.courseName}`,
        "Canvas stays read-only, so this does not submit, delete, or change the real Canvas item.",
        completionSignal ? "Useful when the work was submitted somewhere else, like AWS Academy or Ed." : null,
      ].filter((detail): detail is string => Boolean(detail)),
      confirmLabel: "Hide from dashboard",
      cancelLabel: "Keep showing it",
    },
  );
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

function hideCourseAssignmentsConfirmation(input: StudyAgentInput, course: CourseLike): StudyAgentResult {
  return confirmationResult(
    input,
    {
      type: "hide_course_assignments",
      courseId: course.id,
      message: input.message,
    },
    {
      title: "Hide this course's assignments?",
      body: `I will hide assignments from "${course.name}" in your dashboard scope, while keeping the course itself visible.`,
      details: [
        course.courseCode ? `Course code: ${course.courseCode}` : "Course code: not available",
        "Canvas remains read-only.",
      ],
      confirmLabel: "Hide assignments",
      cancelLabel: "Keep showing them",
    },
  );
}

async function hideCourseAssignmentsTool(input: StudyAgentInput, course: CourseLike) {
  if (isDemoUser(input.user) || !env.DATABASE_URL) {
    return {
      provider: "agent" as const,
      model: null,
      agentEvents: [],
      answer: "I can hide dashboard items once the app is connected to the real database. Demo mode does not save dashboard scope.",
    };
  }

  const db = getDb();
  const savedCourse = await db.course.findFirst({
    where: { id: course.id, userId: input.user.id },
    select: { id: true, canvasCourseId: true, name: true },
  });
  if (!savedCourse) {
    return {
      provider: "agent" as const,
      model: null,
      agentEvents: [],
      answer: "I found the course name, but I could not find its saved dashboard scope.",
    };
  }

  const savedAssignments = await db.assignment.findMany({
    where: { userId: input.user.id, courseId: savedCourse.id },
    include: { course: { select: { canvasCourseId: true } } },
  });
  if (!savedAssignments.length) {
    return {
      provider: "agent" as const,
      model: null,
      agentEvents: [],
      answer: `I found "${savedCourse.name}", but there are no saved assignments from that course to hide yet.`,
    };
  }

  const preferences = await getDashboardPreferences(input.user.id);
  const assignmentIds = savedAssignments.map((assignment) => assignment.id);
  const assignmentKeys = savedAssignments
    .map((assignment) => canvasAssignmentKey(assignment.course.canvasCourseId, assignment.canvasAssignmentId))
    .filter((key): key is string => Boolean(key));

  await saveDashboardPreferences(input.user.id, {
    ...preferences,
    excludedAssignmentIds: Array.from(new Set([...preferences.excludedAssignmentIds, ...assignmentIds])),
    excludedCanvasAssignmentKeys: Array.from(
      new Set([...preferences.excludedCanvasAssignmentKeys, ...assignmentKeys]),
    ),
  });
  await auditLog({
    userId: input.user.id,
    action: "study_agent.course_assignments_hidden",
    metadata: { courseId: savedCourse.id, canvasCourseId: savedCourse.canvasCourseId, count: savedAssignments.length },
  });

  return {
    provider: "agent" as const,
    model: null,
    agentEvents: [
      {
        type: "dashboard_item_hidden" as const,
        itemType: "assignment_group" as const,
        itemId: savedCourse.id,
        label: `Hidden ${savedAssignments.length} assignment${savedAssignments.length === 1 ? "" : "s"} from ${savedCourse.name}`,
        view: "dashboard" as const,
      },
    ],
    answer: `Done. I hid ${savedAssignments.length} assignment${savedAssignments.length === 1 ? "" : "s"} from "${savedCourse.name}" in your dashboard scope. The course itself stays visible, and Canvas stays read-only.`,
  };
}

function hideCourseConfirmation(input: StudyAgentInput, course: CourseLike): StudyAgentResult {
  return confirmationResult(
    input,
    {
      type: "hide_course",
      courseId: course.id,
      message: input.message,
    },
    {
      title: "Hide this course?",
      body: `I will hide "${course.name}" from your dashboard scope and future sync views inside Sidekick.`,
      details: [
        course.courseCode ? `Course code: ${course.courseCode}` : "Course code: not available",
        "This does not unenrol you or change Canvas.",
      ],
      confirmLabel: "Hide course",
      cancelLabel: "Keep showing it",
    },
  );
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

function resetScopeConfirmation(input: StudyAgentInput): StudyAgentResult {
  return confirmationResult(
    input,
    {
      type: "reset_scope",
      message: input.message,
    },
    {
      title: "Reset dashboard scope?",
      body: "I will show all previously hidden courses and assignments again on the next refresh or Canvas sync.",
      details: ["No Canvas data is changed.", "You can hide items again later."],
      confirmLabel: "Reset scope",
      cancelLabel: "Keep current scope",
    },
  );
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

async function executeConfirmedAction(input: StudyAgentInput, token: string) {
  const action = verifyActionToken(token, input.user.id);
  const confirmedInput = { ...input, message: action.message };

  if (action.type === "create_study_session") {
    const assignment = action.assignmentId
      ? input.assignments.find((item) => item.id === action.assignmentId) || null
      : null;
    return createStudySessionTool(confirmedInput, assignment);
  }

  if (action.type === "hide_assignment") {
    const assignment = input.assignments.find((item) => item.id === action.assignmentId);
    if (!assignment) {
      return {
        provider: "agent" as const,
        model: null,
        agentEvents: [],
        answer: "I could not find that assignment anymore. Refresh the dashboard, then ask me again.",
      };
    }
    return hideAssignmentTool(confirmedInput, assignment);
  }

  if (action.type === "hide_course_assignments") {
    const course = input.courses.find((item) => item.id === action.courseId);
    if (!course) {
      return {
        provider: "agent" as const,
        model: null,
        agentEvents: [],
        answer: "I could not find that course anymore. Refresh the dashboard, then ask me again.",
      };
    }
    return hideCourseAssignmentsTool(confirmedInput, course);
  }

  if (action.type === "hide_course") {
    const course = input.courses.find((item) => item.id === action.courseId);
    if (!course) {
      return {
        provider: "agent" as const,
        model: null,
        agentEvents: [],
        answer: "I could not find that course anymore. Refresh the dashboard, then ask me again.",
      };
    }
    return hideCourseTool(confirmedInput, course);
  }

  return resetScopeTool(confirmedInput);
}

export async function runStudyAgent(input: StudyAgentInput): Promise<StudyAgentResult | null> {
  const message = input.message.trim();

  if (input.confirmationToken) {
    return executeConfirmedAction(input, input.confirmationToken);
  }

  if (wantsCapabilityList(message)) return capabilitiesAnswer();

  if (wantsScopeReset(message)) {
    return resetScopeConfirmation(input);
  }

  if (wantsHide(message)) {
    const wantsCourse = hasExplicitCourseReference(message);
    const wantsAssignment = hasAssignmentReference(message);
    const usesRecentReference = hasPronounReference(message);
    const course =
      bestCourseMatch(message, input.courses) ||
      (usesRecentReference ? bestCourseMatch(recentContextText(input), input.courses) : null);
    const assignment =
      wantsAssignment || usesRecentReference || !course
        ? bestContextualAssignment(input, course && wantsAssignment ? course : null, {
            allowRecentContext: usesRecentReference || wantsAssignment,
          })
        : null;

    if (course && wantsAssignmentGroup(message)) return hideCourseAssignmentsConfirmation(input, course);
    if (assignment) return hideAssignmentConfirmation(input, assignment);
    if (course && wantsAssignment) {
      const fallbackAssignment = bestSingleAssignmentInCourse(course, input.assignments, message);
      if (fallbackAssignment) return hideAssignmentConfirmation(input, fallbackAssignment);
      return hideCourseAssignmentsConfirmation(input, course);
    }
    if (course && (!assignment || wantsCourse)) return hideCourseConfirmation(input, course);

    return {
      provider: "agent",
      model: null,
      agentEvents: [],
      answer:
        "I can hide items from the dashboard, but I need a clearer name. Try: `hide Cloud Foundations from dashboard`, `hide Algorithms assignments from dashboard`, or `hide Week 6 Quiz from dashboard`.",
    };
  }

  if (wantsStudySession(message)) {
    const assignment = isMostUrgentRequest(message)
      ? topOpenAssignment(input.assignments, input.dashboard)
      : bestAssignmentMatch(message, input.assignments);
    return createStudySessionConfirmation(input, assignment);
  }

  return null;
}

export const __studyAgentTest = {
  bestAssignmentMatch,
  bestContextualAssignment,
  bestCourseMatch,
  bestSingleAssignmentInCourse,
  hasAssignmentReference,
  hasPronounReference,
  wantsAssignmentGroup,
  wantsHide,
};
