export function openExternalUrl(url?: string | null) {
  if (!url) return;

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return;
    window.open(parsed.toString(), "_blank", "noopener,noreferrer");
  } catch {
    return;
  }
}
