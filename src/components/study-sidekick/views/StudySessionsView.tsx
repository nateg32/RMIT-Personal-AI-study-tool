"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import ViewHeader from "../components/ViewHeader";
import type {
  AssignmentSummary,
  CreateStudySessionInput,
  StudyPlan,
  StudySessionRecord,
  StudySessionUpdateInput,
  StudySidekickActions,
} from "../types";
import { assignmentTypeLabel, compactText, formatDate, isSubmitted, riskForAssignment, statusLabel } from "../lib/client-utils";
import { xpForFocusMinutes } from "../lib/streak";

type StudySessionsViewProps = {
  assignments: AssignmentSummary[];
  sessions: StudySessionRecord[];
  selectedAssignmentId: string | null;
  onSelectAssignment: (assignmentId: string | null) => void;
  onCreateSession: (input: CreateStudySessionInput) => void;
  onUpdateSession: (sessionId: string, generatedPlanJson: StudyPlan, status?: string) => Promise<void>;
  onUpdateSessionMeta: (sessionId: string, updates: StudySessionUpdateInput) => Promise<void>;
  onUpdateAssignmentStatus: (assignmentId: string, status: "open" | "submitted_elsewhere") => Promise<void>;
  isCreatingSession: boolean;
  actions: StudySidekickActions;
};

const durationOptions = [25, 50, 90];
const defaultDuration = 50;
const memoryPadLabels = ["A", "B", "C", "D"];
const memoryPatterns = [
  [0, 2, 1],
  [1, 3, 0, 2],
  [2, 0, 3, 1, 2],
  [3, 1, 0, 2, 3, 1],
];
const breakActivities = [
  "Stand up and relax your shoulders.",
  "Drink water and look away from the screen.",
  "Walk around for two minutes.",
  "Write one tiny note about what felt unclear.",
  "Take five slow breaths before the next block.",
];
const defaultSessionSettings = {
  mode: "Plan assignment",
  energyLevel: "Medium",
  targetOutcome: "Credit",
};
const newCustomSessionId = "__new_custom_session";
const focusLaunchStoragePrefix = "study-sidekick-focus-launch:";
const emptyCompletedTasks: Record<string, boolean> = {};
const emptyChecklist: string[] = [];

type SessionSource = "canvas" | "custom";
type FocusStage = "brief" | "lock" | "focus" | "break";
type BreakMode = "breathe" | "memory" | "activities";
type CustomBlockDraft = {
  name: string;
  minutes: string;
  tasks: string;
};
type FocusLaunchPayload = {
  source: SessionSource;
  assignmentId: string | null;
  customSessionId: string | null;
  plan: StudyPlan;
  activeBlockIndex: number;
  duration: number;
  createdAt: number;
};

function clampMinutes(value: number) {
  return Math.max(5, Math.min(240, Number.isFinite(value) ? Math.round(value) : defaultDuration));
}

function clampBreakMinutes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return undefined;
  return Math.max(1, Math.min(60, Math.round(value)));
}

function textLines(value: string) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function createCustomBlockDraft(index = 0): CustomBlockDraft {
  return {
    name: index === 0 ? "Focus block" : `Block ${index + 1}`,
    minutes: index === 0 ? "25" : "15",
    tasks: "",
  };
}

function randomLaunchKey() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function focusLaunchStorageKey(key: string) {
  return `${focusLaunchStoragePrefix}${key}`;
}

function customBlockTasks(block: CustomBlockDraft, fallbackFocus: string) {
  const tasks = textLines(block.tasks).slice(0, 8);
  if (tasks.length) return tasks;
  const fallback = fallbackFocus.trim();
  return fallback ? [fallback] : ["Work on this focus task"];
}

function buildCustomSessionPlan(title: string, focus: string, blocks: CustomBlockDraft[]): StudyPlan {
  const focusTitle = title.trim() || "Custom focus session";
  const normalisedBlocks = blocks
    .filter((block) => block.name.trim() || block.tasks.trim() || focus.trim())
    .slice(0, 6)
    .map((block, index) => {
      const name = block.name.trim() || `Block ${index + 1}`;
      const minutes = clampMinutes(Number(block.minutes || (index === 0 ? 25 : 15)));
      const tasks = customBlockTasks(block, focus);
      return {
        name,
        minutes,
        tasks,
        goal: tasks[0],
        breakMinutes: index < blocks.length - 1 && minutes >= 25 ? 5 : undefined,
      };
    });
  const safeBlocks = normalisedBlocks.length
    ? normalisedBlocks
    : [
        {
          name: "Focus block",
          minutes: 25,
          tasks: [focus.trim() || "Work on this focus task"],
          goal: focus.trim() || "Make focused progress.",
        },
      ];
  const durationMinutes = safeBlocks.reduce((total, block) => total + block.minutes, 0);
  const checklist = safeBlocks
    .flatMap((block) => block.tasks)
    .map((task) => cleanPlanText(task, 90))
    .filter(Boolean)
    .slice(0, 8);

  return {
    title: focusTitle,
    durationMinutes: Math.max(15, Math.min(480, durationMinutes)),
    riskLevel: "low",
    contextConfidence: "high",
    contextSummary: [
      "Custom focus created by you.",
      `${safeBlocks.length} time block${safeBlocks.length === 1 ? "" : "s"} planned.`,
      "Canvas is optional for this session.",
    ],
    needsUserContext: false,
    analysisSummary: focus.trim()
      ? `This is a self-directed focus session for: ${cleanPlanText(focus, 180)}`
      : "This is a self-directed focus session built from your own time blocks.",
    assignmentBrief: focus.trim() || "Custom focus session.",
    deliverables: safeBlocks.map((block) => `${block.name}: ${cleanPlanText(block.tasks[0], 90)}`),
    successCriteria: checklist.length ? checklist.slice(0, 4) : ["Finish the planned block", "Write the next action"],
    rubricFocus: [],
    blocks: safeBlocks,
    checklist: checklist.length ? checklist : ["Finish the focus block", "Write the next action"],
    definitionOfDone: [
      "The planned blocks are completed or intentionally paused.",
      "Any unfinished work has a clear next action.",
      "Progress is saved in Sidekick.",
    ],
    resourcesToOpen: [],
    resourcePlan: [],
    nextAction: safeBlocks[0]?.tasks[0] || "Start the first focus block.",
  };
}

function minutesToClock(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const rest = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${rest}`;
}

function planFocusMinutes(plan: StudyPlan) {
  const blockMinutes = plan.blocks.reduce((total, block) => total + Math.max(0, block.minutes || 0), 0);
  return Math.max(5, plan.durationMinutes || blockMinutes || defaultDuration);
}

function buildMemoryPattern(length = 3) {
  return memoryPatterns[Math.max(0, Math.min(memoryPatterns.length - 1, length - 3))];
}

function contextConfidenceForAssignment(assignment?: AssignmentSummary | null, plan?: StudyPlan) {
  if (plan?.contextConfidence) return plan.contextConfidence;
  if (!assignment) return "low" as const;
  const hasDescription = Boolean(compactText(assignment.description, "").trim());
  const hasRubric = Boolean(compactText(assignment.rubricSummary, "").trim());
  if (hasDescription && hasRubric) return "high" as const;
  if (hasDescription || hasRubric) return "medium" as const;
  return "low" as const;
}

function confidenceCopy(confidence: "high" | "medium" | "low") {
  if (confidence === "high") {
    return {
      label: "High context",
      icon: "verified",
      body: "Canvas has enough detail for a specific plan.",
    };
  }
  if (confidence === "medium") {
    return {
      label: "Medium context",
      icon: "rule",
      body: "Canvas has useful assignment detail, but the plan may still need a quick check.",
    };
  }
  return {
    label: "Needs a brief",
    icon: "edit_note",
    body: "Canvas does not have enough detail for this task. Add a short brief or customize the generated tasks.",
  };
}

function cleanPlanText(value: string | null | undefined, max = 220) {
  const text = compactText(value, "")
    .replace(/&amp;/gi, "&")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max).trim()}...` : text;
}

function looksLikeRawCanvasText(value: string | null | undefined) {
  const text = compactText(value, "").toLowerCase();
  if (text.length > 520) return true;
  return [
    "course name:",
    "course code:",
    "assignment title:",
    "learning outcomes",
    "overview of the assignment",
    "weighting:",
    "deadline:",
    "rubric criteria",
    "important:",
  ].some((marker) => text.includes(marker));
}

function looksGenericPlanText(value: string | null | undefined) {
  const text = cleanPlanText(value, 260).toLowerCase();
  return [
    "confirm the deliverables",
    "match work to the marking criteria",
    "check submission requirements",
    "open the canvas assignment page",
    "complete the highest-impact part first",
  ].includes(text);
}

function assignmentSourceText(assignment?: AssignmentSummary | null) {
  return compactText(`${assignment?.name || ""} ${assignment?.description || ""}`, "");
}

function extractAwsItemsFromAssignment(assignment?: AssignmentSummary | null) {
  const text = cleanPlanText(assignmentSourceText(assignment), 4_000);
  return Array.from(
    text.matchAll(
      /\b(Lab\s*[-:]?\s*\d+|Activity)\s*[-:]?\s*([\s\S]*?)(?=\s+\b(?:Lab\s*[-:]?\s*\d+|Activity)\b|\s+\b(?:Learning Outcomes?|Course Learning Outcomes?|Deadline|Weighting|Submission|IMPORTANT)\b|$)/gi,
    ),
  )
    .map((match) => {
      const label = cleanPlanText(match[1], 28).replace(/lab/i, "Lab").replace(/activity/i, "Activity");
      const name = cleanPlanText(match[2], 80);
      return label && name ? `${label}: ${name}` : "";
    })
    .filter(Boolean)
    .slice(0, 10);
}

