import { jsonError, jsonOk } from "@/lib/api";
import { getDb } from "@/lib/db";
import { env } from "@/lib/env";
import { getDashboardData } from "@/lib/data/dashboard";
import { generateDailyBrief } from "@/lib/ai/gemini";

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!env.CRON_SECRET || authHeader !== `Bearer ${env.CRON_SECRET}`) {
      return jsonError(new Error("Unauthorized"), 401);
    }

    const db = getDb();
    const users = await db.user.findMany({ take: 20 });
    const results = [];

    for (const user of users) {
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
      const date = new Intl.DateTimeFormat("en-CA", { timeZone: user.timezone }).format(new Date());
      await db.dailyBrief.upsert({
        where: { userId_date: { userId: user.id, date } },
        create: { userId: user.id, date, summary: brief.summary, riskLevel: brief.riskLevel, generatedJson: brief },
        update: { summary: brief.summary, riskLevel: brief.riskLevel, generatedJson: brief },
      });
      results.push({ userId: user.id, riskLevel: brief.riskLevel });
    }

    return jsonOk({ ok: true, users: results.length, results });
  } catch (error) {
    return jsonError(error, 500);
  }
}
