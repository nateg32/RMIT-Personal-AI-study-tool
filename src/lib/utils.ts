import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function absoluteUrl(path: string) {
  const base = process.env.APP_BASE_URL || "http://localhost:3000";
  return new URL(path, base).toString();
}

export function toDate(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDateTime(
  value: Date | string | null | undefined,
  timezone = "Australia/Sydney",
) {
  const date = toDate(value);
  if (!date) return "No due date";
  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  }).format(date);
}

export function formatRelativeDue(
  value: Date | string | null | undefined,
  timezone = "Australia/Sydney",
) {
  const date = toDate(value);
  if (!date) return "No due date";
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffHours = Math.round(diffMs / 36e5);
  if (diffHours < 0) return `Overdue by ${Math.abs(diffHours)}h`;
  if (diffHours <= 24) return `Due in ${Math.max(1, diffHours)}h`;
  const diffDays = Math.ceil(diffHours / 24);
  if (diffDays <= 7) return `Due in ${diffDays} days`;
  return formatDateTime(date, timezone);
}

export function normaliseBaseUrl(value: string) {
  const url = new URL(value);
  return `${url.protocol}//${url.host}`;
}

export function redactSecret(input: string) {
  return input.replace(/[A-Za-z0-9_~.-]{20,}/g, "[redacted]");
}
