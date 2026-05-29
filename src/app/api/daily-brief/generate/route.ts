import { jsonError, jsonOk } from "@/lib/api";
import { requireUser, isDemoUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { env } from "@/lib/env";
import { getDashboardData } from "@/lib/data/dashboard";
import { generateDailyBrief } from "@/lib/ai/gemini";

export async function POST() {
  try {
    const user = await requireUser();
    const dashboard = await getDashboardData(user);
    const brief = await generateDailyBrief({
      name: dashboard.userName,
      timezone: dashboard.timezone,
      dueToday: dashboard.dueToday,
      dueThisWeek: dashboard.dueThisWeek,
      priorityItems: dashboard.priorityItems,
      announcements: dashboard.announcements.map((item) => `${item.courseName}: ${item.title}`),
      files: dashboard.files.map((item) => `${item.courseName}: ${item.name}`),
    });

    if (!isDemoUser(user) && env.DATABASE_URL) {
      const db = getDb();
      const date = new Intl.DateTimeFormat("en-CA", { timeZone: user.timezone }).format(new Date());
      await db.dailyBrief.upsert({
        where: { userId_date: { userId: user.id, date } },
        create: {
          userId: user.id,
          date,
          summary: brief.summary,
          riskLevel: brief.riskLevel,
          generatedJson: brief,
        },
        update: {
          summary: brief.summary,
          riskLevel: brief.riskLevel,
          generatedJson: brief,
        },
      });
    }

    return jsonOk({ brief });
  } catch (error) {
    return jsonError(error, 500);
  }
}
