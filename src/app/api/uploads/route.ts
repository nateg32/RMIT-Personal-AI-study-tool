import { isDemoUser, requireUser } from "@/lib/auth";
import { auditLog } from "@/lib/audit";
import { jsonError, jsonOk } from "@/lib/api";
import { env } from "@/lib/env";
import { createUploadedMaterial, uploadMaterialSchema } from "@/lib/data/uploads";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    if (isDemoUser(user) || !env.DATABASE_URL) {
      return jsonError(new Error("Manual uploads require the database connection."), 400);
    }

    const formData = await request.formData();
    const rawFile = formData.get("file");
    const file = rawFile instanceof File && rawFile.size > 0 ? rawFile : null;
    const fields = uploadMaterialSchema.parse({
      courseId: String(formData.get("courseId") || "") || undefined,
      assignmentId: String(formData.get("assignmentId") || "") || undefined,
      title: String(formData.get("title") || "") || undefined,
      notes: String(formData.get("notes") || "") || undefined,
    });

    const material = await createUploadedMaterial({
      userId: user.id,
      file,
      courseId: fields.courseId,
      assignmentId: fields.assignmentId,
      title: fields.title,
      notes: fields.notes,
    });

    return jsonOk({
      id: material.id,
      name: material.name,
      courseName: material.courseName || "Manual library",
      assignmentName: material.assignmentName || null,
      source: "manual_upload",
      hasIndexedText: Boolean(material.extractedText || material.notes || material.geminiFile),
      deepReadStatus: material.deepReadStatus,
    });
  } catch (error) {
    return jsonError(error, 400);
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireUser();
    if (isDemoUser(user) || !env.DATABASE_URL) {
      return jsonError(new Error("Manual uploads require the database connection."), 400);
    }

    const id = new URL(request.url).searchParams.get("id");
    if (!id) return jsonError(new Error("Upload id is required"), 400);

    const { getDb } = await import("@/lib/db");
    const db = getDb();
    await db.syncSnapshot.deleteMany({ where: { sourceId: id, userId: user.id, type: "manual_upload" } });
    await auditLog({ userId: user.id, action: "uploaded_file.deleted", metadata: { id } });
    return jsonOk({ ok: true });
  } catch (error) {
    return jsonError(error, 400);
  }
}
