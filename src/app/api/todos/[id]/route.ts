import { z } from "zod";
import { jsonError, jsonOk, parseJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

const updateTodoSchema = z.object({
  title: z.string().min(2).optional(),
  status: z.string().min(2).optional(),
  priority: z.string().min(2).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const input = await parseJson(request, updateTodoSchema);
    const db = getDb();
    await db.todo.updateMany({ where: { id, userId: user.id }, data: input });
    const todo = await db.todo.findFirstOrThrow({ where: { id, userId: user.id } });
    return jsonOk(todo);
  } catch (error) {
    return jsonError(error, 400);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const db = getDb();
    await db.todo.deleteMany({ where: { id, userId: user.id } });
    return jsonOk({ ok: true });
  } catch (error) {
    return jsonError(error, 400);
  }
}
