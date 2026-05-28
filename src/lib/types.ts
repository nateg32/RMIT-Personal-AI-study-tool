export type RiskLevel = "low" | "medium" | "high" | "critical";

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
  submittedAt?: Date | string | null;
  workflowState?: string | null;
  missing?: boolean | null;
  late?: boolean | null;
};

export type AssignmentContextResource = {
  title: string;
  type: string;
  moduleName?: string | null;
  url?: string | null;
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
    name: string;
    updatedAtCanvas?: string | null;
    url?: string | null;
  }>;
  riskLevel: RiskLevel;
};
