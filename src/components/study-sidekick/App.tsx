"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type ViewType } from "./lib/utils";
import {
  assignmentBelongsToCourse,
  markAssignmentSubmittedElsewhere,
  removeCourseDashboardData,
  removeDashboardAssignments,
  scrubDailyBriefAssignments,
} from "./lib/dashboard-state";
import SideNav from "./components/SideNav";
import DashboardView from "./views/DashboardView";
import AssignmentsView from "./views/AssignmentsView";
import CoursesView from "./views/CoursesView";
import AnnouncementsView from "./views/AnnouncementsView";
import FilesView from "./views/FilesView";
import StudySessionsView from "./views/StudySessionsView";
import RiskView from "./views/RiskView";
import FocusStreakView from "./views/FocusStreakView";
import AiChatView, { type ChatMessage } from "./views/AiChatView";
import SettingsView from "./views/SettingsView";
import SupportView from "./views/SupportView";
import FocusMiniTimer from "./components/FocusMiniTimer";
import {
  FOCUS_TIMER_EVENT,
  type FocusTimerSnapshot,
  focusTimerResumeHref,
  focusTimerSecondsLeft,
  isFocusTimerSnapshotVisible,
  readFocusTimerSnapshot,
} from "./lib/focus-timer";
import type {
  ActiveOperation,
  AnnouncementSummary,
  AssignmentSummary,
  CourseSummary,
  CreateStudySessionInput,
  DailyBrief,
  DashboardScopeSummary,
  DashboardSummary,
  FileSummary,
  StudyAgentConfirmation,
  StudyPlan,
  StudySessionRecord,
  StudySessionUpdateInput,
  StudySidekickActions,
} from "./types";

async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const isFormData = init?.body instanceof FormData;
  const response = await fetch(path, {
    ...init,
    headers: isFormData
      ? init?.headers
      : {
          "Content-Type": "application/json",
          ...(init?.headers || {}),
        },
  });

  if (response.status === 401) {
    window.location.href = "/login";
    throw new Error("Authentication required");
  }

  const rawPayload = await response.text().catch(() => "");
  const payload = rawPayload
    ? (() => {
        try {
          return JSON.parse(rawPayload) as unknown;
        } catch {
          return null;
        }
      })()
    : {};

  if (!response.ok) {
    const payloadObject = payload && typeof payload === "object" && !Array.isArray(payload) ? payload : null;
    const serverError =
      payloadObject && "error" in payloadObject && typeof payloadObject.error === "string"
        ? payloadObject.error
        : payloadObject && "message" in payloadObject && typeof payloadObject.message === "string"
          ? payloadObject.message
          : null;
    const fallbackText = rawPayload
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 180);

    throw new Error(serverError || (fallbackText ? `Request failed (${response.status}): ${fallbackText}` : `Request failed (${response.status})`));
  }
  return payload as T;
}

const emptyDashboard: DashboardSummary = {
  userName: "Nathaniel",
  timezone: "Australia/Sydney",
  lastSyncAt: null,
  lastSuccessfulSyncAt: null,
  lastSyncAttemptAt: null,
  canvasConfigured: false,
  canvasConnectionMode: "not_connected",
  syncStatus: "not_connected",
  syncError: null,
  syncSummary: {
    visibleCourses: 0,
    hiddenCourses: 0,
    assignments: 0,
    unsubmittedAssignments: 0,
    announcements: 0,
    files: 0,
    resources: 0,
    manualMaterials: 0,
  },
  stale: true,
  todayMission: ["Sync Canvas to build today's mission."],
  dueToday: [],
  dueThisWeek: [],
  unsubmitted: [],
  announcements: [],
  files: [],
  riskLevel: "low",
};

const emptyScope: DashboardScopeSummary = {
  excludedCourseIds: [],
  excludedCanvasCourseIds: [],
  excludedAssignmentIds: [],
  excludedCanvasAssignmentKeys: [],
  hiddenCourses: [],
  hiddenAssignments: [],
};

const CHAT_STORAGE_KEY = "study-sidekick-chat-v1";
const CHAT_RETENTION_MS = 24 * 60 * 60 * 1000;
const OPERATION_STORAGE_KEY = "study-sidekick-active-operation-v1";
const OPERATION_LOCK_TIMEOUT_MS = 10 * 60 * 1000;
const FOCUS_UNLOAD_PROMPT_KEY = "study-sidekick-focus-unload-prompt-v1";
const PAGE_REFRESH_CACHE_KEY = "study-sidekick-page-refresh-v1";
const PAGE_REFRESH_FRESH_MS = 2 * 60 * 1000;
const CANVAS_COURSE_SYNC_CONCURRENCY = 2;

type CanvasSyncCourse = {
  canvasCourseId: number;
  name: string;
  courseCode?: string | null;
};

type CanvasCourseRefreshSummary = {
  assignments: number;
  changes?: Array<{ label: string }>;
  warnings?: string[];
};

type ChatAgentEvent = {
  type: "study_session_created" | "dashboard_item_hidden" | "dashboard_scope_reset";
  label: string;
  assignmentId?: string | null;
  itemType?: "assignment" | "assignment_group" | "course";
  itemId?: string | null;
  sessionId?: string | null;
  view?: ViewType;
};

type ChatApiResponse = {
  answer: string;
  lastSyncAt?: string | null;
  provider?: "gemini" | "fallback" | "agent";
  model?: string | null;
  reason?: string | null;
  confirmation?: StudyAgentConfirmation;
  agentEvents?: ChatAgentEvent[];
};

type ChatNotice = {
  title: string;
  body: string;
  tone: "found" | "waiting";
} | null;

