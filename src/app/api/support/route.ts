import { randomUUID } from "node:crypto";
import { z } from "zod";
import { auditLog } from "@/lib/audit";
import { jsonError, jsonOk, parseJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { sendSupportTicketEmail } from "@/lib/email/support";

const supportTicketSchema = z.object({
  category: z.enum([
    "Canvas sync",
    "Login or account",
    "AI chat",
    "Study sessions",
    "Files or uploads",
    "Dashboard data",
    "Bug or broken button",
    "Feature request",
    "Other",
  ]),
  priority: z.enum(["Low", "Normal", "High", "Urgent"]),
  subject: z.string().trim().min(4).max(160),
  description: z.string().trim().min(12).max(4000),
  stepsToReproduce: z.string().trim().max(2000).optional().or(z.literal("")),
  currentUrl: z.string().trim().max(500).optional().or(z.literal("")),
  userAgent: z.string().trim().max(500).optional().or(z.literal("")),
});

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const input = await parseJson(request, supportTicketSchema);
    const ticketId = `SS-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID()
      .slice(0, 8)
      .toUpperCase()}`;

    await sendSupportTicketEmail({
      ticketId,
      requesterName: user.name,
      requesterEmail: user.email,
      category: input.category,
      priority: input.priority,
      subject: input.subject,
      description: input.description,
      stepsToReproduce: input.stepsToReproduce || undefined,
      currentUrl: input.currentUrl || undefined,
      userAgent: input.userAgent || undefined,
    });

    await auditLog({
      userId: user.id,
      action: "support.ticket_submitted",
      metadata: {
        ticketId,
        category: input.category,
        priority: input.priority,
        subject: input.subject,
      },
    });

    return jsonOk({ ok: true, ticketId });
  } catch (error) {
    return jsonError(error, 400);
  }
}
