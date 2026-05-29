const STUDENT_ID_PATTERN = /^s?\d{6,}$/i;
const GENERIC_NAME_PATTERN = /^(student|user|account)$/i;

export function cleanPersonName(value: unknown) {
  if (typeof value !== "string") return null;
  const withoutEmail = value.includes("@") ? value.split("@")[0] : value;
  const cleaned = withoutEmail
    .replace(/\bS?\d{6,}\b/gi, "")
    .replace(/[()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned || STUDENT_ID_PATTERN.test(cleaned) || GENERIC_NAME_PATTERN.test(cleaned)) return null;
  return cleaned;
}

export function firstDisplayName(value: unknown, fallback = "there") {
  const cleaned = cleanPersonName(value);
  if (!cleaned) return fallback;
  return cleaned.split(/\s+/)[0] || fallback;
}

export function timeOfDayGreeting(timezone = "Australia/Sydney", date = new Date()) {
  let hour = date.getHours();
  try {
    const parts = new Intl.DateTimeFormat("en-AU", {
      hour: "numeric",
      hour12: false,
      timeZone: timezone,
    }).formatToParts(date);
    const parsed = Number(parts.find((part) => part.type === "hour")?.value);
    if (Number.isFinite(parsed)) hour = parsed === 24 ? 0 : parsed;
  } catch {
    // Fall back to the server/browser local time if an invalid timezone was saved.
  }

  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  return "Good evening";
}

export function personalGreeting(name: unknown, timezone = "Australia/Sydney", date = new Date()) {
  const greeting = timeOfDayGreeting(timezone, date);
  const firstName = firstDisplayName(name, "");
  return firstName ? `${greeting}, ${firstName}` : greeting;
}
