"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { type ViewType } from "./lib/utils";
import SideNav from "./components/SideNav";
import DashboardView from "./views/DashboardView";
import AssignmentsView from "./views/AssignmentsView";
import CoursesView from "./views/CoursesView";
import AnnouncementsView from "./views/AnnouncementsView";
import FilesView from "./views/FilesView";
import StudySessionsView from "./views/StudySessionsView";
import AiChatView, { type ChatMessage } from "./views/AiChatView";
import SettingsView from "./views/SettingsView";
import type {
  AnnouncementSummary,
  AssignmentSummary,
  CourseSummary,
  CreateStudySessionInput,
  DailyBrief,
  DashboardSummary,
  FileSummary,
  StudyPlan,
  StudySessionRecord,
  StudySidekickActions,
} from "./types";

async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  if (response.status === 401) {
    window.location.href = "/login";
    throw new Error("Authentication required");
  }

  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error || "Request failed");
  }
  return payload;
}

const emptyDashboard: DashboardSummary = {
  userName: "Nathaniel",
  timezone: "Australia/Sydney",
  lastSyncAt: null,
  canvasConfigured: false,
  stale: true,
  todayMission: ["Sync Canvas to build today's mission."],
  dueToday: [],
  dueThisWeek: [],
  unsubmitted: [],
  announcements: [],
  files: [],
  riskLevel: "low",
};

