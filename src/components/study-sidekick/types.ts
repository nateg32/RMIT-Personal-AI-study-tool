import type { ViewType } from "./lib/utils";

export type RiskLevel = "low" | "medium" | "high" | "critical";

export type AssignmentType =
  | "quiz"
  | "assignment"
  | "discussion"
  | "file_upload"
  | "external_tool"
  | "on_paper"
  | "text_entry"
  | "url"
  | "media"
  | "annotation"
  | "unknown";

export type AssignmentSummary = {
  id: string;
  courseId?: string;
  canvasAssignmentId: number;
  courseName: string;
  courseCode?: string | null;
  name: string;
  dueAt?: string | null;
  pointsPossible?: number | null;
  htmlUrl?: string | null;
  description?: string | null;
  rubricSummary?: string | null;
  submissionTypes?: string[] | null;
  assignmentType?: AssignmentType;
  priorityScore?: number;
  priorityLabel?: RiskLevel;
  priorityReason?: string;
  estimatedTime?: string;
  dueStatus?: "overdue" | "due_today" | "due_this_week" | "upcoming" | "undated" | "submitted";
  submittedAt?: string | null;
  workflowState?: string | null;
  missing?: boolean | null;
  late?: boolean | null;
};

export type CourseSummary = {
  id: string;
  canvasCourseId?: number;
  name: string;
  courseCode?: string | null;
  term?: string | null;
  active?: boolean;
};

export type AnnouncementSummary = {
  id: string;
  courseName: string;
  title: string;
  message?: string | null;
  postedAt?: string | null;
  htmlUrl?: string | null;
};

export type FileSummary = {
  id: string;
  courseName: string;
  courseId?: string | null;
  assignmentId?: string | null;
  assignmentName?: string | null;
  name: string;
  contentType?: string | null;
  size?: number | null;
  updatedAtCanvas?: string | null;
  createdAt?: string | null;
  url?: string | null;
  source?: "canvas" | "manual_upload";
  hasIndexedText?: boolean;
  excerpt?: string | null;
};

export type CourseDashboardSummary = {
  courseId: string;
  canvasCourseId?: number;
  name: string;
  courseCode?: string | null;
  term?: string | null;
  active: boolean;
  totalAssignments: number;
  submittedAssignments: number;
  unsubmittedAssignments: number;
  overdueAssignments: number;
  dueToday: number;
  dueThisWeek: number;
  recentAnnouncements: number;
  recentFiles: number;
  riskLevel: RiskLevel;
  nextAssignment?: AssignmentSummary | null;
};

export type CanvasConnectionMode = "saved_token" | "environment" | "not_connected";

export type CanvasSyncState = "not_connected" | "syncing" | "success" | "error" | "never_synced";

export type CanvasSyncSummary = {
  visibleCourses: number;
  hiddenCourses: number;
  assignments: number;
  unsubmittedAssignments: number;
  announcements: number;
  files: number;
  resources: number;
  manualMaterials: number;
};

export type StudyBlock = {
  name: string;
  minutes: number;
  tasks: string[];
  goal?: string;
  breakMinutes?: number;
  resources?: string[];
};

export type StudyPlan = {
  title: string;
  durationMinutes: number;
  riskLevel: RiskLevel;
  contextConfidence?: "high" | "medium" | "low";
  contextSummary?: string[];
  needsUserContext?: boolean;
  assignmentBrief?: string;
  rubricFocus?: string[];
  blocks: StudyBlock[];
  checklist: string[];
  definitionOfDone: string[];
  resourcesToOpen: Array<{ title: string; url?: string }>;
  suggestedBreaks?: Array<{ afterBlock: string; minutes: number; reason: string }>;
  activeBlockIndex?: number;
  completedTasks?: Record<string, boolean>;
  nextAction: string;
  riskWarning?: string;
};

