import { createHash } from "node:crypto";

export type SupportSpamInput = {
  category: string;
  subject: string;
  description: string;
  stepsToReproduce?: string;
};

function normaliseSupportText(value: string) {
  return value
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " url ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function supportContentFingerprint(input: SupportSpamInput) {
  const value = [
    input.category,
    input.subject,
    input.description,
    input.stepsToReproduce || "",
  ]
    .map(normaliseSupportText)
    .join("|");

  return createHash("sha256").update(value).digest("hex");
}

export function supportSpamSignals(input: SupportSpamInput) {
  const combined = `${input.subject}\n${input.description}\n${input.stepsToReproduce || ""}`;
  const normalised = normaliseSupportText(combined);
  const words = normalised.split(" ").filter(Boolean);
  const uniqueWords = new Set(words);
  const urls = combined.match(/https?:\/\/\S+/g) || [];
  const repeatedCharacter = /(.)\1{24,}/.test(combined);
  const repeatedWordRatio = words.length >= 35 ? uniqueWords.size / words.length : 1;

  const signals: string[] = [];
  if (urls.length > 6) signals.push("too_many_links");
  if (repeatedCharacter) signals.push("repeated_characters");
  if (words.length >= 35 && repeatedWordRatio < 0.16) signals.push("repeated_words");
  if (normalised.length < 24) signals.push("too_little_detail");

  return signals;
}
