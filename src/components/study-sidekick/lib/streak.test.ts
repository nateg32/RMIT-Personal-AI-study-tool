import { describe, expect, it } from "vitest";
import type { StudySessionRecord } from "../types";
import { buildFocusStats, levelFromXp, xpForFocusMinutes } from "./streak";

function session(overrides: Partial<StudySessionRecord> = {}): StudySessionRecord {
  return {
    id: "session-1",
    title: "Cloud sprint",
    durationMinutes: 50,
    mode: "Plan assignment",
    targetOutcome: "Credit",
    energyLevel: "Medium",
    generatedPlanJson: {
      title: "Cloud sprint",
      durationMinutes: 50,
      riskLevel: "medium",
      blocks: [{ name: "Draft", minutes: 50, tasks: ["Write outline"] }],
      checklist: ["Outline done"],
      completedTasks: { "Outline done": true },
      definitionOfDone: ["Outline saved"],
      resourcesToOpen: [],
      nextAction: "Keep drafting",
    },
    status: "completed",
    createdAt: "2026-05-29T09:00:00.000Z",
    updatedAt: "2026-05-29T10:00:00.000Z",
    ...overrides,
  };
}

describe("focus streak rewards", () => {
  it("awards larger XP for longer completed focus sessions", () => {
    expect(xpForFocusMinutes(10)).toBeGreaterThan(0);
    expect(xpForFocusMinutes(50)).toBeGreaterThan(xpForFocusMinutes(25));
    expect(xpForFocusMinutes(90)).toBeGreaterThan(xpForFocusMinutes(50));
  });

  it("turns session history into XP and student motivation analytics", () => {
    const stats = buildFocusStats(
      [
        session(),
        session({
          id: "session-2",
          durationMinutes: 25,
          createdAt: "2026-05-30T09:00:00.000Z",
          updatedAt: "2026-05-30T09:30:00.000Z",
        }),
      ],
      "Australia/Sydney",
      new Date("2026-05-31T06:00:00.000Z"),
    );

    expect(stats.totalXp).toBe(xpForFocusMinutes(50) + xpForFocusMinutes(25));
    expect(stats.deepWorkSessions).toBe(1);
    expect(stats.weekMinutes).toBe(75);
    expect(stats.level.level).toBe(levelFromXp(stats.totalXp).level);
    expect(stats.consistencyScore).toBeGreaterThan(0);
  });
});