export default function App({ initialView = "dashboard" }: { initialView?: ViewType }) {
  const [activeView, setActiveView] = useState<ViewType>(initialView);
  const [dashboard, setDashboard] = useState<DashboardSummary>(emptyDashboard);
  const [assignments, setAssignments] = useState<AssignmentSummary[]>([]);
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementSummary[]>([]);
  const [files, setFiles] = useState<FileSummary[]>([]);
  const [studySessions, setStudySessions] = useState<StudySessionRecord[]>([]);
  const [dailyBrief, setDailyBrief] = useState<DailyBrief | null>(null);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isGeneratingBrief, setIsGeneratingBrief] = useState(false);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [chatDraft, setChatDraft] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hi Nathaniel. Ask me about what is due, what changed, or which assignment needs a battle plan. I will answer from your synced Canvas data.",
    },
  ]);

  const refreshData = useCallback(async () => {
    const [dashboardData, assignmentData, courseData, announcementData, fileData, sessionData, briefData] =
      await Promise.all([
        apiJson<DashboardSummary>("/api/dashboard"),
        apiJson<AssignmentSummary[]>("/api/assignments"),
        apiJson<CourseSummary[]>("/api/courses"),
        apiJson<AnnouncementSummary[]>("/api/announcements"),
        apiJson<FileSummary[]>("/api/files"),
        apiJson<StudySessionRecord[]>("/api/study-sessions"),
        apiJson<{ brief: DailyBrief | null }>("/api/daily-brief"),
      ]);

    setDashboard(dashboardData);
    setAssignments(assignmentData);
    setCourses(courseData);
    setAnnouncements(announcementData);
    setFiles(fileData);
    setStudySessions(sessionData);
    setDailyBrief(briefData.brief);
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
    setIsSyncing(true);
    setActionMessage("Syncing Canvas courses, assignments, files, modules, and announcements...");
    try {
      const summary = await apiJson<{ courses: number; changes?: Array<{ label: string }> }>("/api/canvas/sync", {
        method: "POST",
      });
      await refreshData();
      const changeCount = summary.changes?.length || 0;
      setActionMessage(`Canvas sync complete: ${summary.courses} courses checked, ${changeCount} changes detected.`);
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "Canvas sync failed.");
    } finally {
      setIsSyncing(false);
    }
  }, [refreshData]);

  const generateBrief = useCallback(async () => {
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
    }
  }, [dashboard.riskLevel, refreshData]);

  const createStudySession = useCallback(
    async (input: CreateStudySessionInput) => {
      setIsCreatingSession(true);
      setActionMessage("Building a Canvas-specific study session...");
      try {
        await apiJson<{ ok: boolean; plan: StudyPlan }>("/api/study-sessions", {
          method: "POST",
          body: JSON.stringify(input),
        });
        await refreshData();
        setSelectedAssignmentId(input.assignmentId);
        setActiveView("sessions");
        setActionMessage("Study session created from assignment details, rubric, files, and recent course context.");
      } catch (error) {
        setActionMessage(error instanceof Error ? error.message : "Study session creation failed.");
      } finally {
        setIsCreatingSession(false);
      }
    },
    [refreshData],
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

  const connectCanvas = useCallback(
    async (canvasBaseUrl: string, accessToken: string) => {
      setActionMessage("Validating your Canvas token server-side...");
      await apiJson<{ ok: boolean }>("/api/onboarding/connect-canvas", {
        method: "POST",
        body: JSON.stringify({ canvasBaseUrl, accessToken }),
      });
      setActionMessage("Canvas connected. Starting your first sync...");
      await syncCanvas();
    },
    [syncCanvas],
  );

  const sendChatMessage = useCallback(
    async (message: string) => {
      const trimmed = message.trim();
      if (!trimmed) return;
      const userMessage: ChatMessage = { id: crypto.randomUUID(), role: "user", content: trimmed };
      const pendingId = crypto.randomUUID();
      setChatMessages((current) => [
        ...current,
        userMessage,
        { id: pendingId, role: "assistant", content: "Checking your synced Canvas data..." },
      ]);
      setChatDraft("");
      setActiveView("chat");

      try {
        const payload = await apiJson<{ answer: string; lastSyncAt?: string | null }>("/api/chat", {
          method: "POST",
          body: JSON.stringify({ message: trimmed }),
        });
        setChatMessages((current) =>
          current.map((item) =>
            item.id === pendingId
              ? {
                  ...item,
                  content: `${payload.answer}${payload.lastSyncAt ? `\n\nLast sync: ${new Date(payload.lastSyncAt).toLocaleString("en-AU")}` : "\n\nLast sync: never"}`,
                }
              : item,
          ),
        );
      } catch (error) {
        setChatMessages((current) =>
          current.map((item) =>
            item.id === pendingId
              ? { ...item, content: error instanceof Error ? error.message : "Chat request failed." }
              : item,
          ),
        );
      }
    },
    [],
  );

  const logOut = useCallback(async () => {
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

  const actions: StudySidekickActions = useMemo(
    () => ({
      onNavigate: setActiveView,
      onGenerateBrief: generateBrief,
      onSyncCanvas: syncCanvas,
      onStartSession: startSession,
      onOpenAnnouncements: () => setActiveView("announcements"),
      onOpenSettings: () => setActiveView("settings"),
      onOpenChat: openChat,
      actionMessage,
      isGeneratingBrief,
      isSyncing,
    }),
    [actionMessage, generateBrief, isGeneratingBrief, isSyncing, openChat, startSession, syncCanvas],
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
        onSupport={() => openChat("I need help with the study dashboard.")}
        onLogout={logOut}
      />

      <div className="fixed bottom-0 left-0 right-0 md:hidden bg-surface-container border-t-2 border-surface-variant z-50 p-sm flex justify-around">
        {mobileItems.map((item) => (
          <button
            key={item.view}
            type="button"
            onClick={() => setActiveView(item.view)}
            className={`p-sm rounded-lg flex flex-col items-center ${activeView === item.view ? "text-primary bg-primary-container" : "text-on-surface-variant"}`}
            aria-label={`Open ${item.view}`}
          >
            <span className="material-symbols-outlined text-[24px]">{item.icon}</span>
          </button>
        ))}
      </div>

      <main className="md:pl-[280px] flex-grow flex flex-col min-h-screen pb-16 md:pb-0 relative w-full">
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
                isCreatingSession={isCreatingSession}
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
                isCreatingSession={isCreatingSession}
                actions={actions}
              />
            )}
            {activeView === "chat" && (
              <AiChatView
                messages={chatMessages}
                draft={chatDraft}
                onDraftChange={setChatDraft}
                onSend={sendChatMessage}
                actions={actions}
              />
            )}
            {activeView === "settings" && (
              <SettingsView
                dashboard={dashboard}
                actions={actions}
                onConnectCanvas={connectCanvas}
                onLogout={logOut}
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
}
