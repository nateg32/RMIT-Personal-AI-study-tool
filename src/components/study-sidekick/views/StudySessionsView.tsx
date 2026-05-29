"use client";

import { useEffect, useMemo, useState } from "react";
import ViewHeader from "../components/ViewHeader";
import type {
  AssignmentSummary,
  CreateStudySessionInput,
  StudyPlan,
  StudySessionRecord,
  StudySessionUpdateInput,
  StudySidekickActions,
} from "../types";
import { compactText, estimateEffort, formatDate, isSubmitted, riskForAssignment, statusLabel } from "../lib/client-utils";

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

const durations = [25, 50, 90, 120];
const energyLevels = ["Low", "Medium", "High"];
const modes = ["Understand task", "Plan assignment", "Write draft", "Final review", "Emergency mode"];
const outcomes = ["Just complete", "Credit", "Distinction", "HD"];
const SESSION_PREFS_KEY = "study-sidekick-session-preferences-v1";
type SessionMode = "canvas" | "custom";

const defaultSessionPreferences = {
  duration: 50,
  energyLevel: "Medium",
  mode: "Plan assignment",
  targetOutcome: "Credit",
};

function clampMinutes(value: number) {
  return Math.max(15, Math.min(480, Number.isFinite(value) ? Math.round(value) : defaultSessionPreferences.duration));
}

function clampBreakMinutes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return undefined;
  return Math.max(1, Math.min(60, Math.round(value)));
}

function loadSessionPreferences() {
  if (typeof window === "undefined") return defaultSessionPreferences;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SESSION_PREFS_KEY) || "{}") as Partial<typeof defaultSessionPreferences>;
    return {
      duration: clampMinutes(Number(parsed.duration || defaultSessionPreferences.duration)),
      energyLevel: energyLevels.includes(parsed.energyLevel || "") ? parsed.energyLevel! : defaultSessionPreferences.energyLevel,
      mode: modes.includes(parsed.mode || "") ? parsed.mode! : defaultSessionPreferences.mode,
      targetOutcome: outcomes.includes(parsed.targetOutcome || "") ? parsed.targetOutcome! : defaultSessionPreferences.targetOutcome,
    };
  } catch {
    return defaultSessionPreferences;
  }
}

function textLines(value: string) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function fallbackPlan(assignment?: AssignmentSummary | null, duration = 50): StudyPlan {
  const title = assignment ? `${assignment.name} Battle Plan` : "Canvas Study Session";
  return {
    title,
    durationMinutes: duration,
    riskLevel: assignment ? riskForAssignment(assignment) : "low",
    assignmentBrief: assignment?.description || "Choose an assignment and generate a Canvas-specific plan.",
    blocks: [
      {
        name: "Understand the task",
        minutes: Math.max(10, Math.round(duration * 0.25)),
        tasks: ["Open Canvas brief", "Identify deliverables", "Rewrite the marking criteria in plain English"],
      },
      {
        name: "Build the work plan",
        minutes: Math.max(15, Math.round(duration * 0.45)),
        tasks: ["Create headings", "Match each heading to rubric criteria", "List the evidence or files to use"],
      },
      {
        name: "Submit a progress checkpoint",
        minutes: Math.max(10, Math.round(duration * 0.3)),
        tasks: ["Write the next action", "Check blockers", "Save your working file"],
      },
    ],
    checklist: ["Canvas brief opened", "Rubric checked", "Next action written"],
    definitionOfDone: ["You know what to submit", "You know where the supporting files are", "The next step is small enough to start"],
    resourcesToOpen: assignment?.htmlUrl ? [{ title: "Open assignment in Canvas", url: assignment.htmlUrl }] : [],
    nextAction: assignment ? `Open ${assignment.name} in Canvas and scan the rubric.` : "Pick an assignment.",
  };
}

