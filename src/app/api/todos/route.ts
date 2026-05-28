import { z } from "zod";
import { jsonError, jsonOk, parseJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

const createTodoSchema = z.object({
  title: z.string().min(2),
  courseId: z.string().optional(),
  assignmentId: z.string().optional(),
  priority: z.string().optional(),
  dueAt: z.string().datetime().optional(),
});

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const input = await parseJson(request, createTodoSchema);
    const db = getDb();
    const todo = await db.todo.create({
      data: {
        userId: user.id,
        title: input.title,
        courseId: input.courseId,
        assignmentId: input.assignmentId,
        priority: input.priority || "medium",
        dueAt: input.dueAt ? new Date(input.dueAt) : undefined,
        source: "user",
      },
    });
    return jsonOk(todo);
  } catch (error) {
    return jsonError(error, 400);
  }
}