function isAwsAssignment(assignment?: AssignmentSummary | null) {
  const source = assignmentSourceText(assignment).toLowerCase();
  return source.includes("aws academy") || (source.includes("aws") && source.includes("lab") && source.includes("activity"));
}

function taskSpecificAssignmentSummary(assignment?: AssignmentSummary | null) {
  if (!isAwsAssignment(assignment)) return "";
  const items = extractAwsItemsFromAssignment(assignment);
  return `${assignment?.name || "This task"} is about completing ${items.length || 8} AWS Academy labs/activities outside Canvas, then confirming/submitting them in AWS Academy and keeping evidence because Canvas may still show it as unsubmitted.`;
}

function taskSpecificAssignmentDeliverables(assignment?: AssignmentSummary | null) {
  if (!isAwsAssignment(assignment)) return [];
  const items = extractAwsItemsFromAssignment(assignment);
  const firstHalf = items.slice(0, Math.ceil(items.length / 2));
  const secondHalf = items.slice(Math.ceil(items.length / 2));
  return [
    firstHalf.length ? `Finish: ${firstHalf.join("; ")}` : "Check AWS Academy for unfinished required labs/activities",
    secondHalf.length ? `Finish: ${secondHalf.join("; ")}` : "Complete the remaining AWS Academy labs/activities",
    "Submit or mark each item complete inside AWS Academy",
    "Save screenshots or notes proving completion",
    "Use Canvas only to confirm deadline, weighting, and instructions",
  ];
}

function interpretedPlanSummary(plan: StudyPlan, assignment?: AssignmentSummary | null) {
  const preferred = plan.analysisSummary || plan.assignmentBrief;
  const specificSummary = taskSpecificAssignmentSummary(assignment);
  if (specificSummary && (!preferred || looksLikeRawCanvasText(preferred) || /this looks like a|identifying the deliverables/i.test(preferred))) {
    return specificSummary;
  }
  if (preferred && !looksLikeRawCanvasText(preferred)) return cleanPlanText(preferred, 260);
  if (!assignment) return "Choose an assignment, then Sidekick will turn the available context into a simple plan.";
  const type = assignmentTypeLabel(assignment).toLowerCase();
  return `This looks like a ${type} for ${assignment.courseName}. The plan focuses on understanding the task, identifying the deliverables, using the right course resources, and leaving with a clear next action.`;
}

function inferredDeliverables(plan: StudyPlan, assignment?: AssignmentSummary | null) {
  const specific = taskSpecificAssignmentDeliverables(assignment);
  const planDeliverables = (plan.deliverables || [])
    .map((item) => cleanPlanText(item, 130))
    .filter((item) => item && !looksLikeRawCanvasText(item) && !looksGenericPlanText(item));
  if (specific.length && planDeliverables.length < 3) return specific.slice(0, 5);
  if (specific.length && planDeliverables.some((item) => /canvas assignment page|summarise the task/i.test(item))) {
    return specific.slice(0, 5);
  }
  if (planDeliverables.length) return planDeliverables.slice(0, 5);
  const blockTasks = plan.blocks.flatMap((block) => block.tasks || []).map((item) => cleanPlanText(item, 130)).filter(Boolean);
  if (blockTasks.length) return blockTasks.slice(0, 4);
  if (!assignment) return ["Choose an assignment", "Generate a plan", "Start the first focus block"];
  return [
    `Clarify the required output for ${assignment.name}`,
    "Check the submission instructions",
    "Complete the highest-impact part first",
  ];
}

function inferredSuccessCriteria(plan: StudyPlan, assignment?: AssignmentSummary | null) {
  if (isAwsAssignment(assignment)) {
    return [
      "All required AWS Academy labs/activities show complete or submitted.",
      "Completion evidence is saved outside Canvas.",
      "Canvas deadline and external-platform instructions are checked.",
      "Any blocked AWS Academy item is written down clearly.",
    ];
  }
  const criteria = [...(plan.successCriteria || []), ...(plan.rubricFocus || [])]
    .map((item) => cleanPlanText(item, 140))
    .filter((item) => item && !looksLikeRawCanvasText(item) && !looksGenericPlanText(item));
  if (criteria.length) return criteria.slice(0, 4);
  return (plan.definitionOfDone || []).map((item) => cleanPlanText(item, 140)).filter(Boolean).slice(0, 4);
}

function inferredResources(plan: StudyPlan) {
  const planned = (plan.resourcePlan || []).map((resource) => ({
    title: cleanPlanText(resource.title, 90),
    reason: cleanPlanText(resource.reason, 130),
    url: resource.url,
  }));
  if (planned.length) return planned.slice(0, 4);
  return (plan.resourcesToOpen || []).slice(0, 4).map((resource) => ({
    title: cleanPlanText(resource.title, 90),
    reason: "Open this when it supports the current work block.",
    url: resource.url,
  }));
}

function fallbackPlan(assignment?: AssignmentSummary | null, duration = defaultDuration): StudyPlan {
  const title = assignment ? `${assignment.name} Sprint` : "Study Session";
  const summary = assignment
    ? `This looks like a ${assignmentTypeLabel(assignment).toLowerCase()} for ${assignment.courseName}. Start by turning the brief into deliverables, then make progress on the highest-impact task.`
    : "Choose an assignment, then Sidekick will create a simple focus plan.";
  return {
    title,
    durationMinutes: duration,
    riskLevel: assignment ? riskForAssignment(assignment) : "low",
    contextConfidence: contextConfidenceForAssignment(assignment),
    needsUserContext: contextConfidenceForAssignment(assignment) === "low",
    contextSummary: [
      assignment?.description ? "Assignment description found." : "Assignment description is missing.",
      assignment?.rubricSummary ? "Rubric summary found." : "Rubric summary is missing.",
    ],
    analysisSummary: summary,
    assignmentBrief: summary,
    deliverables: assignment
      ? ["Clarify the required output", "Check submission instructions", "Complete the highest-impact part first"]
      : ["Choose an assignment", "Generate a plan", "Start the first focus block"],
    successCriteria: ["Requirements are clear", "Progress is saved", "Next action is written"],
    rubricFocus: ["Requirements are clear", "Progress is saved", "Next action is written"],
    blocks: [
      {
        name: "Understand the task",
        minutes: Math.max(10, Math.round(duration * 0.25)),
        goal: "Turn the assignment into clear requirements.",
        tasks: ["Open the Canvas brief", "Identify deliverables", "Write the first tiny next step"],
        breakMinutes: duration >= 50 ? 3 : undefined,
      },
      {
        name: "Make progress",
        minutes: Math.max(15, Math.round(duration * 0.55)),
        goal: "Do the highest-impact work first.",
        tasks: ["Work on the most important deliverable", "Use any rubric or lecture resources", "Save evidence or notes as you go"],
        breakMinutes: duration >= 90 ? 5 : undefined,
      },
      {
        name: "Checkpoint",
        minutes: Math.max(10, Math.round(duration * 0.2)),
        goal: "Leave with a clean next action.",
        tasks: ["Update the checklist", "Write the next step", "Confirm what still needs submitting"],
      },
    ],
    checklist: ["Brief understood", "Main deliverable started", "Next action written"],
    definitionOfDone: ["You know what to do next", "Progress is saved", "Submission requirements are clear"],
    resourcesToOpen: assignment?.htmlUrl ? [{ title: "Canvas assignment", url: assignment.htmlUrl }] : [],
    resourcePlan: assignment?.htmlUrl
      ? [{ title: "Canvas assignment", url: assignment.htmlUrl, reason: "Use this to check the official brief and submission details." }]
      : [],
    nextAction: assignment?.htmlUrl ? "Open the Canvas brief." : "Choose an assignment.",
  };
}