function focusClock(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const rest = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${rest}`;
}

function readPageRefreshCache() {
  if (typeof window === "undefined") return {};
  try {
    const stored = window.localStorage.getItem(PAGE_REFRESH_CACHE_KEY);
    if (!stored) return {};
    const parsed = JSON.parse(stored) as Record<string, number>;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed;
  } catch {
    window.localStorage.removeItem(PAGE_REFRESH_CACHE_KEY);
    return {};
  }
}

function writePageRefreshCache(cache: Record<string, number>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PAGE_REFRESH_CACHE_KEY, JSON.stringify(cache));
}

function pageRefreshCacheKey(syncScope: "assignments" | "announcements", canvasCourseId: number) {
  return `${syncScope}:${canvasCourseId}`;
}

async function runCourseRefreshQueue(input: {
  courses: CanvasSyncCourse[];
  includeResources?: boolean;
  syncScope: "all" | "assignments" | "announcements";
  onProgress: (message: string) => void;
}) {
  const changes: Array<{ label: string }> = [];
  const warnings: string[] = [];
  let assignmentCount = 0;
  let successfulCourses = 0;
  let cursor = 0;
  let completed = 0;

  const workerCount = Math.min(CANVAS_COURSE_SYNC_CONCURRENCY, Math.max(1, input.courses.length));

  const worker = async () => {
    while (cursor < input.courses.length) {
      const courseIndex = cursor;
      cursor += 1;
      const course = input.courses[courseIndex];
      input.onProgress(`Refreshing ${completed}/${input.courses.length} courses. Checking ${course.name}...`);

      try {
        const courseSummary = await apiJson<CanvasCourseRefreshSummary>("/api/canvas/sync/course", {
          method: "POST",
          body: JSON.stringify({
            canvasCourseId: course.canvasCourseId,
            includeResources: input.includeResources || false,
            syncScope: input.syncScope,
          }),
        });
        successfulCourses += 1;
        assignmentCount += courseSummary.assignments || 0;
        changes.push(...(courseSummary.changes || []));
        warnings.push(...(courseSummary.warnings || []));
      } catch (error) {
        warnings.push(`${course.name}: ${error instanceof Error ? error.message : "course refresh failed"}`);
      } finally {
        completed += 1;
        input.onProgress(`Refreshing ${completed}/${input.courses.length} courses...`);
      }
    }
  };

  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return {
    successfulCourses,
    assignmentCount,
    changes,
    warnings,
  };
}

function operationId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function isFreshOperation(operation: ActiveOperation | null) {
  return Boolean(operation && Date.now() - operation.startedAt < OPERATION_LOCK_TIMEOUT_MS);
}

function readStoredOperation(): ActiveOperation | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(OPERATION_STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as ActiveOperation;
    if (!parsed?.id || !parsed.type || !parsed.label || !parsed.startedAt) return null;
    if (!isFreshOperation(parsed)) {
      window.localStorage.removeItem(OPERATION_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    window.localStorage.removeItem(OPERATION_STORAGE_KEY);
    return null;
  }
}

function writeStoredOperation(operation: ActiveOperation) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(OPERATION_STORAGE_KEY, JSON.stringify(operation));
}

function clearStoredOperation(operation: ActiveOperation) {
  if (typeof window === "undefined") return;
  const stored = readStoredOperation();
  if (!stored || stored.id === operation.id) {
    window.localStorage.removeItem(OPERATION_STORAGE_KEY);
  }
}

function welcomeMessage(): ChatMessage {
  return {
    id: "welcome",
    role: "assistant",
    createdAt: Date.now(),
    content:
      "Hey Nathaniel. Ask me what is due, what changed, or ask me to create a study session. I can use safe study tools, but Canvas stays read-only.",
  };
}

function pruneChatMessages(messages: ChatMessage[]) {
  const cutoff = Date.now() - CHAT_RETENTION_MS;
  const fresh = messages.filter((message) => message.createdAt >= cutoff);
  return fresh.length ? fresh : [welcomeMessage()];
}

function serialisableChatMessages(messages: ChatMessage[]) {
  return pruneChatMessages(messages).map((message) => {
    const cleanMessage = { ...message };
    delete cleanMessage.confirmation;
    delete cleanMessage.confirmationStatus;
    return cleanMessage;
  });
}

function recentChatContextMessages(messages: ChatMessage[]) {
  return pruneChatMessages(messages)
    .filter((message) => message.id !== "welcome")
    .filter((message) => message.content !== "__sidekick_working__")
    .filter((message) => !message.confirmation)
    .slice(-8)
    .map((message) => ({
      role: message.role,
      content: message.content.slice(0, 1200),
    }));
}

function upsertStudySession(current: StudySessionRecord[], session: StudySessionRecord) {
  const next = [session, ...current.filter((item) => item.id !== session.id)];
  return next.sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
}

function loadStoredChatMessages() {
  if (typeof window === "undefined") return [welcomeMessage()];
  try {
    const stored = window.localStorage.getItem(CHAT_STORAGE_KEY);
    if (!stored) return [welcomeMessage()];
    const parsed = JSON.parse(stored) as ChatMessage[];
    if (!Array.isArray(parsed)) return [welcomeMessage()];
    return pruneChatMessages(
      parsed
        .filter((message) => message && (message.role === "assistant" || message.role === "user") && typeof message.content === "string")
        .map((message) => ({ ...message, createdAt: message.createdAt || Date.now() })),
    );
  } catch {
    return [welcomeMessage()];
  }
}

export default function App({ initialView = "dashboard" }: { initialView?: ViewType }) {
  const [activeView, setActiveView] = useState<ViewType>(initialView);
  const [dashboard, setDashboard] = useState<DashboardSummary>(emptyDashboard);
  const [assignments, setAssignments] = useState<AssignmentSummary[]>([]);
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementSummary[]>([]);
  const [files, setFiles] = useState<FileSummary[]>([]);
  const [studySessions, setStudySessions] = useState<StudySessionRecord[]>([]);
  const [dailyBrief, setDailyBrief] = useState<DailyBrief | null>(null);
  const [dashboardScope, setDashboardScope] = useState<DashboardScopeSummary>(emptyScope);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isGeneratingBrief, setIsGeneratingBrief] = useState(false);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [isChatSending, setIsChatSending] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [activeOperation, setActiveOperation] = useState<ActiveOperation | null>(null);
  const [chatProviderStatus, setChatProviderStatus] = useState<string | null>(null);
  const [chatDraft, setChatDraft] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(loadStoredChatMessages);
  const [chatNotice, setChatNotice] = useState<ChatNotice>(null);
  const [focusResumePrompt, setFocusResumePrompt] = useState<FocusTimerSnapshot | null>(null);
  const [focusResumeNow, setFocusResumeNow] = useState(() => Date.now());
  const chatSendingRef = useRef(false);
  const activeOperationRef = useRef<ActiveOperation | null>(null);
  const activeViewRef = useRef<ViewType>(initialView);
  const autoSyncStartedRef = useRef(false);

  useEffect(() => {
    activeViewRef.current = activeView;
    if (activeView === "chat") setChatNotice(null);
  }, [activeView]);

  useEffect(() => {
    window.localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(serialisableChatMessages(chatMessages)));
  }, [chatMessages]);

  useEffect(() => {
    const snapshot = readFocusTimerSnapshot();
    const reloadAttempted = Boolean(window.sessionStorage.getItem(FOCUS_UNLOAD_PROMPT_KEY));
    const isFocusLaunch = new URLSearchParams(window.location.search).get("focus") === "1";
    window.sessionStorage.removeItem(FOCUS_UNLOAD_PROMPT_KEY);

    if (!isFocusLaunch && snapshot && isFocusTimerSnapshotVisible(snapshot) && (reloadAttempted || snapshot.running)) {
      setFocusResumePrompt(snapshot);
    }

    const handleFocusTimerChange = (event: Event) => {
      const detail = event instanceof CustomEvent ? (event.detail as FocusTimerSnapshot | null) : null;
      if (!detail || !isFocusTimerSnapshotVisible(detail)) {
        setFocusResumePrompt(null);
        return;
      }
      setFocusResumePrompt((current) => (current ? detail : current));
    };

    window.addEventListener(FOCUS_TIMER_EVENT, handleFocusTimerChange);
    return () => window.removeEventListener(FOCUS_TIMER_EVENT, handleFocusTimerChange);
  }, []);

  useEffect(() => {
    if (!focusResumePrompt) return;
    const interval = window.setInterval(() => setFocusResumeNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [focusResumePrompt]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      const snapshot = readFocusTimerSnapshot();
      const secondsLeft = snapshot ? focusTimerSecondsLeft(snapshot) : 0;
      const hasActiveFocus = Boolean(snapshot && isFocusTimerSnapshotVisible(snapshot) && secondsLeft > 0);
      const storedOperation = readStoredOperation();
      const hasActiveOperation = Boolean(
        isFreshOperation(activeOperationRef.current) || isFreshOperation(storedOperation),
      );

      if (!hasActiveFocus && !hasActiveOperation) return;
      if (hasActiveFocus) window.sessionStorage.setItem(FOCUS_UNLOAD_PROMPT_KEY, String(Date.now()));

      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setChatMessages((current) => pruneChatMessages(current));
    }, 60_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const stored = readStoredOperation();
    activeOperationRef.current = stored;
    setActiveOperation(stored);

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== OPERATION_STORAGE_KEY) return;
      const next = readStoredOperation();
      activeOperationRef.current = next;
      setActiveOperation(next);
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const beginOperation = useCallback(
    (input: Omit<ActiveOperation, "id" | "startedAt">) => {
      const stored = readStoredOperation();
      const current = isFreshOperation(activeOperationRef.current) ? activeOperationRef.current : stored;

      if (current) {
        activeOperationRef.current = current;
        setActiveOperation(current);
        setActionMessage(`${current.label} is already running. I paused this action so updates do not overlap.`);
        if (current.view) setActiveView(current.view);
        return null;
      }

      const operation: ActiveOperation = {
        ...input,
        id: operationId(),
        startedAt: Date.now(),
      };
      activeOperationRef.current = operation;
      setActiveOperation(operation);
      writeStoredOperation(operation);
      return operation;
    },
    [],
  );

  const endOperation = useCallback((operation: ActiveOperation | null) => {
    if (!operation) return;
    if (!activeOperationRef.current || activeOperationRef.current.id === operation.id) {
      activeOperationRef.current = null;
      setActiveOperation(null);
    }
    clearStoredOperation(operation);
  }, []);

  const refreshData = useCallback(async () => {
    const [dashboardData, assignmentData, courseData, announcementData, fileData, sessionData, briefData, scopeData] =
      await Promise.all([
        apiJson<DashboardSummary>("/api/dashboard"),
        apiJson<AssignmentSummary[]>("/api/assignments"),
        apiJson<CourseSummary[]>("/api/courses"),
        apiJson<AnnouncementSummary[]>("/api/announcements"),
        apiJson<FileSummary[]>("/api/files"),
        apiJson<StudySessionRecord[]>("/api/study-sessions"),
        apiJson<{ brief: DailyBrief | null }>("/api/daily-brief"),
        apiJson<DashboardScopeSummary>("/api/preferences"),
      ]);

    setDashboard(dashboardData);
    setAssignments(assignmentData);
    setCourses(courseData);
    setAnnouncements(announcementData);
    setFiles(fileData);
    setStudySessions(sessionData);
    setDailyBrief(briefData.brief);
    setDashboardScope(scopeData);
    setSelectedAssignmentId((current) => current || assignmentData[0]?.id || null);
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    refreshData()
      .catch((error) => {
        if (active) setActionMessage(error instanceof Error ? error.message : "Could not load dashboard data.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [refreshData]);

  const syncCanvas = useCallback(async () => {
    const operation = beginOperation({ type: "sync", label: "Canvas sync", view: "dashboard" });
    if (!operation) return;
    setIsSyncing(true);
    setActionMessage("Preparing Canvas sync and checking your visible courses...");
    try {
      const prepared = await apiJson<{
        courses: CanvasSyncCourse[];
        skippedCourses?: number;
      }>("/api/canvas/sync", { method: "POST" });

      const courseCount = prepared.courses.length;
      const { successfulCourses, changes, warnings } = await runCourseRefreshQueue({
        courses: prepared.courses,
        includeResources: false,
        syncScope: "all",
        onProgress: setActionMessage,
      });

      const syncError =
        courseCount > 0 && successfulCourses === 0
          ? warnings[0] || "No Canvas courses synced successfully."
          : null;
      await apiJson("/api/canvas/sync/finish", {
        method: "POST",
        body: JSON.stringify({
          syncError,
          successfulCourses,
          totalCourses: courseCount,
          changeCount: changes.length,
          warnings: warnings.slice(0, 10),
        }),
      });

      await refreshData();
      if (syncError) {
        const detail = warnings[0] ? ` ${warnings[0]}` : "";
        setActionMessage(`Canvas sync could not finish any courses.${detail}`);
      } else {
        const warningText = warnings.length ? ` ${warnings.length} course warnings were kept so the sync could finish.` : "";
        setActionMessage(
          `Canvas sync complete: ${successfulCourses}/${courseCount} courses synced, ${changes.length} changes detected.${warningText}`,
        );
      }
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "Canvas sync failed.");
    } finally {
      setIsSyncing(false);
      endOperation(operation);
    }
  }, [beginOperation, endOperation, refreshData]);

  const syncCanvasPage = useCallback(
    async (syncScope: "assignments" | "announcements") => {
      const isAssignments = syncScope === "assignments";
      const view = isAssignments ? "assignments" : "announcements";
      const label = isAssignments ? "Assignments refresh" : "Announcements refresh";
      const itemLabel = isAssignments ? "assignments and submission status" : "announcements";
      const operation = beginOperation({ type: "sync", label, view });
      if (!operation) return;

      setIsSyncing(true);
      setActionMessage(`Preparing ${itemLabel} refresh from saved courses...`);
      try {
        let preparedCourses: CanvasSyncCourse[] = courses
          .filter((course) => course.canvasCourseId)
          .map((course) => ({
            canvasCourseId: course.canvasCourseId as number,
            name: course.name,
            courseCode: course.courseCode,
          }));

        if (!preparedCourses.length) {
          setActionMessage("No saved courses yet, checking Canvas once for your course list...");
          const prepared = await apiJson<{
            courses: CanvasSyncCourse[];
          }>("/api/canvas/sync", { method: "POST" });
          preparedCourses = prepared.courses;
        }

        const refreshCache = readPageRefreshCache();
        const now = Date.now();
        const staleCourses = preparedCourses.filter((course) => {
          const lastRefreshedAt = refreshCache[pageRefreshCacheKey(syncScope, course.canvasCourseId)] || 0;
          return now - lastRefreshedAt > PAGE_REFRESH_FRESH_MS;
        });
        const freshSkipped = preparedCourses.length - staleCourses.length;
        const courseCount = staleCourses.length;

        if (!courseCount) {
          await refreshData();
          setActionMessage(`${label} is already fresh. Try again in a minute if Canvas just changed.`);
          return;
        }

        if (freshSkipped > 0) {
          setActionMessage(`Skipping ${freshSkipped} recently refreshed courses, checking ${courseCount} stale courses...`);
        }

        const { successfulCourses, assignmentCount, changes, warnings } = await runCourseRefreshQueue({
          courses: staleCourses,
          includeResources: false,
          syncScope,
          onProgress: setActionMessage,
        });

        const finishedAt = Date.now();
        for (const course of staleCourses) {
          if (warnings.some((warning) => warning.startsWith(`${course.name}:`))) continue;
          refreshCache[pageRefreshCacheKey(syncScope, course.canvasCourseId)] = finishedAt;
        }
        writePageRefreshCache(refreshCache);

        const syncError =
          courseCount > 0 && successfulCourses === 0
            ? warnings[0] || `No Canvas courses refreshed for ${itemLabel}.`
            : null;

        await apiJson("/api/canvas/sync/finish", {
          method: "POST",
          body: JSON.stringify({
            syncError,
            successfulCourses,
            totalCourses: courseCount,
            changeCount: changes.length,
            warnings: warnings.slice(0, 10),
          }),
        });

        await refreshData();
        if (syncError) {
          const detail = warnings[0] ? ` ${warnings[0]}` : "";
          setActionMessage(`${label} could not finish any courses.${detail}`);
        } else {
          const refreshedText = isAssignments ? `${assignmentCount} assignments checked` : `${changes.length} changes detected`;
          const warningText = warnings.length ? ` ${warnings.length} course warnings were kept.` : "";
          const skippedText = freshSkipped ? ` ${freshSkipped} fresh courses skipped.` : "";
          setActionMessage(
            `${label} complete: ${successfulCourses}/${courseCount} stale courses refreshed, ${refreshedText}.${skippedText}${warningText}`,
          );
        }
      } catch (error) {
        setActionMessage(error instanceof Error ? error.message : `${label} failed.`);
      } finally {
        setIsSyncing(false);
        endOperation(operation);
      }
    },
    [beginOperation, courses, endOperation, refreshData],
  );

  useEffect(() => {
    if (loading || isSyncing || activeOperation || autoSyncStartedRef.current) return;
    if (!dashboard.canvasConfigured || dashboard.syncStatus === "syncing") return;
    if (!dashboard.stale && dashboard.lastSuccessfulSyncAt) return;

    autoSyncStartedRef.current = true;
    setActionMessage("Auto-syncing Canvas because your dashboard needs fresh data...");
    void syncCanvas();
  }, [
    dashboard.canvasConfigured,
    dashboard.lastSuccessfulSyncAt,
    dashboard.stale,
    dashboard.syncStatus,
    activeOperation,
    isSyncing,
    loading,
    syncCanvas,
  ]);

  const generateBrief = useCallback(async () => {
    const operation = beginOperation({ type: "brief", label: "Daily brief generation", view: "dashboard" });
    if (!operation) return;
    setIsGeneratingBrief(true);
    setActionMessage("Generating your daily Canvas brief...");
    try {
      const payload = await apiJson<{ brief: DailyBrief["generatedJson"] }>("/api/daily-brief/generate", {
        method: "POST",
      });
      setDailyBrief({
        summary: payload.brief?.summary || "Brief generated.",
        riskLevel: payload.brief?.riskLevel || dashboard.riskLevel,
        generatedJson: payload.brief,
      });
      await refreshData();
      setActionMessage("Daily brief updated from your latest Canvas data.");
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "Daily brief generation failed.");
    } finally {
      setIsGeneratingBrief(false);
      endOperation(operation);
    }
  }, [beginOperation, dashboard.riskLevel, endOperation, refreshData]);

  const createStudySession = useCallback(
    async (input: CreateStudySessionInput) => {
      const operation = beginOperation({ type: "session", label: "Study session planning", view: "sessions" });
      if (!operation) return;
      setIsCreatingSession(true);
      setActionMessage(input.assignmentId ? "Building a Canvas-specific study session..." : "Saving your custom focus session...");
      try {
        const payload = await apiJson<{ ok: boolean; plan: StudyPlan; session?: StudySessionRecord | null }>("/api/study-sessions", {
          method: "POST",
          body: JSON.stringify(input),
        });
        if (payload.session) {
          setStudySessions((current) => upsertStudySession(current, payload.session as StudySessionRecord));
        }
        try {
          await refreshData();
        } catch {
          // The session is already saved; keep the UI responsive even if a secondary dashboard refresh fails.
        }
        setSelectedAssignmentId(input.assignmentId || null);
        setActiveView("sessions");
        setActionMessage(
          input.assignmentId
            ? "Study session created from assignment details, rubric, files, and recent course context."
            : "Custom focus plan created. Review the blocks, tweak anything you want, then start the timer when it feels right.",
        );
      } catch (error) {
        setActionMessage(error instanceof Error ? error.message : "Study session creation failed.");
      } finally {
        setIsCreatingSession(false);
        endOperation(operation);
      }
    },
    [beginOperation, endOperation, refreshData],
  );

  const removeAssignmentEverywhere = useCallback((assignmentId: string) => {
    const removedAssignments = [
      ...assignments,
      ...(dashboard.priorityItems || []),
      ...dashboard.dueToday,
      ...dashboard.dueThisWeek,
      ...dashboard.unsubmitted,
    ].filter((assignment) => assignment.id === assignmentId);
    setAssignments((current) => current.filter((assignment) => assignment.id !== assignmentId));
    setFiles((current) => current.filter((file) => file.assignmentId !== assignmentId));
    setDashboard((current) =>
      removeDashboardAssignments(current, (assignment) => assignment.id === assignmentId, {
        reduceAssignmentCount: true,
      }),
    );
    setDailyBrief((current) => scrubDailyBriefAssignments(current, removedAssignments));
  }, [assignments, dashboard.dueThisWeek, dashboard.dueToday, dashboard.priorityItems, dashboard.unsubmitted]);

  const removeCourseAssignmentsEverywhere = useCallback(
    (courseId: string) => {
      const courseName = courses.find((course) => course.id === courseId)?.name;
      const matchesCourse = (assignment: AssignmentSummary) => assignmentBelongsToCourse(assignment, courseId, courseName);
      const removedAssignments = [
        ...assignments,
        ...(dashboard.priorityItems || []),
        ...dashboard.dueToday,
        ...dashboard.dueThisWeek,
        ...dashboard.unsubmitted,
      ].filter(matchesCourse);
      const removedAssignmentIds = new Set(removedAssignments.map((assignment) => assignment.id));

      setAssignments((current) => current.filter((assignment) => !matchesCourse(assignment)));
      setFiles((current) => current.filter((file) => !file.assignmentId || !removedAssignmentIds.has(file.assignmentId)));
      setDashboard((current) =>
        removeDashboardAssignments(current, matchesCourse, {
          reduceAssignmentCount: true,
        }),
      );
      setDailyBrief((current) => scrubDailyBriefAssignments(current, removedAssignments));
    },
    [assignments, courses, dashboard.dueThisWeek, dashboard.dueToday, dashboard.priorityItems, dashboard.unsubmitted],
  );

  const removeCourseEverywhere = useCallback(
    (courseId: string) => {
      const course = courses.find((item) => item.id === courseId) || null;
      const courseName = course?.name;
      const matchesCourse = (assignment: AssignmentSummary) => assignmentBelongsToCourse(assignment, courseId, courseName);
      const removedAssignments = [
        ...assignments,
        ...(dashboard.priorityItems || []),
        ...dashboard.dueToday,
        ...dashboard.dueThisWeek,
        ...dashboard.unsubmitted,
      ].filter(matchesCourse);

      setCourses((current) => current.filter((course) => course.id !== courseId));
      setAssignments((current) => current.filter((assignment) => !matchesCourse(assignment)));
      setFiles((current) =>
        current.filter((file) => file.courseId !== courseId && (!courseName || file.courseName !== courseName)),
      );
      setAnnouncements((current) => current.filter((announcement) => !courseName || announcement.courseName !== courseName));
      setDashboard((current) => removeCourseDashboardData(current, course));
      setDailyBrief((current) => scrubDailyBriefAssignments(current, removedAssignments));
    },
    [assignments, courses, dashboard.dueThisWeek, dashboard.dueToday, dashboard.priorityItems, dashboard.unsubmitted],
  );

  const updateDashboardScope = useCallback(
    async (body: { action: "hide_course"; courseId: string } | { action: "hide_assignment"; assignmentId: string } | { action: "reset" }) => {
      const hiddenAssignmentIds = new Set([
        ...dashboardScope.excludedAssignmentIds,
        ...dashboardScope.hiddenAssignments.map((assignment) => assignment.id),
      ]);
      const hiddenCourseIds = new Set([
        ...dashboardScope.excludedCourseIds,
        ...dashboardScope.hiddenCourses.map((course) => course.id),
      ]);

      if (body.action === "hide_assignment" && hiddenAssignmentIds.has(body.assignmentId)) {
        removeAssignmentEverywhere(body.assignmentId);
        setActionMessage("That assignment is already hidden from the dashboard.");
        return;
      }
      if (body.action === "hide_course" && hiddenCourseIds.has(body.courseId)) {
        removeCourseEverywhere(body.courseId);
        setActionMessage("That course is already hidden from the dashboard.");
        return;
      }
      if (body.action === "reset" && !dashboardScope.hiddenCourses.length && !dashboardScope.hiddenAssignments.length) {
        setActionMessage("Dashboard scope is already showing everything.");
        return;
      }

      const operation = beginOperation({ type: "scope", label: "Dashboard scope update", view: activeView });
      if (!operation) return;
      setActionMessage("Updating what appears on your dashboard...");
      try {
        const updated = await apiJson<DashboardScopeSummary>("/api/preferences", {
          method: "PATCH",
          body: JSON.stringify(body),
        });
        setDashboardScope(updated);
        if (body.action === "hide_assignment") removeAssignmentEverywhere(body.assignmentId);
        if (body.action === "hide_course") removeCourseEverywhere(body.courseId);
        setActionMessage(
          body.action === "reset"
            ? "Dashboard scope reset. The next sync will include all visible Canvas courses and assignments again."
            : "Removed from your dashboard scope. Future Canvas syncs will skip it unless you reset the scope.",
        );
        await refreshData();
      } catch (error) {
        setActionMessage(error instanceof Error ? error.message : "Could not update dashboard scope.");
      } finally {
        endOperation(operation);
      }
    },
    [activeView, beginOperation, dashboardScope, endOperation, refreshData, removeAssignmentEverywhere, removeCourseEverywhere],
  );

  const updateStudySession = useCallback(
    async (sessionId: string, generatedPlanJson: StudyPlan, status?: string) => {
      const updated = await apiJson<StudySessionRecord>(`/api/study-sessions/${sessionId}`, {
        method: "PATCH",
        body: JSON.stringify({ generatedPlanJson, status }),
      });
      setStudySessions((current) => current.map((session) => (session.id === updated.id ? updated : session)));
    },
    [],
  );

  const updateStudySessionMeta = useCallback(
    async (sessionId: string, updates: StudySessionUpdateInput) => {
      const operation = beginOperation({ type: "session", label: "Study session save", view: "sessions" });
      if (!operation) return;
      setActionMessage("Saving study session changes...");
      try {
        const updated = await apiJson<StudySessionRecord>(`/api/study-sessions/${sessionId}`, {
          method: "PATCH",
          body: JSON.stringify(updates),
        });
        setStudySessions((current) => current.map((session) => (session.id === updated.id ? updated : session)));
        setActionMessage("Study session updated.");
        void refreshData().catch((error) => {
          setActionMessage(error instanceof Error ? error.message : "Study session saved, but refresh failed.");
        });
      } catch (error) {
        setActionMessage(error instanceof Error ? error.message : "Could not save study session changes.");
      } finally {
        endOperation(operation);
      }
    },
    [beginOperation, endOperation, refreshData],
  );

  const updateAssignmentStatus = useCallback(
    async (assignmentId: string, status: "open" | "submitted_elsewhere") => {
      const operation = beginOperation({ type: "assignment_status", label: "Assignment status update", view: "assignments" });
      if (!operation) return;
      setActionMessage(status === "submitted_elsewhere" ? "Marking assignment done locally..." : "Reopening assignment locally...");
      try {
        await apiJson<{ ok: boolean }>(`/api/assignments/${assignmentId}/status`, {
          method: "PATCH",
          body: JSON.stringify({ status }),
        });
        if (status === "submitted_elsewhere") {
          const submittedAt = new Date().toISOString();
          const submittedAssignments = assignments
            .filter((assignment) => assignment.id === assignmentId)
            .map((assignment) => markAssignmentSubmittedElsewhere(assignment, submittedAt));
          setAssignments((current) =>
            current.map((assignment) =>
              assignment.id === assignmentId
                ? markAssignmentSubmittedElsewhere(assignment, submittedAt)
                : assignment,
            ),
          );
          setDashboard((current) => removeDashboardAssignments(current, (assignment) => assignment.id === assignmentId));
          setDailyBrief((current) => scrubDailyBriefAssignments(current, submittedAssignments));
        }
        setActionMessage(
          status === "submitted_elsewhere"
            ? "Marked done locally. Canvas stays read-only, so this does not submit anything."
            : "Assignment reopened locally. Your next Canvas sync can still update the real Canvas status.",
        );
        void refreshData().catch((error) => {
          setActionMessage(error instanceof Error ? error.message : "Saved locally, but refresh failed.");
        });
      } catch (error) {
        setActionMessage(error instanceof Error ? error.message : "Could not update assignment status.");
      } finally {
        endOperation(operation);
      }
    },
    [assignments, beginOperation, endOperation, refreshData],
  );

  const uploadMaterial = useCallback(
    async (input: { file?: File | null; title?: string; notes?: string; courseId?: string; assignmentId?: string }) => {
      const operation = beginOperation({ type: "upload", label: "Study material upload", view: "files" });
      if (!operation) return;
      setActionMessage("Indexing your study material for Files, AI chat, and study sessions...");
      const formData = new FormData();
      if (input.file) formData.append("file", input.file);
      if (input.title) formData.append("title", input.title);
      if (input.notes) formData.append("notes", input.notes);
      if (input.courseId) formData.append("courseId", input.courseId);
      if (input.assignmentId) formData.append("assignmentId", input.assignmentId);

      try {
        const result = await apiJson<{ id: string; name: string; hasIndexedText: boolean; deepReadStatus?: string }>("/api/uploads", {
          method: "POST",
          body: formData,
        });
        await refreshData();
        setActionMessage(
          result.deepReadStatus === "gemini_file"
            ? "Material saved for Gemini deep reading. AI chat and new study sessions can now inspect it alongside Canvas context."
            : "Material saved. AI chat and new study sessions can now use it alongside Canvas assignments, courses, and announcements.",
        );
      } catch (error) {
        setActionMessage(error instanceof Error ? error.message : "Material upload failed.");
        throw error;
      } finally {
        endOperation(operation);
      }
    },
    [beginOperation, endOperation, refreshData],
  );

  const connectCanvas = useCallback(
    async (canvasBaseUrl: string, accessToken: string) => {
      const operation = beginOperation({ type: "canvas_connection", label: "Canvas connection update", view: "settings" });
      if (!operation) return;
      setActionMessage("Validating and saving your Canvas token server-side...");
      try {
        await apiJson<{ ok: boolean }>("/api/onboarding/connect-canvas", {
          method: "POST",
          body: JSON.stringify({ canvasBaseUrl, accessToken }),
        });
        await refreshData();
        setActionMessage("Canvas connected. Run Sync now when you are ready to import courses, assignments, files, and announcements.");
      } finally {
        endOperation(operation);
      }
    },
    [beginOperation, endOperation, refreshData],
  );

  const resetCanvasConnection = useCallback(async () => {
    const operation = beginOperation({ type: "canvas_connection", label: "Canvas connection reset", view: "settings" });
    if (!operation) return;
    setActionMessage("Clearing the saved Canvas connection and synced Canvas data...");
    try {
      await apiJson<{ ok: boolean }>("/api/onboarding/connect-canvas", { method: "DELETE" });
      await refreshData();
      setAssignments([]);
      setCourses([]);
      setAnnouncements([]);
      setSelectedAssignmentId(null);
      setActionMessage(
        "Canvas connection reset. Paste a fresh Canvas token in Settings, then run Sync now. Manual uploads and study sessions stay in the app.",
      );
    } finally {
      endOperation(operation);
    }
  }, [beginOperation, endOperation, refreshData]);

  const updateProfileName = useCallback(
    async (name: string) => {
      const operation = beginOperation({ type: "profile", label: "Profile update", view: "settings" });
      if (!operation) return;
      setActionMessage("Saving your display name...");
      try {
        await apiJson<{ name: string }>("/api/profile", {
          method: "PATCH",
          body: JSON.stringify({ name }),
        });
        setDashboard((current) => ({ ...current, userName: name.trim().split(/\s+/)[0] || current.userName }));
        setActionMessage("Display name saved.");
        void refreshData().catch((error) => {
          setActionMessage(error instanceof Error ? error.message : "Display name saved, but refresh failed.");
        });
      } finally {
        endOperation(operation);
      }
    },
    [beginOperation, endOperation, refreshData],
  );

  const applyChatResponse = useCallback(
    (pendingId: string, payload: ChatApiResponse) => {
      setChatProviderStatus(
        payload.provider === "agent"
          ? payload.confirmation
            ? "Waiting for your confirmation"
            : "Using Study Agent tools"
          : payload.provider === "gemini"
            ? `Using Gemini ${payload.model || ""}`.trim()
            : payload.reason
              ? `Using grounded fallback: ${payload.reason}`
              : "Using grounded fallback",
      );
      setChatMessages((current) =>
        current.map((item) =>
          item.id === pendingId
            ? {
                ...item,
                content: payload.answer,
                provider: payload.provider,
                model: payload.model,
                confirmation: payload.confirmation,
                confirmationStatus: payload.confirmation ? ("pending" as const) : undefined,
              }
            : item,
        ),
      );
      if (activeViewRef.current !== "chat") {
        setChatNotice(
          payload.confirmation
            ? {
                title: "Sidekick is waiting for your response",
                body: "It found a safe study action. Open AI Chat to confirm or cancel before anything changes.",
                tone: "waiting",
              }
            : {
                title: "Sidekick found what you asked for",
                body: "Open AI Chat to read the answer when you are ready.",
                tone: "found",
              },
        );
      }
      if (payload.agentEvents?.length) {
        payload.agentEvents.forEach((event) => {
          if (event.type === "dashboard_item_hidden") {
            if (event.itemType === "assignment" && event.itemId) removeAssignmentEverywhere(event.itemId);
            if (event.itemType === "assignment_group" && event.itemId) removeCourseAssignmentsEverywhere(event.itemId);
            if (event.itemType === "course" && event.itemId) removeCourseEverywhere(event.itemId);
          }
        });
        const firstEvent = payload.agentEvents[0];
        setActionMessage(firstEvent.label);
        if (firstEvent.assignmentId || (firstEvent.itemType === "assignment" && firstEvent.itemId)) {
          setSelectedAssignmentId(firstEvent.assignmentId || firstEvent.itemId || null);
        }
        if (firstEvent.view === "sessions") setActiveView("sessions");
        void refreshData().catch((error) => {
          setActionMessage(error instanceof Error ? error.message : "Agent action completed, but refresh failed.");
        });
      }
    },
    [refreshData, removeAssignmentEverywhere, removeCourseAssignmentsEverywhere, removeCourseEverywhere],
  );

  const sendChatMessage = useCallback(
    async (message: string) => {
      const trimmed = message.trim();
      if (!trimmed) return;
      if (chatSendingRef.current) {
        setActionMessage("Sidekick is already thinking. Wait for this answer before sending another one.");
        return;
      }
      chatSendingRef.current = true;
      setIsChatSending(true);
      const now = Date.now();
      const userMessage: ChatMessage = { id: crypto.randomUUID(), role: "user", content: trimmed, createdAt: now };
      const pendingId = crypto.randomUUID();
      const recentMessages = recentChatContextMessages(chatMessages);
      setChatMessages((current) => [
        ...pruneChatMessages(current),
        userMessage,
        {
          id: pendingId,
          role: "assistant",
          createdAt: now,
          content: "__sidekick_working__",
        },
      ]);
      setChatDraft("");
      setActiveView("chat");

      try {
        const payload = await apiJson<ChatApiResponse>("/api/chat", {
          method: "POST",
          body: JSON.stringify({ message: trimmed, recentMessages }),
        });
        applyChatResponse(pendingId, payload);
      } catch (error) {
        setChatMessages((current) =>
          current.map((item) =>
            item.id === pendingId
              ? { ...item, content: error instanceof Error ? error.message : "Chat request failed." }
              : item,
          ),
        );
      } finally {
        chatSendingRef.current = false;
        setIsChatSending(false);
      }
    },
    [applyChatResponse, chatMessages],
  );

  const confirmAgentAction = useCallback(
    async (messageId: string, token: string) => {
      if (!token) return;
      const operation = beginOperation({ type: "agent_action", label: "Study Agent action", view: "chat" });
      if (!operation) return;
      if (chatSendingRef.current) {
        setActionMessage("Sidekick is already working on an action. Wait for it to finish first.");
        endOperation(operation);
        return;
      }
      chatSendingRef.current = true;
      setIsChatSending(true);
      setChatNotice(null);
      const pendingId = crypto.randomUUID();
      const now = Date.now();
      setChatMessages((current) => [
        ...current.map((message) =>
          message.id === messageId ? { ...message, confirmationStatus: "confirmed" as const } : message,
        ),
        {
          id: pendingId,
          role: "assistant",
          createdAt: now,
          content: "Confirmed. I'm running that Study Agent action now.",
          provider: "agent" as const,
        },
      ]);
      setChatProviderStatus("Running Study Agent action");
      setActiveView("chat");

      try {
        const payload = await apiJson<ChatApiResponse>("/api/chat", {
          method: "POST",
          body: JSON.stringify({ confirmationToken: token }),
        });
        applyChatResponse(pendingId, payload);
      } catch (error) {
        setChatMessages((current) =>
          current.map((message) =>
            message.id === pendingId
              ? {
                  ...message,
                  content: error instanceof Error ? error.message : "Could not run the confirmed action.",
                  provider: "agent",
                }
              : message,
          ),
        );
      } finally {
        chatSendingRef.current = false;
        setIsChatSending(false);
        endOperation(operation);
      }
    },
    [applyChatResponse, beginOperation, endOperation],
  );

  const cancelAgentAction = useCallback((messageId: string) => {
    setChatNotice(null);
    setChatMessages((current) =>
      current.map((message) =>
        message.id === messageId
          ? {
              ...message,
              content: "No problem. I cancelled that action and did not change anything.",
              confirmationStatus: "cancelled" as const,
            }
          : message,
      ),
    );
    setChatProviderStatus("Action cancelled");
  }, []);

  const logOut = useCallback(async () => {
    window.localStorage.removeItem(CHAT_STORAGE_KEY);
    await apiJson<{ ok: boolean }>("/api/auth/logout", { method: "POST" }).catch(() => ({ ok: true }));
    window.location.href = "/login";
  }, []);

  const openChat = useCallback(
    (message?: string) => {
      setActiveView("chat");
      if (message) setChatDraft(message);
    },
    [],
  );

  const startSession = useCallback(() => {
    setActiveView("sessions");
    setSelectedAssignmentId((current) => current || assignments[0]?.id || null);
    if (!assignments.length) {
      setActionMessage("Sync Canvas first, then I can build a focus session from a real assignment.");
    }
  }, [assignments]);

  const hiddenAssignmentIds = useMemo(
    () => Array.from(new Set([...dashboardScope.excludedAssignmentIds, ...dashboardScope.hiddenAssignments.map((assignment) => assignment.id)])),
    [dashboardScope.excludedAssignmentIds, dashboardScope.hiddenAssignments],
  );
  const hiddenCourseIds = useMemo(
    () => Array.from(new Set([...dashboardScope.excludedCourseIds, ...dashboardScope.hiddenCourses.map((course) => course.id)])),
    [dashboardScope.excludedCourseIds, dashboardScope.hiddenCourses],
  );
  const disabledReason = activeOperation
    ? `${activeOperation.label} is running. Wait for it to finish before starting another update.`
    : null;
  const hasPendingChatConfirmation = useMemo(
    () => chatMessages.some((message) => message.confirmation && message.confirmationStatus === "pending"),
    [chatMessages],
  );
  const chatNeedsAttention = activeView !== "chat" && (hasPendingChatConfirmation || Boolean(chatNotice));
  const focusResumeSecondsLeft = focusResumePrompt ? focusTimerSecondsLeft(focusResumePrompt, focusResumeNow) : 0;
  const showFocusResumePrompt = Boolean(
    focusResumePrompt && isFocusTimerSnapshotVisible(focusResumePrompt, focusResumeNow),
  );

  useEffect(() => {
    if (activeView === "chat" || !hasPendingChatConfirmation || chatNotice) return;
    setChatNotice({
      title: "Sidekick is waiting for your response",
      body: "There is a pending study action in AI Chat. Confirm it when you are ready.",
      tone: "waiting",
    });
  }, [activeView, chatNotice, hasPendingChatConfirmation]);

  const actions: StudySidekickActions = useMemo(
    () => ({
      onNavigate: setActiveView,
      onGenerateBrief: generateBrief,
      onSyncCanvas: syncCanvas,
      onSyncAssignments: () => void syncCanvasPage("assignments"),
      onSyncAnnouncements: () => void syncCanvasPage("announcements"),
      onStartSession: startSession,
      onOpenAnnouncements: () => setActiveView("announcements"),
      onOpenSettings: () => setActiveView("settings"),
      onOpenChat: openChat,
      onUploadMaterial: uploadMaterial,
      actionMessage,
      isGeneratingBrief,
      isSyncing,
      isSyncingAssignments: activeOperation?.type === "sync" && activeOperation.view === "assignments",
      isSyncingAnnouncements: activeOperation?.type === "sync" && activeOperation.view === "announcements",
      isBusy: Boolean(activeOperation),
      disabledReason,
      activeOperation,
    }),
    [
      actionMessage,
      activeOperation,
      disabledReason,
      generateBrief,
      isGeneratingBrief,
      isSyncing,
      openChat,
      startSession,
      syncCanvas,
      syncCanvasPage,
      uploadMaterial,
    ],
  );

  const mobileItems: Array<{ view: ViewType; icon: string }> = [
    { view: "dashboard", icon: "dashboard" },
    { view: "assignments", icon: "assignment" },
    { view: "courses", icon: "school" },
    { view: "chat", icon: "smart_toy" },
  ];

  return (
    <div className="bg-background text-on-background font-body-md min-h-screen flex w-full selection:bg-primary/20">
      <SideNav
        activeView={activeView}
        onNavigate={setActiveView}
        onStartSession={startSession}
        onSupport={() => setActiveView("support")}
        onLogout={logOut}
        chatAttention={chatNeedsAttention}
      />

      <div className="fixed bottom-0 left-0 right-0 md:hidden bg-surface-container border-t-2 border-surface-variant z-50 p-sm flex justify-around">
        {mobileItems.map((item) => (
          <button
            key={item.view}
            type="button"
            onClick={() => setActiveView(item.view)}
            className={`relative p-sm rounded-lg flex flex-col items-center ${activeView === item.view ? "text-primary bg-primary-container" : "text-on-surface-variant"}`}
            aria-label={`Open ${item.view}`}
          >
            <span className="material-symbols-outlined text-[24px]">{item.icon}</span>
            {item.view === "chat" && chatNeedsAttention ? (
              <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-surface-container" />
            ) : null}
          </button>
        ))}
      </div>

      <main className="md:pl-[280px] flex-grow flex flex-col min-h-screen pb-16 md:pb-0 relative w-full">
        {chatNotice && activeView !== "chat" ? (
          <button
            type="button"
            className="fixed bottom-24 right-6 z-[70] max-w-sm rounded-lg border-2 border-primary-fixed-dim bg-surface-container-lowest p-md text-left shadow-xl transition-transform hover:scale-[1.01] active:scale-[0.99]"
            onClick={() => {
              setActiveView("chat");
              setChatNotice(null);
            }}
          >
            <div className="flex items-start gap-sm">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-container text-primary">
                <span className="material-symbols-outlined text-[20px]">
                  {chatNotice.tone === "waiting" ? "mark_chat_unread" : "auto_awesome"}
                </span>
              </div>
              <div>
                <p className="font-label-lg text-label-lg font-bold text-primary">{chatNotice.title}</p>
                <p className="mt-xs font-body-sm text-body-sm text-on-surface-variant">{chatNotice.body}</p>
              </div>
            </div>
          </button>
        ) : null}
        {showFocusResumePrompt && focusResumePrompt ? (
          <div className="fixed bottom-44 right-6 z-[70] w-[min(23rem,calc(100vw-2rem))] rounded-lg border-2 border-primary-fixed-dim bg-surface-container-lowest/95 p-md shadow-xl backdrop-blur-md md:bottom-28">
            <div className="flex items-start gap-sm">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-container text-primary">
                <span className="material-symbols-outlined text-[22px]">restore</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-label-lg text-label-lg font-bold text-primary">Resume focus session?</p>
                <p className="mt-xs font-body-sm text-body-sm text-on-surface-variant">
                  Your timer was saved. {focusClock(focusResumeSecondsLeft)} left on{" "}
                  <span className="font-bold text-on-surface">{focusResumePrompt.blockName}</span>.
                </p>
                <div className="mt-md flex flex-wrap gap-sm">
                  <button
                    type="button"
                    className="rounded-full bg-primary px-md py-xs font-label-md text-label-md font-bold text-on-primary transition-transform active:scale-95"
                    onClick={() => {
                      const href = focusTimerResumeHref(focusResumePrompt);
                      setFocusResumePrompt(null);
                      window.location.assign(href);
                    }}
                  >
                    Resume
                  </button>
                  <button
                    type="button"
                    className="rounded-full border border-surface-variant bg-surface-container px-md py-xs font-label-md text-label-md text-on-surface transition-colors hover:bg-primary-container"
                    onClick={() => setFocusResumePrompt(null)}
                  >
                    Keep hidden
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
        <FocusMiniTimer onOpen={() => setActiveView("sessions")} />
        {loading ? (
          <div className="min-h-screen flex items-center justify-center p-lg">
            <div className="sticky-note-mint p-lg rounded-lg bubbly-shadow text-center">
              <span className="material-symbols-outlined text-primary text-[48px] animate-pulse">sync</span>
              <p className="font-headline-md text-headline-md text-primary mt-sm">Loading your study command centre...</p>
            </div>
          </div>
        ) : (
          <div className="w-full flex-grow flex flex-col">
            {activeView === "dashboard" && (
              <DashboardView
                dashboard={dashboard}
                dailyBrief={dailyBrief}
                sessions={studySessions}
                actions={actions}
                onCreateSession={(assignmentId) =>
                  createStudySession({
                    assignmentId,
                    durationMinutes: 60,
                    mode: "Plan assignment",
                    energyLevel: "Medium",
                    targetOutcome: "Credit",
                  })
                }
              />
            )}
            {activeView === "assignments" && (
              <AssignmentsView
                assignments={assignments}
                courses={courses}
                actions={actions}
                onCreateSession={(assignmentId) =>
                  createStudySession({
                    assignmentId,
                    durationMinutes: 60,
                    mode: "Plan assignment",
                    energyLevel: "Medium",
                    targetOutcome: "Credit",
                  })
                }
                onSelectAssignment={(assignmentId) => {
                  setSelectedAssignmentId(assignmentId);
                  setActiveView("sessions");
                }}
                onUpdateAssignmentStatus={updateAssignmentStatus}
                onHideAssignment={(assignmentId) => updateDashboardScope({ action: "hide_assignment", assignmentId })}
                isCreatingSession={isCreatingSession}
                hiddenAssignmentIds={hiddenAssignmentIds}
              />
            )}
            {activeView === "courses" && (
              <CoursesView
                courses={courses}
                assignments={assignments}
                files={files}
                actions={actions}
                onCourseFiles={() => setActiveView("files")}
                onCourseTasks={() => setActiveView("assignments")}
                onHideCourse={(courseId) => updateDashboardScope({ action: "hide_course", courseId })}
                hiddenCourseIds={hiddenCourseIds}
              />
            )}
            {activeView === "announcements" && (
              <AnnouncementsView announcements={announcements} courses={courses} actions={actions} />
            )}
            {activeView === "files" && <FilesView files={files} courses={courses} actions={actions} />}
            {activeView === "sessions" && (
              <StudySessionsView
                assignments={assignments}
                sessions={studySessions}
                selectedAssignmentId={selectedAssignmentId}
                onSelectAssignment={setSelectedAssignmentId}
                onCreateSession={createStudySession}
                onUpdateSession={updateStudySession}
                onUpdateSessionMeta={updateStudySessionMeta}
                onUpdateAssignmentStatus={updateAssignmentStatus}
                isCreatingSession={isCreatingSession}
                actions={actions}
              />
            )}
            {activeView === "risk" && (
              <RiskView
                assignments={assignments}
                dashboard={dashboard}
                actions={actions}
                isCreatingSession={isCreatingSession}
                onCreateSession={(assignmentId) =>
                  createStudySession({
                    assignmentId,
                    durationMinutes: 50,
                    mode: "Plan assignment",
                    energyLevel: "Medium",
                    targetOutcome: "Credit",
                  })
                }
              />
            )}
            {activeView === "streak" && (
              <FocusStreakView
                assignments={assignments}
                dashboard={dashboard}
                sessions={studySessions}
                actions={actions}
              />
            )}
            {activeView === "chat" && (
              <AiChatView
                messages={chatMessages}
                courses={courses}
                draft={chatDraft}
                onDraftChange={setChatDraft}
                onSend={sendChatMessage}
                onConfirmAction={confirmAgentAction}
                onCancelAction={cancelAgentAction}
                actions={actions}
                isSending={isChatSending}
                chatProviderStatus={chatProviderStatus}
              />
            )}
            {activeView === "settings" && (
              <SettingsView
                dashboard={dashboard}
                scope={dashboardScope}
                actions={actions}
                onConnectCanvas={connectCanvas}
                onResetCanvasConnection={resetCanvasConnection}
                onUpdateProfileName={updateProfileName}
                onResetDashboardScope={() => updateDashboardScope({ action: "reset" })}
                onLogout={logOut}
              />
            )}
            {activeView === "support" && <SupportView dashboard={dashboard} actions={actions} />}
          </div>
        )}
      </main>
    </div>
  );
}
