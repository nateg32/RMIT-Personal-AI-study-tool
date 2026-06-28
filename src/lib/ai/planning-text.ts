export function cleanPlannerText(value: string | null | undefined, max = 220) {
  const text = (value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) return "";
  return text.length > max ? `${text.slice(0, max).trim()}...` : text;
}
