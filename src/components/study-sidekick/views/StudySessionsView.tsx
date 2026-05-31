"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ViewHeader from "../components/ViewHeader";
import type {
  AssignmentSummary,
  CreateStudySessionInput,
  StudyPlan,
  StudySessionRecord,
  StudySessionUpdateInput,
  StudySidekickActions,
} from "../types";
import { compactText, formatDate, isSubmitted, riskForAssignment, statusLabel } from "../lib/client-utils";

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

type FocusStage = "brief" | "lock" | "focus" | "break";
type BreakMode = "breathe" | "memory" | "activities";

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

function minutesToClock(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const rest = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${rest}`;
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

function fallbackPlan(assignment?: AssignmentSummary | null, duration = defaultDuration): StudyPlan {
  const title = assignment ? `${assignment.name} Sprint` : "Study Session";
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
    assignmentBrief: assignment?.description || "Choose an assignment, add a short brief if needed, then generate a plan.",
    rubricFocus: assignment?.rubricSummary ? [assignment.rubricSummary] : [],
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
  const [duration, setDuration] = useState(defaultDuration);
  const [userContext, setUserContext] = useState("");
  const [activeBlockIndex, setActiveBlockIndex] = useState(0);
  const [showPlanEditor, setShowPlanEditor] = useState(false);
  const [focusFullscreen, setFocusFullscreen] = useState(false);
  const [focusStage, setFocusStage] = useState<FocusStage>("brief");
  const [breakMode, setBreakMode] = useState<BreakMode>("breathe");
  const [breakSecondsLeft, setBreakSecondsLeft] = useState(0);
  const [memoryRound, setMemoryRound] = useState(1);
  const [memoryPattern, setMemoryPattern] = useState(() => buildMemoryPattern());
  const [memoryInput, setMemoryInput] = useState<number[]>([]);
  const [timerState, setTimerState] = useState({ key: "", secondsLeft: defaultDuration * 60, running: false });
  const [blockDraft, setBlockDraft] = useState({ name: "", minutes: "25", tasks: "", breakMinutes: "" });
  const [checklistDraft, setChecklistDraft] = useState("");
  const completedTimerKeys = useRef(new Set<string>());

  const selectedAssignment =
    assignments.find((assignment) => assignment.id === selectedAssignmentId) || assignments[0] || null;
  const activeSession =
    sessions.find((session) => session.assignmentId && session.assignmentId === selectedAssignment?.id) || null;
  const plan = activeSession?.generatedPlanJson || fallbackPlan(selectedAssignment, duration);
  const confidence = contextConfidenceForAssignment(selectedAssignment, plan);
  const confidenceDetails = confidenceCopy(confidence);
  const needsUserContext = plan.needsUserContext || confidence === "low";
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
  const completedMap = plan.completedTasks || {};
  const checklist = plan.checklist || [];
  const completedCount = checklist.filter((item) => completedMap[item]).length;
  const progressRatio = totalSeconds ? (totalSeconds - secondsLeft) / totalSeconds : 0;
  const activeBlockTasksText = (activeBlock?.tasks || []).join("\n");
  const checklistText = checklist.join("\n");
  const actionsDisabled = Boolean(actions.isBusy);
  const summaryItems = plan.contextSummary?.length
    ? plan.contextSummary
    : [
        selectedAssignment?.description ? "Canvas assignment description found." : "Canvas assignment description is missing.",
        selectedAssignment?.rubricSummary ? "Rubric summary found." : "Rubric summary is missing.",
      ];
  const whatMatters = [
    ...(plan.rubricFocus || []),
    ...(plan.riskWarning ? [plan.riskWarning] : []),
    plan.nextAction,
  ].filter(Boolean).slice(0, 4);
  const laterBlocks = plan.blocks.slice(safeActiveBlockIndex + 1, safeActiveBlockIndex + 4);

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
    if (!activeSession || actionsDisabled) return;
    const nextPlan: StudyPlan = {
      ...plan,
      completedTasks: {
        ...completedMap,
        [item]: !completedMap[item],
      },
    };
    await onUpdateSession(activeSession.id, nextPlan, completedMap[item] ? "planned" : "in_progress");
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
    if (actionsDisabled || !activeSession) return;
    void onUpdateSession(
      activeSession.id,
      {
        ...plan,
        activeBlockIndex: safeActiveBlockIndex,
      },
      "in_progress",
    ).catch(() => undefined);
    setFocusStage("focus");
    setTimerState({ ...timer, running: true });
  };

  const openFocusPreview = () => {
    if (!activeSession || actionsDisabled) return;
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

  const askAboutSession = () => {
    const blockTasks = activeBlock?.tasks?.length ? ` Tasks: ${activeBlock.tasks.join("; ")}` : "";
    actions.onOpenChat(
      `Help me with this focus session: ${plan.title}. Current block: ${activeBlock?.name || "not selected"}.${blockTasks}`,
    );
  };

  return (
    <div className="min-h-screen px-margin-desktop pb-lg flex flex-col">
      {focusFullscreen ? (
        <div className="fixed inset-0 z-50 flex min-h-[100dvh] overflow-hidden bg-background text-on-surface">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(205,239,184,0.42),transparent_48%)]" />
          <button
            type="button"
            className="absolute right-md top-md z-10 rounded-full border border-primary-fixed-dim bg-white/90 px-sm py-xs font-label-md text-label-md text-primary"
            onClick={() => setFocusFullscreen(false)}
          >
            Exit
          </button>

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
                    {(activeBlock?.tasks?.length ? activeBlock.tasks : [plan.nextAction]).slice(0, 4).map((task) => (
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
            <div className="relative z-10 mx-auto flex h-[100dvh] w-full max-w-2xl flex-col items-center justify-center px-lg py-xl text-center">
              <p className="font-label-md text-label-md uppercase tracking-widest text-primary">One last reset</p>
              <h2 className="mt-xs font-display-md text-display-md text-primary">Lock in now</h2>
              <p className="mt-sm max-w-xl font-body-lg text-body-lg text-on-surface-variant">
                Close extra tabs, put your phone out of reach, and keep only the task you need for this block.
              </p>
              <div className="mt-lg grid w-full grid-cols-1 gap-sm sm:grid-cols-3">
                {["One task", "No switching", "Stop when time ends"].map((item) => (
                  <div key={item} className="rounded-lg border-2 border-primary-fixed-dim bg-white/80 p-sm font-label-md text-label-md">
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
                <p className="mt-sm max-w-2xl font-body-lg text-body-lg text-on-surface-variant">{activeBlock.tasks[0]}</p>
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
                    ? plan.nextAction || "Write down what you finished and what comes next."
                    : "Let your brain cool down. Pick one quiet reset, then come back for the next block."}
                </p>

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
                  {isLastBlock ? "Save the win" : plan.blocks[safeActiveBlockIndex + 1]?.name || "Next block"}
                </h3>
                <p className="mt-sm font-body-md text-body-md text-on-surface-variant">
                  {isLastBlock
                    ? "Mark anything finished, then decide the next smallest task."
                    : plan.blocks[safeActiveBlockIndex + 1]?.tasks?.[0] || "Review the next task and keep it small."}
                </p>
                <button
                  type="button"
                  className="mt-md bubbly-button w-full rounded-full bg-primary py-sm font-bold text-on-primary shadow-lg"
                  onClick={() => void continueAfterBreak()}
                >
                  {isLastBlock ? "Exit session" : breakSecondsLeft > 0 ? "Skip break" : "I am ready"}
                </button>
              </aside>
            </div>
          ) : null}
        </div>
      ) : null}

      <ViewHeader actions={actions} />

      <div className="max-w-7xl mx-auto w-full flex-grow pb-xl">
        <div className="mb-lg mt-sm">
          <p className="font-label-md text-label-md uppercase tracking-wide text-primary">Assignment to session</p>
          <h1 className="font-display-lg text-display-lg text-primary mb-xs">Pick the task. Get the plan. Start.</h1>
          <p className="max-w-2xl text-body-lg font-body-lg text-on-surface-variant">
            Sidekick reads Canvas facts first, asks for extra context only when the assignment is too thin, then turns the work into a simple timer-ready session.
          </p>
        </div>

        <div className="grid grid-cols-12 gap-gutter">
          <div className="col-span-12 lg:col-span-4 space-y-gutter">
            <div className="straight-panel bg-surface-container-lowest p-md rounded-lg border-2 border-primary-fixed-dim">
              <div className="flex items-center gap-sm mb-md">
                <span className="material-symbols-outlined text-primary">assignment</span>
                <h2 className="font-headline-md text-headline-md">Choose assignment</h2>
              </div>
              <select
                value={selectedAssignment?.id || ""}
                onChange={(event) => {
                  onSelectAssignment(event.target.value || null);
                  setUserContext("");
                  setActiveBlockIndex(0);
                  setShowPlanEditor(false);
                  setTimerState({ key: "", secondsLeft: duration * 60, running: false });
                }}
                className="w-full bg-white border-2 border-surface-variant rounded-lg p-sm font-body-md focus:outline-none focus:border-primary"
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
            </div>

            <div className="straight-panel bg-surface-container-lowest p-md rounded-lg border-2 border-primary-fixed-dim">
              <div className="flex items-start gap-sm">
                <span className="material-symbols-outlined text-primary">{confidenceDetails.icon}</span>
                <div>
                  <h2 className="font-headline-md text-headline-md">{confidenceDetails.label}</h2>
                  <p className="mt-xs font-body-md text-body-md text-on-surface-variant">{confidenceDetails.body}</p>
                </div>
              </div>
              <div className="mt-md space-y-xs">
                {summaryItems.slice(0, 4).map((item) => (
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
          </div>

          <div className="col-span-12 lg:col-span-8 space-y-gutter">
            <div className="straight-panel border-2 border-outline-variant bg-surface-container-low p-lg bubbly-shadow">
              <div className="flex flex-col gap-md md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="font-label-md text-label-md uppercase tracking-wide text-primary">
                    {activeSession ? "AI plan ready" : "Draft preview"}
                  </p>
                  <h2 className="mt-xs font-display-md text-display-md text-primary">{plan.title}</h2>
                  <p className="mt-sm max-w-3xl font-body-lg text-body-lg text-on-surface-variant">
                    {compactText(plan.assignmentBrief || selectedAssignment?.description, "Generate a plan to pull Canvas context into this session.")}
                  </p>
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
                  <h3 className="font-headline-sm text-headline-sm text-on-surface">What this is asking</h3>
                  <p className="mt-sm font-body-md text-body-md text-on-surface-variant">
                    {compactText(plan.assignmentBrief || selectedAssignment?.description, "The synced Canvas task is thin. Add a short brief to make the plan more specific.")}
                  </p>
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
                            {block.tasks[0] || block.goal || "Focus task"}
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
                        disabled={!activeSession || actionsDisabled}
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
                      disabled={!activeSession || actionsDisabled}
                      title={actions.disabledReason || undefined}
                    >
                      <span className="material-symbols-outlined">play_circle</span>
                      Start session
                    </button>
                    <button
                      type="button"
                      className="bubbly-button flex w-full items-center justify-center gap-sm rounded-full border-2 border-primary-fixed-dim bg-white py-sm font-label-md text-label-md text-primary"
                      onClick={openFocusPreview}
                      disabled={!activeSession || actionsDisabled}
                      title={actions.disabledReason || undefined}
                    >
                      <span className="material-symbols-outlined">fullscreen</span>
                      Preview focus mode
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