export type StudySessionRecord = {
  id: string;
  assignmentId?: string | null;
  title: string;
  durationMinutes: number;
  mode: string;
  targetOutcome: string;
  energyLevel: string;
  generatedPlanJson: StudyPlan;
  status: string;
  createdAt: string;
  updatedAt?: string;
  assignment?: {
    id: string;
    name: string;
    course?: { name: string; courseCode?: string | null } | null;
  } | null;
};

export type StudySessionUpdateInput = {
  assignmentId?: string | null;
  title?: string;
  durationMinutes?: number;
  mode?: string;
  targetOutcome?: string;
  energyLevel?: string;
  status?: string;
  generatedPlanJson?: StudyPlan;
};

export type StudyAgentConfirmation = {
  token: string;
  title: string;
  body: string;
  details: string[];
  confirmLabel: string;
  cancelLabel: string;
  actionType:
    | "create_study_session"
    | "hide_assignment"
    | "hide_course_assignments"
    | "hide_course"
    | "reset_scope";
};

export type DailyBrief = {
  id?: string;
  summary: string;
  riskLevel: RiskLevel;
  generatedJson?: {
    greeting?: string;
    summary?: string;
    riskLevel?: RiskLevel;
    focusItems?: string[];
    dueToday?: string[];
    dueThisWeek?: string[];
    newAnnouncements?: string[];
    recentFiles?: string[];
    suggestedOrder?: string[];
    motivationalLine?: string;
  };
  createdAt?: string;
};

export type DashboardSummary = {
  userName: string;
  timezone: string;
  lastSyncAt?: string | null;
  lastSuccessfulSyncAt?: string | null;
  lastSyncAttemptAt?: string | null;
  canvasConfigured?: boolean;
  canvasConnectionMode?: CanvasConnectionMode;
  syncStatus?: CanvasSyncState;
  syncError?: string | null;
  syncSummary?: CanvasSyncSummary;
  stale: boolean;
  todayMission: string[];
  dueToday: AssignmentSummary[];
  dueThisWeek: AssignmentSummary[];
  unsubmitted: AssignmentSummary[];
  announcements: AnnouncementSummary[];
  files: FileSummary[];
  riskLevel: RiskLevel;
  priorityItems?: AssignmentSummary[];
  courseBreakdown?: CourseDashboardSummary[];
};

export type CreateStudySessionInput = {
  assignmentId?: string | null;
  customTitle?: string;
  customFocus?: string;
  durationMinutes: number;
  mode: string;
  energyLevel: string;
  targetOutcome: string;
};

export type DashboardScopeSummary = {
  excludedCourseIds: string[];
  excludedCanvasCourseIds: number[];
  excludedAssignmentIds: string[];
  excludedCanvasAssignmentKeys: string[];
  hiddenCourses: Array<{ id: string; canvasCourseId: number; name: string; courseCode?: string | null }>;
  hiddenAssignments: Array<{
    id: string;
    canvasAssignmentId: number;
    name: string;
    courseName: string;
    courseCode?: string | null;
  }>;
};

export type ActiveOperation = {
  id: string;
  type:
    | "sync"
    | "brief"
    | "session"
    | "scope"
    | "assignment_status"
    | "upload"
    | "canvas_connection"
    | "profile"
    | "agent_action";
  label: string;
  startedAt: number;
  view?: ViewType;
};

export type StudySidekickActions = {
  onNavigate: (view: ViewType) => void;
  onGenerateBrief: () => void;
  onSyncCanvas: () => void;
  onStartSession: () => void;
  onOpenAnnouncements: () => void;
  onOpenSettings: () => void;
  onOpenChat: (message?: string) => void;
  onUploadMaterial?: (input: {
    file?: File | null;
    title?: string;
    notes?: string;
    courseId?: string;
    assignmentId?: string;
  }) => Promise<void>;
  actionMessage?: string | null;
  isGeneratingBrief?: boolean;
  isSyncing?: boolean;
  isBusy?: boolean;
  disabledReason?: string | null;
  activeOperation?: ActiveOperation | null;
};
