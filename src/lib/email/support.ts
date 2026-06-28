import "server-only";
import { Resend } from "resend";
import { env } from "@/lib/env";

let resendClient: Resend | null = null;

function getResend() {
  if (!env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is required to send support tickets.");
  }

  if (!resendClient) {
    resendClient = new Resend(env.RESEND_API_KEY);
  }

  return resendClient;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatBlock(label: string, value?: string | null) {
  const safeValue = value?.trim();
  if (!safeValue) return "";
  return `
    <tr>
      <td style="padding:12px 16px;border-bottom:1px solid #e8e2d8;color:#5c6652;font-weight:700;vertical-align:top;width:180px;">${escapeHtml(label)}</td>
      <td style="padding:12px 16px;border-bottom:1px solid #e8e2d8;color:#1f271d;white-space:pre-wrap;">${escapeHtml(safeValue)}</td>
    </tr>
  `;
}

export type SupportTicketEmailInput = {
  ticketId: string;
  requesterName: string;
  requesterEmail: string;
  category: string;
  priority: string;
  subject: string;
  description: string;
  stepsToReproduce?: string;
  currentUrl?: string;
  userAgent?: string;
};

export async function sendSupportTicketEmail(input: SupportTicketEmailInput) {
  const to = env.SUPPORT_TO_EMAIL || "support@example.com";
  const from = env.SUPPORT_FROM_EMAIL || "RMIT Study Sidekick <support@example.com>";
  const subject = `[Study Sidekick ${input.ticketId}] ${input.subject}`;
  const text = [
    `Ticket: ${input.ticketId}`,
    `Requester: ${input.requesterName} <${input.requesterEmail}>`,
    `Category: ${input.category}`,
    `Priority: ${input.priority}`,
    `Subject: ${input.subject}`,
    "",
    "Issue",
    input.description,
    "",
    input.stepsToReproduce ? `Steps to reproduce\n${input.stepsToReproduce}\n` : "",
    input.currentUrl ? `Page: ${input.currentUrl}` : "",
    input.userAgent ? `Browser: ${input.userAgent}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const html = `
    <div style="font-family:Inter,Arial,sans-serif;background:#fbf8ef;padding:24px;color:#1f271d;">
      <div style="max-width:720px;margin:0 auto;background:#fffdf7;border:2px solid #dcd6ca;border-radius:24px;overflow:hidden;">
        <div style="background:#4a6f3b;color:#fff;padding:24px 28px;">
          <p style="margin:0 0 8px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;">Study Sidekick Support Ticket</p>
          <h1 style="margin:0;font-size:26px;line-height:1.2;">${escapeHtml(input.subject)}</h1>
          <p style="margin:12px 0 0;font-size:14px;opacity:.9;">Ticket ${escapeHtml(input.ticketId)}</p>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:15px;">
          ${formatBlock("Requester", `${input.requesterName} <${input.requesterEmail}>`)}
          ${formatBlock("Category", input.category)}
          ${formatBlock("Priority", input.priority)}
          ${formatBlock("Issue", input.description)}
          ${formatBlock("Steps tried", input.stepsToReproduce)}
          ${formatBlock("Page", input.currentUrl)}
          ${formatBlock("Browser", input.userAgent)}
        </table>
      </div>
    </div>
  `;

  const { data, error } = await getResend().emails.send({
    from,
    to,
    replyTo: input.requesterEmail,
    subject,
    text,
    html,
  });

  if (error) {
    throw new Error(error.message || "Support ticket email could not be sent.");
  }

  return data;
}
