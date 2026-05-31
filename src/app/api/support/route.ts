import { randomUUID } from "node:crypto";
import { z } from "zod";
import { auditLog } from "@/lib/audit";
import { jsonError, jsonOk, parseJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { sendSupportTicketEmail } from "@/lib/email/support";
import { env } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { supportContentFingerprint, supportSpamSignals } from "@/lib/support/spam";

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

class SupportTicketBlockedError extends Error {
  status: number;

  constructor(message: string, status = 429) {
    super(message);
    this.status = status;
  }
}

function requestIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  return forwardedFor?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

function metadataObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

async function assertSupportTicketAllowed(
  userId: string,
  request: Request,
  input: z.infer<typeof supportTicketSchema>,
) {
  const minuteLimit = rateLimit(`support:user:${userId}:minute`, 2, 60_000);
  if (!minuteLimit.ok) {
    throw new SupportTicketBlockedError("Please wait a minute before sending another support ticket.");
  }

  const hourLimit = rateLimit(`support:user:${userId}:hour`, 6, 60 * 60_000);
  if (!hourLimit.ok) {
    throw new SupportTicketBlockedError("Support tickets are limited to 6 per hour. Try again a little later.");
  }

  const ipLimit = rateLimit(`support:ip:${requestIp(request)}:minute`, 8, 60_000);
  if (!ipLimit.ok) {
    throw new SupportTicketBlockedError("Too many support requests are being sent right now. Try again shortly.");
  }

  const spamSignals = supportSpamSignals(input);
  if (spamSignals.length >= 2) {
    throw new SupportTicketBlockedError(
      "This ticket looks too repetitive or link-heavy. Please rewrite it with the specific issue, page, and error message.",
      400,
    );
  }

  if (!env.DATABASE_URL) return;

  const db = getDb();
  const sinceDay = new Date(Date.now() - 24 * 60 * 60_000);
  const sinceHour = new Date(Date.now() - 60 * 60_000);
  const recentTickets = await db.auditLog.findMany({
    where: {
      userId,
      action: "support.ticket_submitted",
      createdAt: { gte: sinceDay },
    },
    orderBy: { createdAt: "desc" },
    take: 25,
  });

  const sentThisHour = recentTickets.filter((ticket) => ticket.createdAt >= sinceHour).length;
  if (sentThisHour >= 6) {
    throw new SupportTicketBlockedError("Support tickets are limited to 6 per hour. Try again a little later.");
  }
  if (recentTickets.length >= 20) {
    throw new SupportTicketBlockedError("Support tickets are limited to 20 per day. Try again tomorrow.");
  }

  const fingerprint = supportContentFingerprint(input);
  const duplicate = recentTickets.find((ticket) => metadataObject(ticket.metadata)?.fingerprint === fingerprint);
  if (duplicate) {
    const duplicateTicketId = metadataObject(duplicate.metadata)?.ticketId;
    throw new SupportTicketBlockedError(
      `This exact ticket was already sent${duplicateTicketId ? ` as ${duplicateTicketId}` : ""}. Add new details instead of sending a duplicate.`,
      409,
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const input = await parseJson(request, supportTicketSchema);
    await assertSupportTicketAllowed(user.id, request, input);
    const ticketId = `SS-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID()
      .slice(0, 8)
      .toUpperCase()}`;
    const fingerprint = supportContentFingerprint(input);

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
        fingerprint,
        spamSignals: supportSpamSignals(input),
      },
    });

    return jsonOk({ ok: true, ticketId });
  } catch (error) {
    return jsonError(error, error instanceof SupportTicketBlockedError ? error.status : 400);
  }
}