export default function StudySessionsView(props: StudySessionsViewProps) {
  const {
    assignments,
    sessions,
    selectedAssignmentId,
    onSelectAssignment,
    onCreateSession,
    onUpdateSession,
    onUpdateAssignmentStatus,
    isCreatingSession,
    actions,
  } = props;
  const [sessionSource, setSessionSource] = useState<SessionSource>("canvas");
  const [duration, setDuration] = useState(defaultDuration);
  const [userContext, setUserContext] = useState("");
  const [selectedCustomSessionId, setSelectedCustomSessionId] = useState(newCustomSessionId);
  const [customTitle, setCustomTitle] = useState("Custom focus session");
  const [customFocus, setCustomFocus] = useState("");
  const [customBlocks, setCustomBlocks] = useState<CustomBlockDraft[]>([createCustomBlockDraft()]);
  const [activeBlockIndex, setActiveBlockIndex] = useState(0);
  const [showPlanEditor, setShowPlanEditor] = useState(false);
  const [focusFullscreen, setFocusFullscreen] = useState(false);
  const [focusStage, setFocusStage] = useState<FocusStage>("brief");
  const [breakMode, setBreakMode] = useState<BreakMode>("breathe");
  const [breakSecondsLeft, setBreakSecondsLeft] = useState(0);
  const [memoryRound, setMemoryRound] = useState(1);
  const [memoryPattern, setMemoryPattern] = useState(() => buildMemoryPattern());
  const [memoryInput, setMemoryInput] = useState<number[]>([]);
  const [localCompletion, setLocalCompletion] = useState<{ key: string; tasks: Record<string, boolean> }>({
    key: "",
    tasks: {},
  });
  const [reflectionSelected, setReflectionSelected] = useState<string[]>([]);
  const [reflectionCustomText, setReflectionCustomText] = useState("");
  const [reflectionMessage, setReflectionMessage] = useState<string | null>(null);
  const [timerState, setTimerState] = useState({ key: "", secondsLeft: defaultDuration * 60, running: false });
  const [blockDraft, setBlockDraft] = useState({ name: "", minutes: "25", tasks: "", breakMinutes: "" });
  const [checklistDraft, setChecklistDraft] = useState("");
  const completedTimerKeys = useRef(new Set<string>());
  const customSessionCountRef = useRef(sessions.filter((session) => !session.assignmentId).length);
  const focusLaunchHandledRef = useRef(false);

  const customSessions = useMemo(() => sessions.filter((session) => !session.assignmentId), [sessions]);
  const selectedCustomSession =
    selectedCustomSessionId === newCustomSessionId
      ? null
      : customSessions.find((session) => session.id === selectedCustomSessionId) || null;
  const customDraftPlan = useMemo(
    () => buildCustomSessionPlan(customTitle, customFocus, customBlocks),
    [customBlocks, customFocus, customTitle],
  );
  const selectedAssignment =
    sessionSource === "canvas"
      ? assignments.find((assignment) => assignment.id === selectedAssignmentId) || assignments[0] || null
      : null;
  const activeSession =
    sessionSource === "custom"
      ? selectedCustomSession
      : sessions.find((session) => session.assignmentId && session.assignmentId === selectedAssignment?.id) || null;
  const plan =
    activeSession?.generatedPlanJson ||
    (sessionSource === "custom" ? customDraftPlan : fallbackPlan(selectedAssignment, duration));
  const confidence = contextConfidenceForAssignment(selectedAssignment, plan);
  const confidenceDetails = confidenceCopy(confidence);
  const needsUserContext = sessionSource === "canvas" && (plan.needsUserContext || confidence === "low");
  const safeActiveBlockIndex = Math.min(activeBlockIndex, Math.max(0, plan.blocks.length - 1));
  const activeBlock = plan.blocks[safeActiveBlockIndex] || plan.blocks[0];
  const totalSeconds = Math.max(60, (activeBlock?.minutes || duration) * 60);
  const isLastBlock = safeActiveBlockIndex >= Math.max(0, plan.blocks.length - 1);
  const activeBreakMinutes = activeBlock?.breakMinutes || (!isLastBlock ? 5 : 0);
  const timerKey = `${activeSession?.id || selectedAssignment?.id || "draft"}:${safeActiveBlockIndex}:${totalSeconds}`;
  const timer = useMemo(
    () => (timerState.key === timerKey ? timerState : { key: timerKey, secondsLeft: totalSeconds, running: false }),
    [timerKey, timerState, totalSeconds],
  );
  const { secondsLeft, running } = timer;
  const completionKey = activeSession?.id || (sessionSource === "custom" ? "custom-draft" : selectedAssignment?.id || "draft");
  const currentLocalCompletedTasks = localCompletion.key === completionKey ? localCompletion.tasks : emptyCompletedTasks;
  const persistedCompletedMap = plan.completedTasks || emptyCompletedTasks;
  const completedMap = useMemo(
    () => ({ ...persistedCompletedMap, ...currentLocalCompletedTasks }),
    [currentLocalCompletedTasks, persistedCompletedMap],
  );
  const checklist = plan.checklist || emptyChecklist;
  const completedCount = checklist.filter((item) => completedMap[item]).length;
  const progressRatio = totalSeconds ? (totalSeconds - secondsLeft) / totalSeconds : 0;
  const activeBlockTasksText = (activeBlock?.tasks || []).join("\n");
  const checklistText = checklist.join("\n");
  const sessionRewardMinutes = planFocusMinutes(plan);
  const sessionRewardXp = xpForFocusMinutes(sessionRewardMinutes);
  const actionsDisabled = Boolean(actions.isBusy);
  const planSummary = interpretedPlanSummary(plan, selectedAssignment);
  const deliverables = inferredDeliverables(plan, selectedAssignment);
  const successCriteria = inferredSuccessCriteria(plan, selectedAssignment);
  const resourcePlan = inferredResources(plan);
  const summaryItems = sessionSource === "custom"
    ? [
        activeSession ? "Saved custom focus session." : "Manual plan from your own blocks.",
        `${plan.blocks.length} block${plan.blocks.length === 1 ? "" : "s"}, ${plan.durationMinutes} minutes.`,
        "Canvas is optional for this session.",
      ]
    : plan.contextSummary?.length
    ? plan.contextSummary
    : [
        selectedAssignment?.description ? "Canvas assignment description found." : "Canvas assignment description is missing.",
        selectedAssignment?.rubricSummary ? "Rubric summary found." : "Rubric summary is missing.",
      ];
  const whatMatters = (successCriteria.length ? successCriteria : deliverables).slice(0, 4);
  const laterBlocks = plan.blocks.slice(safeActiveBlockIndex + 1, safeActiveBlockIndex + 4);
  const customReady =
    Boolean(customTitle.trim()) &&
    (Boolean(customFocus.trim()) || customBlocks.some((block) => block.tasks.trim()));
  const reflectionCandidates = useMemo(
    () =>
      Array.from(new Set([...(activeBlock?.tasks || []), ...checklist].map((item) => cleanPlanText(item, 120)).filter(Boolean)))
        .sort((left, right) => Number(Boolean(completedMap[left])) - Number(Boolean(completedMap[right])))
        .slice(0, 8),
    [activeBlock?.tasks, checklist, completedMap],
  );

  const resetReflection = () => {
    setReflectionSelected([]);
    setReflectionCustomText("");
    setReflectionMessage(null);
  };

  useEffect(() => {
    if (sessionSource !== "custom") {
      customSessionCountRef.current = customSessions.length;
      return;
    }
    if (
      !isCreatingSession &&
      selectedCustomSessionId === newCustomSessionId &&
      customSessions.length > customSessionCountRef.current
    ) {
      setSelectedCustomSessionId(customSessions[0]?.id || newCustomSessionId);
    }
    customSessionCountRef.current = customSessions.length;
  }, [customSessions, isCreatingSession, selectedCustomSessionId, sessionSource]);

  useEffect(() => {
    if (focusLaunchHandledRef.current || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("focus") !== "1") return;

    const sessionId = params.get("sessionId");
    const assignmentId = params.get("assignmentId");
    const customSessionId = params.get("customSessionId");
    const draftKey = params.get("draftKey");
    const blockIndex = Number(params.get("block") || 0);
    const scheduleFocusLaunch = (launch: () => void) => {
      focusLaunchHandledRef.current = true;
      window.history.replaceState(null, "", window.location.pathname);
      window.setTimeout(launch, 0);
    };

    if (sessionId) {
      const matchedSession = sessions.find((session) => session.id === sessionId);
      if (!matchedSession) return;
      scheduleFocusLaunch(() => {
        if (matchedSession.assignmentId) {
          setSessionSource("canvas");
          onSelectAssignment(matchedSession.assignmentId);
        } else {
          setSessionSource("custom");
          setSelectedCustomSessionId(matchedSession.id);
        }
        setActiveBlockIndex(Math.max(0, blockIndex));
        setFocusStage("brief");
        setFocusFullscreen(true);
      });
    } else if (assignmentId && assignments.some((assignment) => assignment.id === assignmentId)) {
      scheduleFocusLaunch(() => {
        setSessionSource("canvas");
        onSelectAssignment(assignmentId);
        setActiveBlockIndex(Math.max(0, blockIndex));
        setFocusStage("brief");
        setFocusFullscreen(true);
      });
    } else if (customSessionId && customSessions.some((session) => session.id === customSessionId)) {
      scheduleFocusLaunch(() => {
        setSessionSource("custom");
        setSelectedCustomSessionId(customSessionId);
        setActiveBlockIndex(Math.max(0, blockIndex));
        setFocusStage("brief");
        setFocusFullscreen(true);
      });
    } else if (draftKey) {
      try {
        const stored = window.localStorage.getItem(focusLaunchStorageKey(draftKey));
        if (!stored) return;
        const payload = JSON.parse(stored) as FocusLaunchPayload;
        if (!payload || Date.now() - payload.createdAt > 10 * 60 * 1000) return;
        window.localStorage.removeItem(focusLaunchStorageKey(draftKey));
        scheduleFocusLaunch(() => {
          setSessionSource(payload.source);
          if (payload.assignmentId) onSelectAssignment(payload.assignmentId);
          if (payload.customSessionId) setSelectedCustomSessionId(payload.customSessionId);
          setDuration(payload.duration);
          setActiveBlockIndex(Math.max(0, payload.activeBlockIndex));
          setFocusStage("brief");
          setFocusFullscreen(true);
        });
      } catch {
        window.localStorage.removeItem(focusLaunchStorageKey(draftKey));
      }
    }
  }, [assignments, customSessions, onSelectAssignment, sessions]);

  useEffect(() => {
    if (!running) return;
    const interval = window.setInterval(() => {
      setTimerState((current) => {
        const active = current.key === timerKey ? current : timer;
        if (active.secondsLeft <= 1) {
          window.clearInterval(interval);
          return { ...active, secondsLeft: 0, running: false };
        }
        return { ...active, secondsLeft: active.secondsLeft - 1 };
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [running, timer, timerKey]);

  useEffect(() => {
    if (focusStage !== "break" || breakSecondsLeft <= 0) return;
    const interval = window.setInterval(() => {
      setBreakSecondsLeft((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [breakSecondsLeft, focusStage]);

  useEffect(() => {
    if (!activeSession || secondsLeft !== 0 || completedTimerKeys.current.has(timerKey)) return;
    completedTimerKeys.current.add(timerKey);
    void onUpdateSession(
      activeSession.id,
      {
        ...plan,
        activeBlockIndex: safeActiveBlockIndex,
      },
      isLastBlock ? "completed" : "in_progress",
    ).catch(() => undefined);
    if (focusFullscreen) {
      window.setTimeout(() => {
        setReflectionSelected([]);
        setReflectionCustomText("");
        setReflectionMessage(null);
        setFocusStage("break");
        setBreakMode("breathe");
        setBreakSecondsLeft(isLastBlock ? 0 : Math.max(60, activeBreakMinutes * 60));
        setMemoryInput([]);
        setMemoryRound(1);
        setMemoryPattern(buildMemoryPattern());
      }, 0);
    }
  }, [
    activeBreakMinutes,
    activeSession,
    focusFullscreen,
    isLastBlock,
    onUpdateSession,
    plan,
    safeActiveBlockIndex,
    secondsLeft,
    timerKey,
  ]);

  useEffect(() => {
    if (!focusFullscreen) return;
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFocusFullscreen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [focusFullscreen]);

  const generateSession = () => {
    if (actionsDisabled) return;
    if (sessionSource === "custom") {
      if (!customReady) {
        actions.onOpenChat("Add a title plus at least one focus task or time block before creating a custom session.");
        return;
      }
      onCreateSession({
        assignmentId: null,
        customTitle: customDraftPlan.title,
        customFocus:
          customFocus.trim() ||
          customDraftPlan.blocks
            .flatMap((block) => block.tasks)
            .filter(Boolean)
            .join("\n"),
        durationMinutes: customDraftPlan.durationMinutes,
        mode: "Custom focus",
        energyLevel: "Manual",
        targetOutcome: "Just complete",
        manualPlan: {
          ...customDraftPlan,
          completedTasks: currentLocalCompletedTasks,
        },
      });
      return;
    }
    if (!selectedAssignment) {
      actions.onOpenChat("I need Canvas assignments before I can build a focused session.");
      return;
    }

    onCreateSession({
      assignmentId: selectedAssignment.id,
      durationMinutes: duration,
      customFocus: userContext.trim() || undefined,
      ...defaultSessionSettings,
    });
  };

  const selectBlock = async (index: number) => {
    setShowPlanEditor(false);
    const nextSeconds = Math.max(60, (plan.blocks[index]?.minutes || duration) * 60);
    setActiveBlockIndex(index);
    setTimerState({
      key: `${activeSession?.id || selectedAssignment?.id || "draft"}:${index}:${nextSeconds}`,
      secondsLeft: nextSeconds,
      running: false,
    });
    if (!activeSession) return;
    await onUpdateSession(activeSession.id, { ...plan, activeBlockIndex: index }, "in_progress");
  };

  const toggleChecklist = async (item: string) => {
    if (actionsDisabled) return;
    const nextValue = !completedMap[item];
    setLocalCompletion((current) => ({
      key: completionKey,
      tasks: {
        ...(current.key === completionKey ? current.tasks : {}),
        [item]: nextValue,
      },
    }));
    if (!activeSession) return;
    const nextPlan: StudyPlan = {
      ...plan,
      completedTasks: {
        ...completedMap,
        [item]: nextValue,
      },
    };
    try {
      await onUpdateSession(activeSession.id, nextPlan, nextValue ? "in_progress" : activeSession.status || "planned");
      setLocalCompletion((current) => {
        if (current.key !== completionKey) return current;
        const next = { ...current.tasks };
        delete next[item];
        return { key: completionKey, tasks: next };
      });
    } catch {
      setLocalCompletion((current) => ({
        key: completionKey,
        tasks: {
          ...(current.key === completionKey ? current.tasks : {}),
          [item]: !nextValue,
        },
      }));
    }
  };

  const openPlanEditor = () => {
    setBlockDraft({
      name: activeBlock?.name || "",
      minutes: String(activeBlock?.minutes || duration),
      tasks: activeBlockTasksText,
      breakMinutes: activeBlock?.breakMinutes ? String(activeBlock.breakMinutes) : "",
    });
    setChecklistDraft(checklistText);
    setShowPlanEditor(true);
  };

  const savePlanEdits = async () => {
    if (!activeSession || actionsDisabled) return;
    const nextTasks = textLines(blockDraft.tasks);
    const nextChecklist = textLines(checklistDraft);
    const nextBreak = blockDraft.breakMinutes ? clampBreakMinutes(Number(blockDraft.breakMinutes)) : undefined;
    const nextBlocks = plan.blocks.map((block, index) =>
      index === safeActiveBlockIndex
        ? {
            ...block,
            name: blockDraft.name.trim() || block.name,
            minutes: clampMinutes(Number(blockDraft.minutes || block.minutes)),
            tasks: nextTasks.length ? nextTasks : block.tasks,
            breakMinutes: nextBreak,
          }
        : block,
    );
    await onUpdateSession(
      activeSession.id,
      {
        ...plan,
        blocks: nextBlocks,
        checklist: nextChecklist.length ? nextChecklist : checklist,
      },
      activeSession.status || "planned",
    );
    setShowPlanEditor(false);
  };

  const toggleTimer = () => {
    if (actionsDisabled) return;
    if (!running && activeSession) {
      void onUpdateSession(
        activeSession.id,
        {
          ...plan,
          activeBlockIndex: safeActiveBlockIndex,
        },
        "in_progress",
      ).catch(() => undefined);
    }
    setTimerState({ ...timer, running: !running });
  };

  const startFocusTimer = () => {
    if (actionsDisabled) return;
    if (activeSession) {
      void onUpdateSession(
        activeSession.id,
        {
          ...plan,
          activeBlockIndex: safeActiveBlockIndex,
        },
        "in_progress",
      ).catch(() => undefined);
    }
    setFocusStage("focus");
    setTimerState({ ...timer, running: true });
  };

  const openFocusPreview = () => {
    if (actionsDisabled) return;
    setFocusStage("brief");
    setFocusFullscreen(true);
  };

  const resetTimer = () => {
    completedTimerKeys.current.delete(timerKey);
    setTimerState({ key: timerKey, secondsLeft: totalSeconds, running: false });
  };

  const continueAfterBreak = async () => {
    if (isLastBlock) {
      setFocusFullscreen(false);
      setFocusStage("brief");
      return;
    }
    await selectBlock(safeActiveBlockIndex + 1);
    setBreakSecondsLeft(0);
    setFocusStage("brief");
    setMemoryInput([]);
    resetReflection();
  };

  const toggleReflectionItem = (item: string) => {
    setReflectionSelected((current) =>
      current.includes(item) ? current.filter((selected) => selected !== item) : [...current, item],
    );
    setReflectionMessage(null);
  };

  const saveReflection = async () => {
    if (!activeSession || actionsDisabled) return;
    const selectedItems = reflectionSelected.map((item) => cleanPlanText(item, 140)).filter(Boolean);
    const customItems = textLines(reflectionCustomText).map((item) => cleanPlanText(item, 140)).filter(Boolean);
    const finishedItems = Array.from(new Set([...selectedItems, ...customItems]));

    if (!finishedItems.length) {
      setReflectionMessage("Pick one item or add a quick note first.");
      return;
    }

    const nextChecklist = Array.from(new Set([...checklist, ...customItems]));
    const nextCompletedTasks = {
      ...completedMap,
      ...Object.fromEntries(finishedItems.map((item) => [item, true])),
    };
    const nextPlan: StudyPlan = {
      ...plan,
      checklist: nextChecklist.length ? nextChecklist : checklist,
      completedTasks: nextCompletedTasks,
      activeBlockIndex: safeActiveBlockIndex,
    };

    setLocalCompletion((current) => ({
      key: completionKey,
      tasks: {
        ...(current.key === completionKey ? current.tasks : {}),
        ...Object.fromEntries(finishedItems.map((item) => [item, true])),
      },
    }));
    await onUpdateSession(activeSession.id, nextPlan, isLastBlock ? "completed" : "in_progress");
    setReflectionSelected([]);
    setReflectionCustomText("");
    setReflectionMessage(`${finishedItems.length} item${finishedItems.length === 1 ? "" : "s"} saved to your checklist.`);
  };

  const handleMemoryTap = (index: number) => {
    const nextInput = [...memoryInput, index];
    const isCorrect = nextInput.every((value, inputIndex) => value === memoryPattern[inputIndex]);
    if (!isCorrect) {
      setMemoryInput([]);
      return;
    }
    if (nextInput.length === memoryPattern.length) {
      const nextRound = memoryRound + 1;
      setMemoryRound(nextRound);
      setMemoryInput([]);
      setMemoryPattern(buildMemoryPattern(Math.min(6, nextRound + 2)));
      return;
    }
    setMemoryInput(nextInput);
  };

  const updateCustomBlock = (index: number, updates: Partial<CustomBlockDraft>) => {
    setCustomBlocks((current) =>
      current.map((block, blockIndex) => (blockIndex === index ? { ...block, ...updates } : block)),
    );
    setSelectedCustomSessionId(newCustomSessionId);
  };

  const addCustomBlock = () => {
    setCustomBlocks((current) => [...current, createCustomBlockDraft(current.length)].slice(0, 6));
    setSelectedCustomSessionId(newCustomSessionId);
  };

  const removeCustomBlock = (index: number) => {
    setCustomBlocks((current) => {
      const next = current.filter((_, blockIndex) => blockIndex !== index);
      return next.length ? next : [createCustomBlockDraft()];
    });
    setSelectedCustomSessionId(newCustomSessionId);
  };

  const askAboutSession = () => {
    const blockTasks = activeBlock?.tasks?.length ? ` Tasks: ${activeBlock.tasks.map((task) => cleanPlanText(task, 120)).join("; ")}` : "";
    actions.onOpenChat(
      `Help me with this focus session: ${plan.title}. Current block: ${activeBlock?.name || "not selected"}.${blockTasks}`,
    );
  };

  const openDashboard = () => {
    window.location.assign("/dashboard");
  };

  const openFocusInNewTab = () => {
    const url = new URL("/study-sessions", window.location.origin);
    url.searchParams.set("focus", "1");
    url.searchParams.set("block", String(safeActiveBlockIndex));

    if (activeSession) {
      url.searchParams.set("sessionId", activeSession.id);
    } else if (selectedAssignment?.id) {
      url.searchParams.set("assignmentId", selectedAssignment.id);
    } else {
      const draftKey = randomLaunchKey();
      const payload: FocusLaunchPayload = {
        source: sessionSource,
        assignmentId: selectedAssignment?.id || null,
        customSessionId: selectedCustomSession?.id || null,
        plan,
        activeBlockIndex: safeActiveBlockIndex,
        duration,
        createdAt: Date.now(),
      };
      window.localStorage.setItem(focusLaunchStorageKey(draftKey), JSON.stringify(payload));
      url.searchParams.set("draftKey", draftKey);
    }

    const focusWindow = window.open(url.toString(), "_blank", "noopener,noreferrer");
    if (!focusWindow) {
      setFocusStage("brief");
      setFocusFullscreen(true);
    }
  };

  const focusOverlay =
    focusFullscreen && typeof document !== "undefined"
      ? createPortal(
        <div className="fixed inset-0 left-0 top-0 z-[9999] isolate flex h-[100dvh] w-screen overflow-hidden overscroll-contain bg-background text-on-surface">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(205,239,184,0.42),transparent_48%)]" />
          <div className="absolute right-md top-md z-20 flex gap-xs">
            <button
              type="button"
              className="rounded-full border border-primary-fixed-dim bg-white/90 px-sm py-xs font-label-md text-label-md text-primary shadow-sm"
              onClick={openDashboard}
            >
              Dashboard
            </button>
            <button
              type="button"
              className="rounded-full border border-primary-fixed-dim bg-white/90 px-sm py-xs font-label-md text-label-md text-primary shadow-sm"
              onClick={() => setFocusFullscreen(false)}
            >
              Exit
            </button>
          </div>

          {focusStage === "brief" ? (
            <div className="relative z-10 mx-auto flex h-[100dvh] w-full max-w-4xl flex-col justify-center px-lg py-xl">
              <p className="font-label-md text-label-md uppercase tracking-widest text-primary">Before you start</p>
              <h2 className="mt-xs max-w-3xl font-display-md text-display-md text-primary">{plan.title}</h2>
              <p className="mt-sm max-w-3xl font-body-lg text-body-lg text-on-surface-variant">
                This session starts with <strong>{activeBlock?.name || "your first focus block"}</strong>. Aim for progress,
                not perfection.
              </p>

              <div className="mt-lg grid grid-cols-1 gap-md md:grid-cols-2">
                <section className="rounded-lg border-2 border-primary-fixed-dim bg-white/85 p-md">
                  <h3 className="font-headline-sm text-headline-sm">Get done now</h3>
                  <ul className="mt-sm space-y-xs">
                    {(activeBlock?.tasks?.length ? activeBlock.tasks : [plan.nextAction])
                      .slice(0, 4)
                      .map((task) => cleanPlanText(task, 130))
                      .filter(Boolean)
                      .map((task) => (
                      <li key={task} className="flex gap-xs font-body-md text-body-md text-on-surface-variant">
                        <span className="material-symbols-outlined text-[18px] text-primary">check_small</span>
                        <span>{task}</span>
                      </li>
                    ))}
                  </ul>
                </section>
                <section className="rounded-lg border-2 border-surface-variant bg-white/75 p-md">
                  <h3 className="font-headline-sm text-headline-sm">Do later</h3>
                  <ul className="mt-sm space-y-xs">
                    {(laterBlocks.length ? laterBlocks : plan.blocks.slice(1, 3)).map((block) => (
                      <li key={block.name} className="flex gap-xs font-body-md text-body-md text-on-surface-variant">
                        <span className="material-symbols-outlined text-[18px] text-primary">arrow_right</span>
                        <span>
                          {block.name} <span className="text-outline">({block.minutes}m)</span>
                        </span>
                      </li>
                    ))}
                    {!laterBlocks.length && plan.blocks.length <= 1 ? (
                      <li className="font-body-md text-body-md text-on-surface-variant">Wrap up and write the next action.</li>
                    ) : null}
                  </ul>
                </section>
              </div>

              <div className="mt-lg flex flex-wrap gap-sm">
                {selectedAssignment?.htmlUrl ? (
                  <button
                    type="button"
                    className="rounded-full border-2 border-primary-fixed-dim bg-white px-lg py-sm font-label-md text-label-md text-primary"
                    onClick={() => window.open(selectedAssignment.htmlUrl || undefined, "_blank", "noopener,noreferrer")}
                  >
                    Open Canvas brief
                  </button>
                ) : null}
                <button
                  type="button"
                  className="bubbly-button rounded-full bg-primary px-xl py-sm font-bold text-on-primary shadow-lg"
                  onClick={() => setFocusStage("lock")}
                >
                  I am ready
                </button>
              </div>
            </div>
          ) : null}

          {focusStage === "lock" ? (
            <div className="relative z-10 mx-auto flex h-[100dvh] w-full max-w-3xl flex-col items-center justify-center px-lg py-xl text-center">
              <p className="font-label-md text-label-md uppercase tracking-widest text-primary">One last reset</p>
              <h2 className="mt-xs font-display-md text-display-md text-primary">Lock in now</h2>
              <p className="mt-sm w-full max-w-2xl text-balance font-body-lg text-body-lg leading-relaxed text-on-surface-variant">
                Close extra tabs, put your phone out of reach, and keep only the task you need for this block.
              </p>
              <div className="mt-lg grid w-full grid-cols-1 gap-sm sm:grid-cols-3">
                {["One task", "No switching", "Stop when time ends"].map((item) => (
                  <div key={item} className="rounded-full border-2 border-primary-fixed-dim bg-white/80 px-md py-sm font-label-md text-label-md">
                    {item}
                  </div>
                ))}
              </div>
              <div className="mt-lg flex flex-wrap justify-center gap-sm">
                <button
                  type="button"
                  className="rounded-full border-2 border-surface-variant bg-white px-lg py-sm font-label-md text-label-md text-on-surface-variant"
                  onClick={() => setFocusStage("brief")}
                >
                  Back
                </button>
                <button
                  type="button"
                  className="bubbly-button rounded-full bg-primary px-xl py-md font-bold text-on-primary shadow-lg"
                  onClick={startFocusTimer}
                >
                  Lock in
                </button>
              </div>
            </div>
          ) : null}

          {focusStage === "focus" ? (
            <div className="relative z-10 mx-auto flex h-[100dvh] w-full max-w-3xl flex-col items-center justify-center px-lg py-xl text-center">
              <p className="font-label-md text-label-md uppercase tracking-widest text-primary">Focus block</p>
              <p className="mt-md font-display-lg text-[clamp(5rem,16vw,11rem)] leading-none text-primary">
                {minutesToClock(secondsLeft)}
              </p>
              <h2 className="mt-sm max-w-2xl text-balance font-headline-lg text-headline-lg text-on-surface">
                {activeBlock?.name || "Focus time"}
              </h2>
              {activeBlock?.tasks?.[0] ? (
                <p className="mt-sm max-w-2xl font-body-lg text-body-lg text-on-surface-variant">
                  {cleanPlanText(activeBlock.tasks[0], 150)}
                </p>
              ) : null}
              <div className="mt-lg h-2 w-full max-w-xl overflow-hidden rounded-full bg-surface-variant">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, progressRatio * 100)}%` }} />
              </div>
              <div className="mt-lg flex flex-wrap justify-center gap-sm">
                <button
                  type="button"
                  className="bubbly-button rounded-full bg-primary px-xl py-md font-bold text-on-primary shadow-lg"
                  onClick={toggleTimer}
                >
                  {running ? "Pause" : "Resume"}
                </button>
                <button
                  type="button"
                  className="rounded-full border-2 border-surface-variant bg-white px-lg py-sm font-label-md text-label-md text-on-surface-variant"
                  onClick={resetTimer}
                >
                  Reset
                </button>
              </div>
            </div>
          ) : null}

          {focusStage === "break" ? (
            <div className="relative z-10 mx-auto grid h-[100dvh] w-full max-w-6xl grid-cols-1 items-center gap-lg px-lg py-xl lg:grid-cols-[1fr_24rem]">
              <section className="text-center lg:text-left">
                <p className="font-label-md text-label-md uppercase tracking-widest text-primary">
                  {isLastBlock ? "Session complete" : "Break time"}
                </p>
                <h2 className="mt-xs font-display-md text-display-md text-primary">
                  {isLastBlock ? "Nice work. Close the loop." : minutesToClock(breakSecondsLeft)}
                </h2>
                <p className="mt-sm max-w-2xl font-body-lg text-body-lg text-on-surface-variant">
                  {isLastBlock
                    ? cleanPlanText(plan.nextAction, 180) || "Write down what you finished and what comes next."
                    : "Let your brain cool down. Pick one quiet reset, then come back for the next block."}
                </p>

                {isLastBlock ? (
                  <div className="mt-lg inline-flex flex-col rounded-lg border-2 border-primary-fixed-dim bg-white/85 px-lg py-md text-left shadow-sm">
                    <p className="font-label-md text-label-md uppercase tracking-wide text-primary">Session reward</p>
                    <div className="mt-xs flex items-end gap-sm">
                      <span className="font-display-md text-display-md text-primary">+{sessionRewardXp.toLocaleString("en-AU")}</span>
                      <span className="pb-xs font-headline-sm text-headline-sm text-on-surface">XP</span>
                    </div>
                    <p className="mt-xs font-body-md text-body-md text-on-surface-variant">
                      Longer sessions earn more XP, but every finished block protects your momentum.
                    </p>
                  </div>
                ) : null}

                <div className="mt-lg rounded-lg border-2 border-primary-fixed-dim bg-white/90 p-md text-left shadow-sm">
                  <div className="flex items-start justify-between gap-sm">
                    <div>
                      <p className="font-label-md text-label-md uppercase tracking-wide text-primary">Progress check</p>
                      <h3 className="mt-xs font-headline-sm text-headline-sm text-on-surface">What did you get done?</h3>
                    </div>
                    <span className="material-symbols-outlined text-primary">task_alt</span>
                  </div>
                  <div className="mt-sm flex flex-wrap gap-xs">
                    {reflectionCandidates.map((item) => {
                      const selected = reflectionSelected.includes(item);
                      const completed = Boolean(completedMap[item]);
                      return (
                        <button
                          key={item}
                          type="button"
                          className={`rounded-full border-2 px-sm py-xs font-label-md text-label-md transition ${
                            selected || completed
                              ? "border-primary bg-primary-container text-primary"
                              : "border-surface-variant bg-white text-on-surface-variant hover:border-primary-fixed"
                          }`}
                          onClick={() => toggleReflectionItem(item)}
                        >
                          {completed ? "✓ " : selected ? "+ " : ""}
                          {item}
                        </button>
                      );
                    })}
                  </div>
                  <textarea
                    value={reflectionCustomText}
                    onChange={(event) => {
                      setReflectionCustomText(event.target.value);
                      setReflectionMessage(null);
                    }}
                    className="mt-sm min-h-20 w-full resize-none rounded-lg border-2 border-surface-variant bg-white p-sm font-body-md focus:border-primary focus:outline-none"
                    placeholder="Or add what you finished, one item per line..."
                    maxLength={500}
                  />
                  <div className="mt-sm flex flex-wrap items-center gap-sm">
                    <button
                      type="button"
                      className="rounded-full bg-primary px-md py-xs font-label-md text-label-md text-on-primary disabled:opacity-60"
                      onClick={() => void saveReflection()}
                      disabled={actionsDisabled}
                    >
                      Save progress
                    </button>
                    {reflectionMessage ? (
                      <span className="font-label-md text-label-md text-on-surface-variant">{reflectionMessage}</span>
                    ) : null}
                  </div>
                </div>

                {!isLastBlock ? (
                  <div className="mt-lg rounded-lg border-2 border-primary-fixed-dim bg-white/85 p-md">
                    <div className="flex flex-wrap gap-xs">
                      {[
                        ["breathe", "Breathe"],
                        ["memory", "Memory tap"],
                        ["activities", "Ideas"],
                      ].map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          className={`rounded-full px-sm py-xs font-label-md text-label-md ${
                            breakMode === value ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-variant"
                          }`}
                          onClick={() => setBreakMode(value as BreakMode)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    {breakMode === "breathe" ? (
                      <div className="mt-md flex flex-col items-center gap-sm">
                        <div className="h-28 w-28 animate-pulse rounded-full border-8 border-primary-fixed-dim bg-primary-container" />
                        <p className="font-body-md text-body-md text-on-surface-variant">Inhale slowly. Exhale slower.</p>
                      </div>
                    ) : null}

                    {breakMode === "memory" ? (
                      <div className="mt-md">
                        <p className="font-body-md text-body-md text-on-surface-variant">
                          Tap this pattern: {memoryPattern.map((item) => memoryPadLabels[item]).join(" - ")}
                        </p>
                        <div className="mt-sm grid grid-cols-4 gap-sm">
                          {memoryPadLabels.map((label, index) => (
                            <button
                              key={label}
                              type="button"
                              className="rounded-lg border-2 border-primary-fixed-dim bg-primary-container py-md font-bold text-primary active:scale-95"
                              onClick={() => handleMemoryTap(index)}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                        <p className="mt-sm font-label-md text-label-md text-on-surface-variant">
                          Round {memoryRound} - {memoryInput.length}/{memoryPattern.length}
                        </p>
                      </div>
                    ) : null}

                    {breakMode === "activities" ? (
                      <ul className="mt-md space-y-xs">
                        {breakActivities.map((activity) => (
                          <li key={activity} className="flex gap-xs font-body-md text-body-md text-on-surface-variant">
                            <span className="material-symbols-outlined text-[18px] text-primary">spa</span>
                            <span>{activity}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ) : null}
              </section>

              <aside className="rounded-lg border-2 border-surface-variant bg-white/85 p-md">
                <p className="font-label-md text-label-md uppercase text-primary">{isLastBlock ? "After this" : "Next up"}</p>
                <h3 className="mt-xs font-headline-md text-headline-md text-on-surface">
                  {isLastBlock ? "XP saved" : plan.blocks[safeActiveBlockIndex + 1]?.name || "Next block"}
                </h3>
                <p className="mt-sm font-body-md text-body-md text-on-surface-variant">
                  {isLastBlock
                    ? "Your focus analytics will update from completed session time. Check your streak when you are ready."
                    : plan.blocks[safeActiveBlockIndex + 1]?.tasks?.[0] || "Review the next task and keep it small."}
                </p>
                <button
                  type="button"
                  className="mt-md bubbly-button w-full rounded-full bg-primary py-sm font-bold text-on-primary shadow-lg"
                  onClick={() => void continueAfterBreak()}
                >
                  {isLastBlock ? "Exit session" : breakSecondsLeft > 0 ? "Skip break" : "I am ready"}
                </button>
                {isLastBlock ? (
                  <button
                    type="button"
                    className="mt-sm w-full rounded-full border-2 border-primary-fixed-dim bg-white py-xs font-label-md text-label-md text-primary"
                    onClick={() => {
                      setFocusFullscreen(false);
                      setFocusStage("brief");
                      actions.onNavigate("streak");
                    }}
                  >
                    View focus analytics
                  </button>
                ) : null}
              </aside>
            </div>
          ) : null}
        </div>,
        document.body,
      )
      : null;

  return (
    <div className="min-h-screen px-margin-desktop pb-lg flex flex-col">
      {focusOverlay}

      <ViewHeader actions={actions} />

      <div className="max-w-7xl mx-auto w-full flex-grow pb-xl">
        <div className="mb-lg mt-sm">
          <p className="font-label-md text-label-md uppercase tracking-wide text-primary">Focus sessions</p>
          <h1 className="font-display-lg text-display-lg text-primary mb-xs">Pick a task or build your own.</h1>
          <p className="max-w-2xl text-body-lg font-body-lg text-on-surface-variant">
            Use Canvas when you want Sidekick to plan from assignment facts, or make a custom session when you just need a clean timer with your own blocks.
          </p>
        </div>

        <div className="grid grid-cols-12 gap-gutter">
          <div className="col-span-12 lg:col-span-4 space-y-gutter">
            <div className="straight-panel bg-surface-container-lowest p-md rounded-lg border-2 border-primary-fixed-dim">
              <div className="flex items-center gap-sm mb-md">
                <span className="material-symbols-outlined text-primary">route</span>
                <h2 className="font-headline-md text-headline-md">Session source</h2>
              </div>
              <div className="grid grid-cols-2 gap-xs rounded-full bg-surface-container p-1">
                {[
                  ["canvas", "Canvas task"],
                  ["custom", "Custom focus"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={`rounded-full px-sm py-xs font-label-md text-label-md transition-all ${
                      sessionSource === value ? "bg-primary text-on-primary shadow-sm" : "text-on-surface-variant"
                    }`}
                    onClick={() => {
                      setSessionSource(value as SessionSource);
                      setUserContext("");
                      setActiveBlockIndex(0);
                      setShowPlanEditor(false);
                      setTimerState({ key: "", secondsLeft: duration * 60, running: false });
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {sessionSource === "canvas" ? (
                <>
                  <select
                    value={selectedAssignment?.id || ""}
                    onChange={(event) => {
                      onSelectAssignment(event.target.value || null);
                      setUserContext("");
                      setActiveBlockIndex(0);
                      setShowPlanEditor(false);
                      setTimerState({ key: "", secondsLeft: duration * 60, running: false });
                    }}
                    className="mt-md w-full bg-white border-2 border-surface-variant rounded-lg p-sm font-body-md focus:outline-none focus:border-primary"
                  >
                    {assignments.length ? (
                      assignments.map((assignment) => (
                        <option key={assignment.id} value={assignment.id}>
                          {assignment.courseName}: {assignment.name}
                        </option>
                      ))
                    ) : (
                      <option value="">No assignments synced</option>
                    )}
                  </select>

                  {selectedAssignment ? (
                    <div className="mt-md rounded-lg border-2 border-surface-variant bg-white p-sm">
                      <p className="font-label-md text-label-md uppercase text-on-surface-variant">
                        {selectedAssignment.courseName}
                      </p>
                      <h3 className="mt-xs font-headline-sm text-headline-sm text-on-surface">{selectedAssignment.name}</h3>
                      <div className="mt-sm flex flex-wrap gap-xs">
                        <span className="rounded-full bg-primary-container px-sm py-1 font-label-md text-label-md text-primary">
                          {formatDate(selectedAssignment.dueAt)}
                        </span>
                        <span className="rounded-full bg-surface-container px-sm py-1 font-label-md text-label-md text-on-surface-variant">
                          {statusLabel(selectedAssignment)}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="mt-sm bubbly-button w-full rounded-full border-2 border-surface-variant bg-surface-container py-xs font-label-md text-label-md text-on-surface disabled:opacity-60"
                        onClick={() =>
                          onUpdateAssignmentStatus(
                            selectedAssignment.id,
                            isSubmitted(selectedAssignment) ? "open" : "submitted_elsewhere",
                          )
                        }
                        disabled={actionsDisabled}
                        title={actions.disabledReason || undefined}
                      >
                        {isSubmitted(selectedAssignment) ? "Reopen locally" : "Mark done elsewhere"}
                      </button>
                    </div>
                  ) : (
                    <p className="mt-sm font-body-md text-body-md text-on-surface-variant">
                      Sync Canvas first, then choose the assignment you want to work on.
                    </p>
                  )}
                </>
              ) : (
                <div className="mt-md space-y-sm">
                  {customSessions.length ? (
                    <label className="block">
                      <span className="font-label-md text-label-md text-on-surface-variant">Saved custom sessions</span>
                      <select
                        value={selectedCustomSessionId}
                        onChange={(event) => {
                          setSelectedCustomSessionId(event.target.value);
                          setActiveBlockIndex(0);
                          setShowPlanEditor(false);
                          setTimerState({ key: "", secondsLeft: duration * 60, running: false });
                        }}
                        className="mt-xs w-full rounded-lg border-2 border-surface-variant bg-white p-sm font-body-md focus:border-primary focus:outline-none"
                      >
                        <option value={newCustomSessionId}>New custom focus</option>
                        {customSessions.map((session) => (
                          <option key={session.id} value={session.id}>
                            {session.title}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}

                  {selectedCustomSession ? (
                    <div className="rounded-lg border-2 border-primary-fixed-dim bg-primary-container/30 p-sm">
                      <p className="font-label-md text-label-md uppercase text-primary">Saved focus</p>
                      <h3 className="mt-xs font-headline-sm text-headline-sm text-on-surface">{selectedCustomSession.title}</h3>
                      <p className="mt-xs font-body-md text-body-md text-on-surface-variant">
                        {selectedCustomSession.generatedPlanJson.blocks.length} blocks - {selectedCustomSession.durationMinutes} minutes.
                      </p>
                    </div>
                  ) : (
                    <>
                      <label className="block">
                        <span className="font-label-md text-label-md text-on-surface-variant">Focus title</span>
                        <input
                          value={customTitle}
                          onChange={(event) => setCustomTitle(event.target.value)}
                          className="mt-xs w-full rounded-lg border-2 border-surface-variant bg-white p-sm font-body-md focus:border-primary focus:outline-none"
                          placeholder="e.g. Python practice sprint"
                          maxLength={120}
                        />
                      </label>
                      <label className="block">
                        <span className="font-label-md text-label-md text-on-surface-variant">What are you doing?</span>
                        <textarea
                          value={customFocus}
                          onChange={(event) => setCustomFocus(event.target.value)}
                          className="mt-xs min-h-24 w-full resize-y rounded-lg border-2 border-surface-variant bg-white p-sm font-body-md focus:border-primary focus:outline-none"
                          placeholder="One short sentence. Keep it specific."
                          maxLength={900}
                        />
                      </label>
                      <div>
                        <div className="flex items-center justify-between gap-sm">
                          <p className="font-label-md text-label-md text-on-surface-variant">Time blocks</p>
                          <span className="font-label-md text-label-md text-primary">{customDraftPlan.durationMinutes}m total</span>
                        </div>
                        <div className="mt-xs space-y-xs">
                          {customBlocks.map((block, index) => (
                            <div key={index} className="rounded-lg border-2 border-surface-variant bg-white p-sm">
                              <div className="grid grid-cols-[1fr_5.5rem_auto] gap-xs">
                                <input
                                  value={block.name}
                                  onChange={(event) => updateCustomBlock(index, { name: event.target.value })}
                                  className="rounded-md border border-surface-variant bg-white px-sm py-xs font-body-md focus:border-primary focus:outline-none"
                                  placeholder="Block name"
                                  maxLength={80}
                                />
                                <input
                                  type="number"
                                  min={5}
                                  max={240}
                                  value={block.minutes}
                                  onChange={(event) => updateCustomBlock(index, { minutes: event.target.value })}
                                  className="rounded-md border border-surface-variant bg-white px-sm py-xs font-body-md focus:border-primary focus:outline-none"
                                  aria-label={`Minutes for block ${index + 1}`}
                                />
                                <button
                                  type="button"
                                  className="rounded-full border border-surface-variant px-xs text-on-surface-variant disabled:opacity-40"
                                  onClick={() => removeCustomBlock(index)}
                                  disabled={customBlocks.length <= 1}
                                  aria-label={`Remove block ${index + 1}`}
                                >
                                  <span className="material-symbols-outlined text-[18px]">close</span>
                                </button>
                              </div>
                              <textarea
                                value={block.tasks}
                                onChange={(event) => updateCustomBlock(index, { tasks: event.target.value })}
                                className="mt-xs min-h-20 w-full resize-y rounded-md border border-surface-variant bg-white px-sm py-xs font-body-md focus:border-primary focus:outline-none"
                                placeholder="Tasks for this block, one per line"
                                maxLength={1_200}
                              />
                            </div>
                          ))}
                        </div>
                        <button
                          type="button"
                          className="mt-xs rounded-full border-2 border-primary-fixed-dim bg-white px-sm py-xs font-label-md text-label-md text-primary disabled:opacity-50"
                          onClick={addCustomBlock}
                          disabled={customBlocks.length >= 6}
                        >
                          Add block
                        </button>
                      </div>
                      <button
                        type="button"
                        className="bubbly-button flex w-full items-center justify-center gap-sm rounded-full bg-primary py-md font-bold text-on-primary shadow-lg disabled:opacity-60"
                        onClick={generateSession}
                        disabled={isCreatingSession || !customReady || actionsDisabled}
                        title={actions.disabledReason || undefined}
                      >
                        <span className="material-symbols-outlined">add_task</span>
                        {isCreatingSession ? "Saving focus..." : "Create custom session"}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {sessionSource === "canvas" ? (
              <>
                <div className="straight-panel bg-surface-container-lowest p-md rounded-lg border-2 border-primary-fixed-dim">
                  <div className="flex items-start gap-sm">
                    <span className="material-symbols-outlined text-primary">{confidenceDetails.icon}</span>
                    <div>
                      <h2 className="font-headline-md text-headline-md">{confidenceDetails.label}</h2>
                      <p className="mt-xs font-body-md text-body-md text-on-surface-variant">{confidenceDetails.body}</p>
                    </div>
                  </div>
                  <div className="mt-md space-y-xs">
                    {summaryItems.slice(0, 4).map((item) => cleanPlanText(item, 120)).filter(Boolean).map((item) => (
                      <p key={item} className="flex gap-xs font-label-md text-label-md text-on-surface-variant">
                        <span className="material-symbols-outlined text-[18px] text-primary">check_small</span>
                        <span>{item}</span>
                      </p>
                    ))}
                  </div>
                  {needsUserContext ? (
                    <label className="mt-md block">
                      <span className="font-label-md text-label-md text-on-surface-variant">
                        Optional brief for a sharper plan
                      </span>
                      <textarea
                        value={userContext}
                        onChange={(event) => setUserContext(event.target.value)}
                        placeholder="Paste the assignment instructions or write what needs to be done."
                        className="mt-xs min-h-28 w-full resize-y rounded-lg border-2 border-surface-variant bg-white p-sm font-body-md focus:border-primary focus:outline-none"
                      />
                    </label>
                  ) : null}
                </div>

                <div className="straight-panel bg-surface-container-lowest p-md rounded-lg border-2 border-surface-variant">
                  <div className="flex items-center justify-between gap-sm">
                    <h2 className="font-headline-md text-headline-md">Length</h2>
                    <span className="font-label-md text-label-md text-on-surface-variant">{duration} minutes</span>
                  </div>
                  <div className="mt-md grid grid-cols-3 gap-sm">
                    {durationOptions.map((value) => (
                      <button
                        key={value}
                        type="button"
                        className={`rounded-full border-2 px-sm py-sm font-label-md text-label-md transition-all ${
                          duration === value ? "border-primary bg-primary-container text-primary" : "border-surface-variant bg-white"
                        }`}
                        onClick={() => {
                          setDuration(value);
                          setActiveBlockIndex(0);
                          setShowPlanEditor(false);
                          setTimerState({ key: "", secondsLeft: value * 60, running: false });
                        }}
                      >
                        {value}m
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="mt-md bubbly-button flex w-full items-center justify-center gap-sm rounded-full bg-primary py-md font-bold text-on-primary shadow-lg disabled:opacity-60"
                    onClick={generateSession}
                    disabled={isCreatingSession || !selectedAssignment || actionsDisabled}
                    title={actions.disabledReason || undefined}
                  >
                    <span className="material-symbols-outlined">auto_awesome</span>
                    {isCreatingSession ? "Building plan..." : activeSession ? "Regenerate plan" : "Create plan"}
                  </button>
                </div>
              </>
            ) : null}
          </div>

          <div className="col-span-12 lg:col-span-8 space-y-gutter">
            <div className="straight-panel border-2 border-outline-variant bg-surface-container-low p-lg bubbly-shadow">
              <div className="flex flex-col gap-md md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="font-label-md text-label-md uppercase tracking-wide text-primary">
                    {activeSession ? (sessionSource === "custom" ? "Focus plan ready" : "AI plan ready") : "Draft preview"}
                  </p>
                  <h2 className="mt-xs font-display-md text-display-md text-primary">{plan.title}</h2>
                  <p className="mt-sm max-w-3xl font-body-lg text-body-lg text-on-surface-variant">
                    {planSummary}
                  </p>
                  {needsUserContext ? (
                    <p className="mt-sm rounded-full border border-secondary-fixed-dim bg-secondary-container/30 px-sm py-xs font-label-md text-label-md text-secondary">
                      Need more context? Upload the brief in AI Chat or paste a short note on the left, then regenerate.
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-sm md:justify-end">
                  {selectedAssignment?.htmlUrl ? (
                    <button
                      type="button"
                      className="bubbly-button rounded-full border-2 border-primary-fixed-dim bg-white px-md py-sm font-label-md text-label-md text-on-surface"
                      onClick={() => window.open(selectedAssignment.htmlUrl || undefined, "_blank", "noopener,noreferrer")}
                    >
                      Open Canvas brief
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="bubbly-button rounded-full border-2 border-secondary-fixed-dim bg-white px-md py-sm font-label-md text-label-md text-secondary"
                    onClick={askAboutSession}
                  >
                    Ask Sidekick
                  </button>
                </div>
              </div>

              <div className="mt-lg grid grid-cols-1 gap-md lg:grid-cols-2">
                <section className="rounded-lg border-2 border-surface-variant bg-white p-md">
                  <h3 className="font-headline-sm text-headline-sm text-on-surface">What to produce</h3>
                  <ul className="mt-sm space-y-xs">
                    {deliverables.slice(0, 5).map((item) => (
                      <li key={item} className="flex gap-xs font-body-md text-body-md text-on-surface-variant">
                        <span className="material-symbols-outlined text-[18px] text-primary">check_small</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </section>
                <section className="rounded-lg border-2 border-surface-variant bg-white p-md">
                  <h3 className="font-headline-sm text-headline-sm text-on-surface">What matters most</h3>
                  <ul className="mt-sm space-y-xs">
                    {(whatMatters.length ? whatMatters : ["Start with the first concrete deliverable."]).map((item) => (
                      <li key={item} className="flex gap-xs font-body-md text-body-md text-on-surface-variant">
                        <span className="material-symbols-outlined text-[18px] text-primary">arrow_right</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>

              {resourcePlan.length ? (
                <section className="mt-md rounded-lg border-2 border-surface-variant bg-white p-md">
                  <h3 className="font-headline-sm text-headline-sm text-on-surface">Useful resources</h3>
                  <div className="mt-sm grid grid-cols-1 gap-sm md:grid-cols-2">
                    {resourcePlan.map((resource) => (
                      <button
                        key={`${resource.title}-${resource.url || resource.reason}`}
                        type="button"
                        className="rounded-lg border border-surface-variant bg-surface-container-lowest p-sm text-left transition-all hover:border-primary active:scale-[0.99]"
                        onClick={() => {
                          if (resource.url) window.open(resource.url, "_blank", "noopener,noreferrer");
                        }}
                      >
                        <p className="font-label-lg text-label-lg font-bold text-primary">{resource.title}</p>
                        <p className="mt-xs font-body-sm text-body-sm text-on-surface-variant">{resource.reason}</p>
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}

              <div className="mt-lg">
                <div className="flex items-center justify-between gap-sm">
                  <h3 className="font-headline-md text-headline-md text-on-surface">Work blocks</h3>
                  <button
                    type="button"
                    className="rounded-full border-2 border-primary-fixed-dim bg-white px-sm py-xs font-label-md text-label-md text-primary disabled:opacity-50"
                    onClick={() => (showPlanEditor ? setShowPlanEditor(false) : openPlanEditor())}
                    disabled={!activeSession || actionsDisabled}
                    title={actions.disabledReason || undefined}
                  >
                    {showPlanEditor ? "Close edit" : "Edit selected block"}
                  </button>
                </div>
                <div className="mt-sm space-y-sm">
                  {plan.blocks.slice(0, 5).map((block, index) => (
                    <button
                      key={`${block.name}-${index}`}
                      type="button"
                      className={`w-full rounded-lg border-2 p-md text-left transition-all ${
                        index === safeActiveBlockIndex ? "border-primary bg-primary-container" : "border-surface-variant bg-white"
                      }`}
                      onClick={() => selectBlock(index)}
                    >
                      <div className="flex items-start gap-md">
                        <span className="min-w-14 rounded-full bg-white px-sm py-1 text-center font-bold text-primary">
                          {block.minutes}m
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-headline-sm text-headline-sm text-on-surface">{block.name}</p>
                          <p className="mt-xs font-body-md text-body-md text-on-surface-variant">
                            {cleanPlanText(block.tasks[0] || block.goal, 150) || "Focus task"}
                          </p>
                          {block.breakMinutes ? (
                            <p className="mt-xs font-label-md text-label-md text-secondary">
                              Break after this: {block.breakMinutes} minutes
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                {showPlanEditor && activeSession ? (
                  <div className="mt-sm rounded-lg border-2 border-primary-fixed-dim bg-white p-md">
                    <div className="grid grid-cols-1 gap-sm md:grid-cols-4">
                      <label className="block md:col-span-3">
                        <span className="font-label-md text-label-md text-on-surface-variant">Block name</span>
                        <input
                          value={blockDraft.name}
                          onChange={(event) => setBlockDraft((current) => ({ ...current, name: event.target.value }))}
                          className="mt-xs w-full rounded-lg border-2 border-surface-variant bg-white p-sm font-body-md focus:border-primary focus:outline-none"
                        />
                      </label>
                      <label className="block">
                        <span className="font-label-md text-label-md text-on-surface-variant">Minutes</span>
                        <input
                          type="number"
                          min={5}
                          max={240}
                          value={blockDraft.minutes}
                          onChange={(event) => setBlockDraft((current) => ({ ...current, minutes: event.target.value }))}
                          className="mt-xs w-full rounded-lg border-2 border-surface-variant bg-white p-sm font-body-md focus:border-primary focus:outline-none"
                        />
                      </label>
                    </div>
                    <div className="mt-sm grid grid-cols-1 gap-sm md:grid-cols-4">
                      <label className="block md:col-span-3">
                        <span className="font-label-md text-label-md text-on-surface-variant">Tasks</span>
                        <textarea
                          value={blockDraft.tasks}
                          onChange={(event) => setBlockDraft((current) => ({ ...current, tasks: event.target.value }))}
                          className="mt-xs min-h-28 w-full resize-y rounded-lg border-2 border-surface-variant bg-white p-sm font-body-md focus:border-primary focus:outline-none"
                          placeholder="One task per line"
                        />
                      </label>
                      <label className="block">
                        <span className="font-label-md text-label-md text-on-surface-variant">Break</span>
                        <input
                          type="number"
                          min={0}
                          max={60}
                          value={blockDraft.breakMinutes}
                          onChange={(event) => setBlockDraft((current) => ({ ...current, breakMinutes: event.target.value }))}
                          className="mt-xs w-full rounded-lg border-2 border-surface-variant bg-white p-sm font-body-md focus:border-primary focus:outline-none"
                          placeholder="Optional"
                        />
                      </label>
                    </div>
                    <label className="mt-sm block">
                      <span className="font-label-md text-label-md text-on-surface-variant">Checklist</span>
                      <textarea
                        value={checklistDraft}
                        onChange={(event) => setChecklistDraft(event.target.value)}
                        className="mt-xs min-h-24 w-full resize-y rounded-lg border-2 border-surface-variant bg-white p-sm font-body-md focus:border-primary focus:outline-none"
                        placeholder="One milestone per line"
                      />
                    </label>
                    <button
                      type="button"
                      className="mt-sm bubbly-button flex w-full items-center justify-center gap-sm rounded-full bg-primary py-sm font-bold text-on-primary disabled:opacity-60"
                      onClick={savePlanEdits}
                      disabled={actionsDisabled}
                      title={actions.disabledReason || undefined}
                    >
                      <span className="material-symbols-outlined">save</span>
                      Save edits
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="mt-lg grid grid-cols-1 gap-md lg:grid-cols-[1fr_18rem]">
                <section className="rounded-lg border-2 border-surface-variant bg-white p-md">
                  <div className="flex items-center justify-between gap-sm">
                    <h3 className="font-headline-sm text-headline-sm text-on-surface">Checklist</h3>
                    <span className="rounded-full bg-primary px-sm py-1 font-label-md text-label-md text-on-primary">
                      {completedCount}/{checklist.length}
                    </span>
                  </div>
                  <div className="mt-sm space-y-xs">
                    {checklist.map((item) => (
                      <button
                        key={item}
                        type="button"
                        className="flex w-full items-center gap-sm rounded-lg border-2 border-transparent bg-surface-container-lowest p-sm text-left transition-all hover:border-primary-fixed"
                        onClick={() => toggleChecklist(item)}
                        disabled={actionsDisabled}
                        title={actions.disabledReason || undefined}
                      >
                        <span
                          className={`flex h-6 w-6 items-center justify-center rounded-md border-2 ${
                            completedMap[item] ? "border-primary bg-primary text-on-primary" : "border-outline"
                          }`}
                        >
                          {completedMap[item] ? <span className="material-symbols-outlined text-[18px]">check</span> : null}
                        </span>
                        <span className="font-body-md text-body-md text-on-surface">{item}</span>
                      </button>
                    ))}
                  </div>
                </section>

                <section className="rounded-lg border-2 border-primary-fixed-dim bg-primary-container/30 p-md">
                  <p className="font-label-md text-label-md uppercase text-primary">Current block</p>
                  <h3 className="mt-xs font-headline-md text-headline-md text-on-surface">
                    {activeBlock?.name || "Focus time"}
                  </h3>
                  <p className="mt-xs font-display-md text-display-md text-primary">{minutesToClock(secondsLeft)}</p>
                  <div className="mt-md flex flex-col gap-sm">
                    <button
                      type="button"
                      className="bubbly-button flex w-full items-center justify-center gap-sm rounded-full bg-primary py-md font-bold text-on-primary shadow-lg"
                      onClick={openFocusPreview}
                      disabled={actionsDisabled}
                      title={actions.disabledReason || undefined}
                    >
                      <span className="material-symbols-outlined">play_circle</span>
                      Start session
                    </button>
                    <button
                      type="button"
                      className="bubbly-button flex w-full items-center justify-center gap-sm rounded-full border-2 border-primary-fixed-dim bg-white py-sm font-label-md text-label-md text-primary"
                      onClick={openFocusInNewTab}
                      disabled={actionsDisabled}
                      title={actions.disabledReason || undefined}
                    >
                      <span className="material-symbols-outlined">open_in_new</span>
                      Open focus tab
                    </button>
                    <button
                      type="button"
                      className="rounded-full border-2 border-surface-variant bg-white py-xs font-label-md text-label-md text-on-surface-variant"
                      onClick={resetTimer}
                    >
                      Reset
                    </button>
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