function minutesToClock(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const rest = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${rest}`;
}

export default function StudySessionsView({
  assignments,
  sessions,
  selectedAssignmentId,
  onSelectAssignment,
  onCreateSession,
  onUpdateSession,
  onUpdateSessionMeta,
  onUpdateAssignmentStatus,
  isCreatingSession,
  actions,
}: StudySessionsViewProps) {
  const [search, setSearch] = useState("");
  const [initialPreferences] = useState(() => loadSessionPreferences());
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [sessionTitle, setSessionTitle] = useState<string | null>(null);
  const [activeBlockIndex, setActiveBlockIndex] = useState(0);
  const [sessionMode, setSessionMode] = useState<SessionMode>("canvas");
  const [duration, setDuration] = useState(initialPreferences.duration);
  const [energyLevel, setEnergyLevel] = useState(initialPreferences.energyLevel);
  const [mode, setMode] = useState(initialPreferences.mode);
  const [targetOutcome, setTargetOutcome] = useState(initialPreferences.targetOutcome);
  const [customTitle, setCustomTitle] = useState("");
  const [customFocus, setCustomFocus] = useState("");
  const [timerState, setTimerState] = useState({ key: "", secondsLeft: 50 * 60, running: false });
  const [sessionUploadFile, setSessionUploadFile] = useState<File | null>(null);
  const [sessionUploadNotes, setSessionUploadNotes] = useState("");
  const [isUploadingMaterial, setIsUploadingMaterial] = useState(false);
  const [showSetupOptions, setShowSetupOptions] = useState(false);
  const [showPlanEditor, setShowPlanEditor] = useState(false);
  const [focusFullscreen, setFocusFullscreen] = useState(false);
  const [blockDraft, setBlockDraft] = useState({ name: "", minutes: "25", tasks: "", breakMinutes: "" });
  const [checklistDraft, setChecklistDraft] = useState("");

  const selectedSession = selectedSessionId ? sessions.find((session) => session.id === selectedSessionId) || null : null;
  const assignmentFromSession = selectedSession?.assignmentId
    ? assignments.find((assignment) => assignment.id === selectedSession.assignmentId) || null
    : null;
  const selectedAssignment =
    sessionMode === "custom" && !assignmentFromSession
      ? null
      : assignments.find((assignment) => assignment.id === selectedAssignmentId) || assignmentFromSession || assignments[0] || null;
  const activeSession =
    selectedSession ||
    sessions.find((session) => session.assignmentId && session.assignmentId === selectedAssignment?.id) ||
    (sessionMode === "custom" ? sessions.find((session) => !session.assignmentId) || null : null) ||
    null;
  const plan = activeSession?.generatedPlanJson || fallbackPlan(selectedAssignment, duration);
  const safeActiveBlockIndex = Math.min(activeBlockIndex, Math.max(0, plan.blocks.length - 1));
  const activeBlock = plan.blocks[safeActiveBlockIndex] || plan.blocks[0];
  const totalSeconds = Math.max(60, (activeBlock?.minutes || duration) * 60);
  const timerKey = `${activeSession?.id || selectedAssignment?.id || "draft"}:${safeActiveBlockIndex}:${totalSeconds}`;
  const timer = useMemo(
    () => (timerState.key === timerKey ? timerState : { key: timerKey, secondsLeft: totalSeconds, running: false }),
    [timerKey, timerState, totalSeconds],
  );
  const { secondsLeft, running } = timer;

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

  const filteredAssignments = useMemo(() => {
    const query = search.trim().toLowerCase();
    return assignments.filter((assignment) =>
      query ? `${assignment.name} ${assignment.courseName}`.toLowerCase().includes(query) : true,
    );
  }, [assignments, search]);

  const completedMap = plan.completedTasks || {};
  const checklist = plan.checklist || [];
  const completedCount = checklist.filter((item) => completedMap[item]).length;
  const progressRatio = totalSeconds ? (totalSeconds - secondsLeft) / totalSeconds : 0;
  const progress = Math.round(progressRatio * 691);
  const focusProgress = Math.round(progressRatio * 1131);
  const activeBlockTasksText = (activeBlock?.tasks || []).join("\n");
  const checklistText = checklist.join("\n");

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      SESSION_PREFS_KEY,
      JSON.stringify({ duration, energyLevel, mode, targetOutcome }),
    );
  }, [duration, energyLevel, mode, targetOutcome]);

  const generateSession = () => {
    if (sessionMode === "custom") {
      if (!customTitle.trim() && !customFocus.trim()) {
        actions.onOpenChat("Help me choose a clear focus for a custom study session.");
        return;
      }
      onCreateSession({
        assignmentId: null,
        customTitle: customTitle.trim() || "Custom focus session",
        customFocus: customFocus.trim() || undefined,
        durationMinutes: duration,
        mode,
        energyLevel,
        targetOutcome,
      });
      return;
    }

    if (!selectedAssignment) {
      actions.onOpenChat("I need to connect Canvas before creating a study session.");
      return;
    }
    onCreateSession({
      assignmentId: selectedAssignment.id,
      durationMinutes: duration,
      mode,
      energyLevel,
      targetOutcome,
    });
  };

  const uploadSessionMaterial = async () => {
    if (!actions.onUploadMaterial || isUploadingMaterial) return;
    setIsUploadingMaterial(true);
    try {
      await actions.onUploadMaterial({
        file: sessionUploadFile,
        notes: sessionUploadNotes,
        title: sessionMode === "custom" ? customTitle || "Custom focus material" : undefined,
        assignmentId: sessionMode === "canvas" ? selectedAssignment?.id : undefined,
        courseId: sessionMode === "canvas" ? selectedAssignment?.courseId : undefined,
      });
      setSessionUploadFile(null);
      setSessionUploadNotes("");
    } finally {
      setIsUploadingMaterial(false);
    }
  };

  const saveSessionDetails = async () => {
    if (!activeSession) return;
    await onUpdateSessionMeta(activeSession.id, {
      assignmentId: selectedAssignment?.id || null,
      title: (sessionTitle ?? activeSession.title).trim() || plan.title,
      durationMinutes: duration,
      mode,
      energyLevel,
      targetOutcome,
    });
  };

  const selectSession = (sessionId: string) => {
    const session = sessions.find((item) => item.id === sessionId) || null;
    setShowPlanEditor(false);
    setSelectedSessionId(session?.id || null);
    if (!session) {
      setSessionTitle(null);
      setActiveBlockIndex(0);
      return;
    }
    setDuration(session.durationMinutes || 50);
    setEnergyLevel(session.energyLevel || "Medium");
    setMode(session.mode || "Plan assignment");
    setTargetOutcome(session.targetOutcome || "Credit");
    setSessionTitle(session.title);
    setActiveBlockIndex(session.generatedPlanJson.activeBlockIndex || 0);
    if (session.assignmentId) {
      setSessionMode("canvas");
      onSelectAssignment(session.assignmentId);
    } else {
      setSessionMode("custom");
      onSelectAssignment(null);
      setCustomTitle(session.title);
      setCustomFocus(session.generatedPlanJson.assignmentBrief || "");
    }
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
    if (!activeSession) return;
    const nextPlan: StudyPlan = {
      ...plan,
      completedTasks: {
        ...completedMap,
        [item]: !completedMap[item],
      },
    };
    await onUpdateSession(activeSession.id, nextPlan, completedMap[item] ? "planned" : "in_progress");
  };

  const askAboutSession = () => {
    const blockTasks = activeBlock?.tasks?.length ? ` Tasks: ${activeBlock.tasks.join("; ")}` : "";
    actions.onOpenChat(
      `Help me with this focus session: ${plan.title}. Current block: ${activeBlock?.name || "not selected"}.${blockTasks}`,
    );
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
    if (!activeSession) return;
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
    const nextPlan: StudyPlan = {
      ...plan,
      blocks: nextBlocks,
      checklist: nextChecklist.length ? nextChecklist : checklist,
    };
    await onUpdateSession(activeSession.id, nextPlan, activeSession.status || "planned");
    setShowPlanEditor(false);
  };

  const toggleTimer = () => {
    setTimerState({ ...timer, running: !running });
  };

  const resetTimer = () => {
    setTimerState({ key: timerKey, secondsLeft: totalSeconds, running: false });
  };

  const enterFocusFullscreen = async () => {
    setFocusFullscreen(true);
    await document.documentElement.requestFullscreen?.().catch(() => undefined);
  };

  const exitFocusFullscreen = async () => {
    setFocusFullscreen(false);
    if (document.fullscreenElement) {
      await document.exitFullscreen?.().catch(() => undefined);
    }
  };

  useEffect(() => {
    if (!focusFullscreen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFocusFullscreen(false);
    };
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) setFocusFullscreen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [focusFullscreen]);

  return (
    <div className="min-h-screen px-margin-desktop pb-lg flex flex-col">
      {focusFullscreen ? (
        <div className="fixed inset-0 z-50 bg-background text-on-surface flex items-center justify-center px-md">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(205,239,184,0.55),transparent_42%)]" />
          <button
            type="button"
            className="absolute right-md top-md z-10 rounded-full border-2 border-primary-fixed-dim bg-white/85 px-md py-xs font-label-md text-label-md text-primary bubbly-button"
            onClick={exitFocusFullscreen}
          >
            Exit
          </button>
          <div className="relative z-10 flex w-full max-w-4xl flex-col items-center text-center">
            <p className="mb-sm font-label-md text-label-md uppercase tracking-widest text-on-surface-variant">
              {running ? "Focus mode" : "Ready when you are"}
            </p>
            <div className="relative mb-lg h-[min(70vw,28rem)] w-[min(70vw,28rem)] max-h-[28rem] max-w-[28rem]">
              <svg className="h-full w-full -rotate-90">
                <circle className="text-surface-variant" cx="50%" cy="50%" fill="transparent" r="45%" stroke="currentColor" strokeWidth="14" />
                <circle
                  className="text-primary"
                  cx="50%"
                  cy="50%"
                  fill="transparent"
                  r="45%"
                  stroke="currentColor"
                  strokeDasharray="1131"
                  strokeDashoffset={Math.max(0, 1131 - focusProgress)}
                  strokeLinecap="round"
                  strokeWidth="14"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-display-lg text-[clamp(4rem,14vw,9rem)] leading-none text-primary">
                  {minutesToClock(secondsLeft)}
                </span>
                <span className="mt-sm max-w-md px-md font-headline-md text-headline-md text-on-surface">
                  {activeBlock?.name || "Focus time"}
                </span>
              </div>
            </div>
            {activeBlock?.tasks?.[0] ? (
              <p className="mb-lg max-w-2xl rounded-full border-2 border-primary-fixed-dim bg-white/80 px-lg py-sm font-body-lg text-body-lg text-on-surface-variant">
                {activeBlock.tasks[0]}
              </p>
            ) : null}
            <div className="flex w-full max-w-xl flex-col gap-sm sm:flex-row">
              <button
                type="button"
                className="bubbly-button flex-1 rounded-full bg-primary py-md font-bold text-on-primary shadow-lg"
                onClick={toggleTimer}
              >
                <span className="material-symbols-outlined align-middle">{running ? "pause_circle" : "play_circle"}</span>
                <span className="ml-xs align-middle">{running ? "Pause" : "Start"}</span>
              </button>
              <button
                type="button"
                className="bubbly-button rounded-full border-2 border-surface-variant bg-white px-lg py-md font-bold text-on-surface-variant"
                onClick={resetTimer}
              >
                <span className="material-symbols-outlined align-middle">restart_alt</span>
                <span className="ml-xs align-middle">Reset</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <ViewHeader
        searchPlaceholder="Search sessions..."
        searchValue={search}
        onSearchChange={setSearch}
        actions={actions}
      />

      <div className="max-w-7xl mx-auto w-full flex-grow pb-xl">
        <div className="mb-lg flex flex-col md:flex-row md:items-end justify-between gap-md mt-sm">
          <div>
            <h1 className="font-display-lg text-display-lg text-primary mb-xs">Study Session Builder</h1>
            <p className="text-body-lg font-body-lg text-on-surface-variant flex items-center gap-xs">
              Designing a flow for:{" "}
              <span className="font-bold text-secondary">
                {sessionMode === "custom"
                  ? customTitle || "Custom focus"
                  : selectedAssignment?.name || "Choose an assignment after syncing Canvas"}
              </span>
            </p>
          </div>
          <div className="bg-tertiary-container px-md py-sm rounded-lg flex items-center gap-sm self-start md:self-auto">
            <span className="material-symbols-outlined text-on-tertiary-container">auto_awesome</span>
            <p className="font-label-md text-on-tertiary-container italic">
              {sessionMode === "custom"
                ? "Manual files and notes can power this."
                : selectedAssignment
                  ? `${estimateEffort(selectedAssignment)} estimated effort`
                  : "Canvas context powers this."}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-gutter">
          <div className="col-span-12 lg:col-span-5 space-y-gutter">
            <div className="straight-panel bg-surface-container-lowest p-md rounded-lg border-2 border-primary-fixed-dim">
              <div className="flex items-center gap-sm mb-md">
                <span className="material-symbols-outlined text-primary">route</span>
                <h3 className="font-headline-md text-headline-md">Session source</h3>
              </div>
              <div className="grid grid-cols-2 gap-sm">
                {[
                  ["canvas", "Canvas task", "assignment"],
                  ["custom", "Custom focus", "edit_note"],
                ].map(([value, label, icon]) => (
                  <button
                    key={value}
                    type="button"
                    className={`p-sm border-2 rounded-lg font-bold transition-all flex items-center justify-center gap-xs ${
                      sessionMode === value
                        ? "border-primary bg-primary-container hover-squish"
                        : "border-surface-variant bg-white hover:border-primary"
                    }`}
                    onClick={() => {
                      setSessionMode(value as SessionMode);
                      setSelectedSessionId(null);
                      setSessionTitle(null);
                      if (value === "custom") onSelectAssignment(null);
                    }}
                  >
                    <span className="material-symbols-outlined text-sm">{icon}</span>
                    {label}
                  </button>
                ))}
              </div>
              <p className="mt-sm font-label-md text-label-md text-on-surface-variant">
                Canvas tasks use synced rubrics, files, and due dates. Custom focus uses your notes and uploaded material.
              </p>
            </div>

            <div className="straight-panel bg-surface-container-lowest p-md rounded-lg border-2 border-surface-variant">
              <div className="flex items-center gap-sm mb-md">
                <span className="material-symbols-outlined text-primary">fact_check</span>
                <h3 className="font-headline-md text-headline-md">Saved sessions</h3>
              </div>
              <select
                value={activeSession?.id || ""}
                onChange={(event) => selectSession(event.target.value)}
                className="w-full bg-white border-2 border-surface-variant rounded-lg p-sm font-body-md focus:outline-none focus:border-primary"
              >
                <option value="">Draft from current setup</option>
                {sessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.assignment?.course?.courseCode || session.assignment?.course?.name || "Custom"}: {session.title}
                  </option>
                ))}
              </select>
              {activeSession ? (
                <div className="mt-md space-y-sm">
                  <input
                    value={sessionTitle ?? activeSession.title}
                    onChange={(event) => setSessionTitle(event.target.value)}
                    className="w-full bg-white border-2 border-surface-variant rounded-lg p-sm font-body-md focus:outline-none focus:border-primary"
                    placeholder="Session title"
                  />
                  <button
                    type="button"
                    className="bubbly-button w-full bg-secondary text-on-secondary font-bold py-sm rounded-lg flex items-center justify-center gap-sm"
                    onClick={saveSessionDetails}
                  >
                    <span className="material-symbols-outlined">save</span>
                    Save session edits
                  </button>
                </div>
              ) : (
                <p className="mt-sm font-label-md text-label-md text-on-surface-variant">
                  Generate a session, then you can come back and edit it here.
                </p>
              )}
            </div>

            {sessionMode === "canvas" ? (
              <div className="straight-panel bg-surface-container-lowest p-md rounded-lg border-2 border-surface-variant">
              <div className="flex items-center gap-sm mb-md">
                <span className="material-symbols-outlined text-primary">assignment</span>
                <h3 className="font-headline-md text-headline-md">Assignment</h3>
              </div>
              <select
                value={selectedAssignment?.id || ""}
                onChange={(event) => {
                  setSelectedSessionId(null);
                  setSessionTitle(null);
                  setActiveBlockIndex(0);
                  onSelectAssignment(event.target.value || null);
                }}
                className="w-full bg-white border-2 border-surface-variant rounded-lg p-sm font-body-md focus:outline-none focus:border-primary"
              >
                {filteredAssignments.length ? (
                  filteredAssignments.map((assignment) => (
                    <option key={assignment.id} value={assignment.id}>
                      {assignment.courseName}: {assignment.name}
                    </option>
                  ))
                ) : (
                  <option value="">No assignments synced</option>
                )}
              </select>
              <p className="mt-sm font-label-md text-label-md text-on-surface-variant">
                {selectedAssignment ? `${formatDate(selectedAssignment.dueAt)} - ${selectedAssignment.courseName}` : "Sync Canvas first."}
              </p>
              {selectedAssignment ? (
                <button
                  type="button"
                  className="mt-md bubbly-button w-full bg-surface-container border-2 border-surface-variant text-on-surface font-bold py-sm rounded-lg flex items-center justify-center gap-sm"
                  onClick={() =>
                    onUpdateAssignmentStatus(
                      selectedAssignment.id,
                      isSubmitted(selectedAssignment) ? "open" : "submitted_elsewhere",
                    )
                  }
                >
                  <span className="material-symbols-outlined">
                    {isSubmitted(selectedAssignment) ? "undo" : "task_alt"}
                  </span>
                  {isSubmitted(selectedAssignment)
                    ? `Reopen locally (${statusLabel(selectedAssignment)})`
                    : "Mark done elsewhere"}
                </button>
              ) : null}
              </div>
            ) : (
              <div className="straight-panel bg-surface-container-lowest p-md rounded-lg border-2 border-surface-variant">
                <div className="flex items-center gap-sm mb-md">
                  <span className="material-symbols-outlined text-primary">edit_note</span>
                  <h3 className="font-headline-md text-headline-md">Custom focus</h3>
                </div>
                <label className="block mb-sm">
                  <span className="font-label-md text-label-md text-on-surface-variant">Focus title</span>
                  <input
                    value={customTitle}
                    onChange={(event) => setCustomTitle(event.target.value)}
                    placeholder="Example: Finish cyber security report outline"
                    className="mt-xs w-full bg-white border-2 border-surface-variant rounded-lg p-sm font-body-md focus:outline-none focus:border-primary"
                  />
                </label>
                <label className="block">
                  <span className="font-label-md text-label-md text-on-surface-variant">What do you want to work on?</span>
                  <textarea
                    value={customFocus}
                    onChange={(event) => setCustomFocus(event.target.value)}
                    placeholder="Paste the brief, describe the task, add what is confusing, or list the outcome you want by the end."
                    className="mt-xs w-full bg-white border-2 border-surface-variant rounded-lg p-sm font-body-md focus:outline-none focus:border-primary min-h-32 resize-y"
                  />
                </label>
                <p className="mt-sm font-label-md text-label-md text-on-surface-variant">
                  Upload slides or notes below, then generate a plan. The timer waits until you decide the plan is right.
                </p>
              </div>
            )}

            <div className="straight-panel bg-primary-container/25 p-md rounded-lg border-2 border-primary-fixed-dim">
              <div className="flex items-center gap-sm mb-md">
                <span className="material-symbols-outlined text-primary">attach_file_add</span>
                <h3 className="font-headline-md text-headline-md">Add context before planning</h3>
              </div>
              <p className="font-body-md text-body-md text-on-surface-variant mb-sm">
                Attach the assignment brief, slides, PDF, screenshot, or paste rubric notes here. Gemini can deep-read PDFs, images, and PowerPoint files under 4 MB when it builds the next plan.
              </p>
              <input
                type="file"
                className="w-full bg-white border-2 border-surface-variant rounded-lg p-sm font-label-md text-label-md"
                accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.ppt,.pptx,.doc,.docx,.txt,.md,.markdown,.html,.htm,.csv,.json,.xml,text/*,image/*,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(event) => setSessionUploadFile(event.target.files?.[0] || null)}
              />
              <textarea
                value={sessionUploadNotes}
                onChange={(event) => setSessionUploadNotes(event.target.value)}
                placeholder="Optional: paste extra brief/rubric/lecture highlights, especially for large or blurry files..."
                className="mt-sm w-full bg-white border-2 border-surface-variant rounded-lg p-sm font-body-md focus:outline-none focus:border-primary min-h-24 resize-y"
              />
              <button
                type="button"
                className="mt-sm bubbly-button w-full bg-secondary text-on-secondary font-bold py-sm rounded-lg flex items-center justify-center gap-sm disabled:opacity-60"
                onClick={uploadSessionMaterial}
                disabled={
                  !actions.onUploadMaterial ||
                  isUploadingMaterial ||
                  (!sessionUploadFile && !sessionUploadNotes.trim())
                }
              >
                <span className="material-symbols-outlined">library_add</span>
                {isUploadingMaterial
                  ? "Adding material..."
                  : sessionMode === "custom"
                    ? "Add to custom focus"
                    : "Add to this assignment"}
              </button>
            </div>

            <div className="straight-panel bg-surface-container-lowest p-md rounded-lg border-2 border-surface-variant">
              <div className="flex items-center gap-sm mb-md">
                <span className="material-symbols-outlined text-primary">schedule</span>
                <h3 className="font-headline-md text-headline-md">How long?</h3>
              </div>
              <div className="grid grid-cols-4 gap-sm">
                {durations.map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`p-sm border-2 rounded-lg font-bold transition-all text-center ${
                      duration === value ? "border-primary bg-primary-container hover-squish" : "border-surface-variant hover:border-primary"
                    }`}
                    onClick={() => setDuration(value)}
                  >
                    <span className="block text-xl">{value}m</span>
                    <span className="text-xs uppercase opacity-70">{value <= 25 ? "Sprint" : value <= 50 ? "Classic" : "Deep"}</span>
                  </button>
                ))}
              </div>
              <label className="block mt-sm">
                <span className="font-label-md text-label-md text-on-surface-variant">Custom minutes</span>
                <input
                  type="number"
                  min={15}
                  max={480}
                  value={duration}
                  onChange={(event) =>
                    setDuration(Math.max(15, Math.min(480, Number(event.target.value) || 15)))
                  }
                  className="mt-xs w-full bg-white border-2 border-surface-variant rounded-lg p-sm font-body-md focus:outline-none focus:border-primary"
                />
              </label>
              <div className="mt-md rounded-lg border-2 border-primary-fixed-dim bg-primary-container/30 p-sm">
                <p className="font-label-md text-label-md text-on-surface-variant">Using your defaults</p>
                <p className="font-body-md text-on-surface">
                  {mode} - {energyLevel} energy - {targetOutcome}
                </p>
                <button
                  type="button"
                  className="mt-sm w-full rounded-full border-2 border-primary-fixed-dim bg-white/80 py-xs font-label-md text-label-md bubbly-button"
                  onClick={() => setShowSetupOptions((current) => !current)}
                >
                  {showSetupOptions ? "Hide preferences" : "Customize preferences"}
                </button>
              </div>
              <button
                type="button"
                className="mt-md bubbly-button w-full bg-primary text-on-primary font-bold py-md rounded-lg flex items-center justify-center gap-sm shadow-lg disabled:opacity-60"
                onClick={generateSession}
                disabled={isCreatingSession || (sessionMode === "canvas" && !selectedAssignment)}
              >
                <span className="material-symbols-outlined">auto_awesome</span>
                {isCreatingSession
                  ? "Generating..."
                  : sessionMode === "custom"
                    ? "Generate custom focus plan"
                    : "Generate Canvas-specific plan"}
              </button>
            </div>

            {showSetupOptions ? (
            <>
            <div className="straight-panel bg-surface-container-lowest p-md rounded-lg border-2 border-surface-variant">
              <div className="flex items-center gap-sm mb-md">
                <span className="material-symbols-outlined text-primary">battery_charging_80</span>
                <h3 className="font-headline-md text-headline-md">Energy Level</h3>
              </div>
              <div className="grid grid-cols-3 gap-sm">
                {energyLevels.map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`p-sm border-2 rounded-lg font-bold transition-all flex flex-col items-center ${
                      energyLevel === value ? "border-primary bg-primary-container hover-squish" : "border-surface-variant"
                    }`}
                    onClick={() => setEnergyLevel(value)}
                  >
                    <span className="material-symbols-outlined mb-xs">
                      {value === "Low" ? "sentiment_dissatisfied" : value === "High" ? "sentiment_very_satisfied" : "sentiment_satisfied"}
                    </span>
                    <span className="text-sm">{value}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="straight-panel bg-surface-container-lowest p-md rounded-lg border-2 border-surface-variant">
              <div className="flex items-center gap-sm mb-md">
                <span className="material-symbols-outlined text-primary">psychology</span>
                <h3 className="font-headline-md text-headline-md">Study Mode</h3>
              </div>
              <div className="space-y-sm">
                {modes.map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`w-full flex items-center justify-between p-md border-2 rounded-lg transition-all ${
                      mode === value ? "border-primary bg-primary-container hover-squish" : "border-surface-variant hover:bg-primary-container/10"
                    }`}
                    onClick={() => setMode(value)}
                  >
                    <span className="font-bold">{value}</span>
                    <span className="material-symbols-outlined text-primary">
                      {mode === value ? "check_circle" : "radio_button_unchecked"}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="straight-panel bg-surface-container-lowest p-md rounded-lg border-2 border-surface-variant">
              <div className="flex items-center gap-sm mb-md">
                <span className="material-symbols-outlined text-primary">workspace_premium</span>
                <h3 className="font-headline-md text-headline-md">Target outcome</h3>
              </div>
              <div className="flex flex-wrap gap-sm">
                {outcomes.map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`px-md py-xs rounded-full font-label-md text-label-md border-2 ${
                      targetOutcome === value ? "bg-primary text-on-primary border-primary" : "bg-white border-surface-variant"
                    }`}
                    onClick={() => setTargetOutcome(value)}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>
            </>
            ) : null}
          </div>

          <div className="col-span-12 lg:col-span-7 space-y-gutter">
            <div className="bg-surface-container-low border-2 border-outline-variant p-lg rounded-lg bubbly-shadow flex flex-col items-center relative overflow-hidden">
              <div className="absolute -top-4 -right-4 opacity-20 transform rotate-12">
                <span className="material-symbols-outlined text-[120px] text-primary">temp_preferences_custom</span>
              </div>
              <div className="relative w-64 h-64 mb-lg">
                <svg className="w-full h-full transform -rotate-90">
                  <circle className="text-surface-variant" cx="128" cy="128" fill="transparent" r="110" stroke="currentColor" strokeWidth="12" />
                  <circle
                    className="text-primary"
                    cx="128"
                    cy="128"
                    fill="transparent"
                    r="110"
                    stroke="currentColor"
                    strokeDasharray="691"
                    strokeDashoffset={Math.max(0, 691 - progress)}
                    strokeLinecap="round"
                    strokeWidth="12"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-5xl font-display-lg text-primary">{minutesToClock(secondsLeft)}</span>
                  <span className="text-sm font-bold text-on-surface-variant uppercase tracking-widest">
                    {activeBlock?.name || (running ? "Focus Time" : "Ready")}
                  </span>
                </div>
              </div>

              {activeBlock ? (
                <div className="w-full bg-white rounded-lg border-2 border-surface-variant p-md mb-md">
                  <p className="font-label-sm text-label-sm uppercase text-on-surface-variant mb-xs">Current block</p>
                  <h3 className="font-headline-md text-headline-md text-primary">{activeBlock.name}</h3>
                  {activeBlock.goal ? <p className="font-body-md text-on-surface-variant mt-xs">{activeBlock.goal}</p> : null}
                  <ul className="mt-sm space-y-xs">
                    {activeBlock.tasks.map((task) => (
                      <li key={task} className="flex gap-xs font-body-md text-body-md">
                        <span className="material-symbols-outlined text-primary text-[18px]">arrow_right</span>
                        <span>{task}</span>
                      </li>
                    ))}
                  </ul>
                  {activeBlock.breakMinutes ? (
                    <p className="mt-sm font-label-md text-label-md text-secondary">
                      Break after this: {activeBlock.breakMinutes} minutes
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className="w-full bg-white rounded-lg border-2 border-surface-variant p-md mb-md">
                <div className="flex items-center justify-between mb-sm gap-sm">
                  <span className="font-bold text-primary line-clamp-1">{plan.title}</span>
                  <span className="text-xs font-bold text-on-surface-variant px-sm py-1 bg-surface-container rounded-full">
                    {activeSession ? activeSession.mode : mode}
                  </span>
                </div>
                <p className="font-body-md text-on-surface-variant mb-md line-clamp-3">
                  {compactText(plan.assignmentBrief || selectedAssignment?.description, "Generate a plan to pull rubric and file context into this session.")}
                </p>
                <div className="space-y-sm">
                  {plan.blocks.slice(0, 5).map((block, index) => (
                    <button
                      key={`${block.name}-${index}`}
                      type="button"
                      className={`w-full flex items-start gap-md p-sm rounded-lg border text-left ${
                        index === safeActiveBlockIndex ? "bg-primary-container border-primary/20" : "bg-white border-surface-variant"
                      }`}
                      onClick={() => selectBlock(index)}
                    >
                      <span className="font-bold text-primary w-12">{block.minutes}m</span>
                      <span className="material-symbols-outlined text-primary">{index === safeActiveBlockIndex ? "menu_book" : "edit"}</span>
                      <div className="flex-1">
                        <p className="font-medium">{block.name}</p>
                        <p className="text-sm text-on-surface-variant">{block.tasks[0] || block.goal || "Focus task"}</p>
                        {block.breakMinutes ? (
                          <p className="text-xs text-secondary mt-xs">Break: {block.breakMinutes}m after this block</p>
                        ) : null}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-sm w-full">
                <button
                  type="button"
                  className="bubbly-button flex-1 bg-primary text-on-primary font-bold py-md rounded-lg text-lg flex items-center justify-center gap-sm shadow-lg"
                  onClick={toggleTimer}
                >
                  <span className="material-symbols-outlined">{running ? "pause_circle" : "play_circle"}</span>
                  {running ? "Pause Session" : "Start Focused Session"}
                </button>
                <button
                  type="button"
                  className="bubbly-button bg-surface-container text-on-surface-variant border-2 border-surface-variant font-bold px-md rounded-lg"
                  onClick={resetTimer}
                >
                  <span className="material-symbols-outlined">restart_alt</span>
                </button>
                <button
                  type="button"
                  className="bubbly-button bg-white text-primary border-2 border-primary-fixed-dim font-bold px-md rounded-lg flex items-center justify-center gap-xs"
                  onClick={enterFocusFullscreen}
                  title="Open focus timer fullscreen"
                >
                  <span className="material-symbols-outlined">fullscreen</span>
                  <span className="hidden sm:inline">Focus view</span>
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-sm w-full mt-sm">
                <button
                  type="button"
                  className="bubbly-button bg-white text-primary border-2 border-primary-fixed-dim font-bold py-sm rounded-lg flex items-center justify-center gap-sm"
                  onClick={generateSession}
                  disabled={isCreatingSession || (sessionMode === "canvas" && !selectedAssignment)}
                >
                  <span className="material-symbols-outlined">refresh</span>
                  Not happy? Regenerate
                </button>
                <button
                  type="button"
                  className="bubbly-button bg-white text-primary border-2 border-primary-fixed-dim font-bold py-sm rounded-lg flex items-center justify-center gap-sm disabled:opacity-60"
                  onClick={() => (showPlanEditor ? setShowPlanEditor(false) : openPlanEditor())}
                  disabled={!activeSession}
                >
                  <span className="material-symbols-outlined">tune</span>
                  Customize plan
                </button>
                <button
                  type="button"
                  className="bubbly-button bg-white text-secondary border-2 border-secondary-fixed-dim font-bold py-sm rounded-lg flex items-center justify-center gap-sm"
                  onClick={askAboutSession}
                >
                  <span className="material-symbols-outlined">chat</span>
                  Ask about this session
                </button>
              </div>
            </div>

            {showPlanEditor && activeSession ? (
              <div className="bg-surface-container-lowest p-md rounded-lg border-2 border-primary-fixed-dim bubbly-shadow">
                <div className="flex items-center justify-between gap-sm mb-md">
                  <div className="flex items-center gap-sm">
                    <span className="material-symbols-outlined text-primary">edit_square</span>
                    <h3 className="font-headline-md text-headline-md">Customize this session</h3>
                  </div>
                  <button
                    type="button"
                    className="rounded-full bg-surface-container px-sm py-xs font-label-md text-label-md"
                    onClick={() => setShowPlanEditor(false)}
                  >
                    Close
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-sm">
                  <label className="block md:col-span-2">
                    <span className="font-label-md text-label-md text-on-surface-variant">Current block name</span>
                    <input
                      value={blockDraft.name}
                      onChange={(event) => setBlockDraft((current) => ({ ...current, name: event.target.value }))}
                      className="mt-xs w-full bg-white border-2 border-surface-variant rounded-lg p-sm font-body-md focus:outline-none focus:border-primary"
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
                      className="mt-xs w-full bg-white border-2 border-surface-variant rounded-lg p-sm font-body-md focus:outline-none focus:border-primary"
                    />
                  </label>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-sm mt-sm">
                  <label className="block md:col-span-2">
                    <span className="font-label-md text-label-md text-on-surface-variant">Tasks for this block</span>
                    <textarea
                      value={blockDraft.tasks}
                      onChange={(event) => setBlockDraft((current) => ({ ...current, tasks: event.target.value }))}
                      className="mt-xs w-full bg-white border-2 border-surface-variant rounded-lg p-sm font-body-md focus:outline-none focus:border-primary min-h-32 resize-y"
                      placeholder="One task per line"
                    />
                  </label>
                  <label className="block">
                    <span className="font-label-md text-label-md text-on-surface-variant">Break after block</span>
                    <input
                      type="number"
                      min={0}
                      max={60}
                      value={blockDraft.breakMinutes}
                      onChange={(event) => setBlockDraft((current) => ({ ...current, breakMinutes: event.target.value }))}
                      className="mt-xs w-full bg-white border-2 border-surface-variant rounded-lg p-sm font-body-md focus:outline-none focus:border-primary"
                      placeholder="Optional"
                    />
                  </label>
                </div>
                <label className="block mt-sm">
                  <span className="font-label-md text-label-md text-on-surface-variant">Checklist</span>
                  <textarea
                    value={checklistDraft}
                    onChange={(event) => setChecklistDraft(event.target.value)}
                    className="mt-xs w-full bg-white border-2 border-surface-variant rounded-lg p-sm font-body-md focus:outline-none focus:border-primary min-h-28 resize-y"
                    placeholder="One milestone per line"
                  />
                </label>
                <button
                  type="button"
                  className="mt-sm bubbly-button w-full bg-primary text-on-primary font-bold py-sm rounded-lg flex items-center justify-center gap-sm"
                  onClick={savePlanEdits}
                >
                  <span className="material-symbols-outlined">save</span>
                  Save custom plan
                </button>
              </div>
            ) : null}

            <div className="bg-surface-container-highest p-md rounded-lg border-2 border-primary-fixed-dim">
              <div className="flex items-center justify-between mb-md">
                <div className="flex items-center gap-sm">
                  <span className="material-symbols-outlined text-primary">checklist</span>
                  <h3 className="font-headline-md text-headline-md">Session Milestones</h3>
                </div>
                <span className="text-xs bg-primary text-on-primary px-sm py-1 rounded-full">
                  {completedCount}/{checklist.length} Completed
                </span>
              </div>
              <div className="space-y-sm">
                {checklist.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className="w-full flex items-center gap-md bg-white p-md rounded-lg border-2 border-transparent hover:border-primary-fixed transition-all cursor-pointer text-left"
                    onClick={() => toggleChecklist(item)}
                  >
                    <span
                      className={`w-6 h-6 rounded-md border-2 flex items-center justify-center ${
                        completedMap[item] ? "bg-primary border-primary text-on-primary" : "border-outline"
                      }`}
                    >
                      {completedMap[item] ? <span className="material-symbols-outlined text-[18px]">check</span> : null}
                    </span>
                    <span className="flex-1 text-on-surface">{item}</span>
                    <span className="material-symbols-outlined text-surface-variant">star</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
