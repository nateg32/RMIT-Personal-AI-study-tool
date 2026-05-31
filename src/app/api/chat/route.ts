import { z } from "zod";
import { jsonError, jsonOk, parseJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getDashboardData } from "@/lib/data/dashboard";
import {
  getChatAssignmentContextsForUser,
  getChatGeminiMaterialsForUser,
  getChatManualMaterialsForUser,
} from "@/lib/data/assignment-context";
import { getAssignmentsForUser, getCoursesForUser } from "@/lib/data/lists";
import { chatWithCanvasContext } from "@/lib/ai/gemini";
import { runStudyAgent } from "@/lib/ai/study-agent";
import { rateLimit } from "@/lib/rate-limit";
import type { CanvasAssignmentSummary } from "@/lib/types";

const chatSchema = z.object({
  message: z.string().max(1000).optional(),
  confirmationToken: z.string().max(4096).optional(),
}).refine((value) => Boolean(value.message?.trim() || value.confirmationToken), {
  message: "Message or confirmation token is required",
});

function uniqueAssignments(assignments: CanvasAssignmentSummary[]) {
  const seen = new Set<string>();
  return assignments.filter((assignment) => {
    if (seen.has(assignment.id)) return false;
    seen.add(assignment.id);
    return true;
  });
}

function uniqueStrings(items: string[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item)) return false;
    seen.add(item);
    return true;
  });
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const limit = rateLimit(`chat:${user.id}`, 20, 60_000);
    if (!limit.ok) return jsonError(new Error("Too many chat requests"), 429);
    const { message = "", confirmationToken } = await parseJson(request, chatSchema);
    const [dashboard, assignments, courses] = await Promise.all([
      getDashboardData(user),
      getAssignmentsForUser(user),
      getCoursesForUser(user),
    ]);
    const agentResult = await runStudyAgent({
      user,
      message,
      confirmationToken,
      dashboard,
      assignments,
      courses,
    });
    if (agentResult) {
      return jsonOk({ ...agentResult, lastSyncAt: dashboard.lastSyncAt });
    }

    const [assignmentContexts, manualMaterials, geminiMaterials] = await Promise.all([
      getChatAssignmentContextsForUser(user, message),
      getChatManualMaterialsForUser(user, message),
      getChatGeminiMaterialsForUser(user, message),
    ]);
    const answer = await chatWithCanvasContext({
      message,
      name: dashboard.userName,
      lastSyncAt: dashboard.lastSyncAt,
      due: uniqueAssignments([
        ...(dashboard.priorityItems || []),
        ...dashboard.dueToday,
        ...dashboard.dueThisWeek,
        ...dashboard.unsubmitted,
      ]).slice(0, 16),
      announcements: dashboard.announcements.map((item) => `${item.courseName}: ${item.title}`),
      files: uniqueStrings([
        ...manualMaterials,
        ...dashboard.files.map((item) =>
          `${item.source === "manual_upload" ? "Manual upload" : "Canvas file"} - ${item.courseName}${
            item.assignmentName ? ` / ${item.assignmentName}` : ""
          }: ${item.name}${item.excerpt ? ` - ${item.excerpt}` : ""}`,
        ),
      ]).slice(0, 18),
      assignmentContexts,
      mediaMaterials: geminiMaterials,
    });
    return jsonOk({ ...answer, lastSyncAt: dashboard.lastSyncAt });
  } catch (error) {
    return jsonError(error, 400);
  }
}
