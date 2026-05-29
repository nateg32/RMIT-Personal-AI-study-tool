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

export type DailyBriefJson = {
  greeting: string;
  summary: string;
  riskLevel: RiskLevel;
  focusItems: string[];
  dueToday: string[];
  dueThisWeek: string[];
  newAnnouncements: string[];
  recentFiles: string[];
  suggestedOrder: string[];
  motivationalLine: string;
};

export type CanvasAssignmentSummary = {
  id: string;
  courseId?: string;
  canvasAssignmentId: number;
  courseName: string;
  courseCode?: string | null;
  name: string;
  dueAt?: Date | string | null;
  pointsPossible?: number | null;
  htmlUrl?: string | null;
  description?: string | null;
  rubricSummary?: string | null;
  rubric?: unknown;
  submissionTypes?: string[] | null;
  assignmentType?: AssignmentType;
  priorityScore?: number;
  priorityLabel?: RiskLevel;
  priorityReason?: string;
  estimatedTime?: string;
  dueStatus?: "overdue" | "due_today" | "due_this_week" | "upcoming" | "undated" | "submitted";
  submittedAt?: Date | string | null;
  workflowState?: string | null;
  missing?: boolean | null;
  late?: boolean | null;
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
  nextAssignment?: CanvasAssignmentSummary | null;
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

export type AssignmentContextResource = {
  title: string;
  type: string;
  moduleName?: string | null;
  url?: string | null;
  excerpt?: string | null;
};

export type AssignmentContextPack = {
  assignment: CanvasAssignmentSummary & {
    description?: string | null;
    rubricSummary?: string | null;
    rubric?: unknown;
  };
  lastSyncAt?: string | null;
  stale: boolean;
  course: {
    id: string;
    name: string;
    courseCode?: string | null;
  };
  rubricCriteria: string[];
  relatedFiles: AssignmentContextResource[];
  relatedResources: AssignmentContextResource[];
  recentAnnouncements: Array<{
    title: string;
    message?: string | null;
    postedAt?: string | null;
    url?: string | null;
  }>;
  contextConfidence: "high" | "medium" | "low";
  missingContext: string[];
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
  dueToday: CanvasAssignmentSummary[];
  dueThisWeek: CanvasAssignmentSummary[];
  unsubmitted: CanvasAssignmentSummary[];
  announcements: Array<{
    id: string;
    courseName: string;
    title: string;
    postedAt?: string | null;
    htmlUrl?: string | null;
  }>;
  files: Array<{
    id: string;
    courseName: string;
    courseId?: string | null;
    assignmentId?: string | null;
    assignmentName?: string | null;
    name: string;
    updatedAtCanvas?: string | null;
    createdAt?: string | null;
    url?: string | null;
    source?: "canvas" | "manual_upload";
    hasIndexedText?: boolean;
    excerpt?: string | null;
  }>;
  riskLevel: RiskLevel;
  priorityItems?: CanvasAssignmentSummary[];
  courseBreakdown?: CourseDashboardSummary[];
};
