import { AlertTriangle, CheckCircle2, Flame, Sparkles } from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { AssignmentCard } from "@/components/assignment-card";
import { DailyBriefButton } from "@/components/daily-brief-button";
import { DashboardCommandBar } from "@/components/dashboard-command-bar";
import { PageHeader } from "@/components/page-header";
import { SyncButton } from "@/components/sync-button";
import { BorderRotate } from "@/components/ui/animated-gradient-border";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePageUser } from "@/lib/auth";
import { getDashboardData } from "@/lib/data/dashboard";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requirePageUser();
  const dashboard = await getDashboardData(user);

  return (
    <AppShell>
      <PageHeader
        eyebrow="Today"
        title={`Good morning, ${dashboard.userName}.`}
        description="Your Canvas command centre is prioritised by due date, submission status, and risk."
        actions={
          <>
            <DailyBriefButton />
            <SyncButton />
          </>
        }
      />

      <div className="mb-6">
        <DashboardCommandBar />
      </div>

      {dashboard.stale ? (
        <div className="mb-5 flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 text-warning" />
          <p>
            Canvas data is stale or not synced yet. Last sync:{" "}
            {dashboard.lastSyncAt ? formatDateTime(dashboard.lastSyncAt, dashboard.timezone) : "never"}.
            {dashboard.canvasConfigured ? (
              <> Use Sync now to refresh it.</>
            ) : (
              <>
                {" "}
                <Link className="font-medium text-primary underline-offset-4 hover:underline" href="/settings">
                  Connect Canvas in Settings
                </Link>
                .
              </>
            )}
          </p>
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        <BorderRotate className="h-full bg-card" animationSpeed={10}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-danger" />
              Risk level
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge tone={dashboard.riskLevel}>{dashboard.riskLevel}</Badge>
            <p className="mt-3 text-sm text-muted">Based on unsubmitted work and upcoming due dates.</p>
          </CardContent>
        </BorderRotate>
        <Card>
          <CardHeader>
            <CardTitle>Unsubmitted</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{dashboard.unsubmitted.length}</p>
            <p className="text-sm text-muted">Tasks needing attention.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              Focus streak
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">3 days</p>
            <p className="text-sm text-muted">Complete one study block to keep it moving.</p>
          </CardContent>
        </Card>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">Today&apos;s mission</h2>
          </div>
          <div className="grid gap-3">
            {dashboard.todayMission.map((item, index) => (
              <div key={item} className="rounded-lg border border-border bg-card p-4">
                <p className="text-sm text-muted">Priority {index + 1}</p>
                <p className="mt-1 font-medium">{item}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">New announcements</h2>
          {dashboard.announcements.slice(0, 4).map((announcement) => (
            <a
              key={announcement.id}
              href={announcement.htmlUrl || "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-lg border border-border bg-card p-4 transition hover:border-primary"
            >
              <p className="text-sm font-medium text-primary">{announcement.courseName}</p>
              <p className="mt-1 font-medium">{announcement.title}</p>
            </a>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-4 text-xl font-semibold">Due today</h2>
        <div className="grid gap-4">
          {dashboard.dueToday.length > 0 ? (
            dashboard.dueToday.map((assignment) => (
              <AssignmentCard
                key={assignment.id}
                assignment={assignment}
                timezone={dashboard.timezone}
              />
            ))
          ) : (
            <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted">
              Nothing due today from the latest sync.
            </p>
          )}
        </div>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-4 text-xl font-semibold">Due this week</h2>
          <div className="grid gap-3">
            {dashboard.dueThisWeek.slice(0, 4).map((assignment) => (
              <div key={assignment.id} className="rounded-lg border border-border bg-card p-4">
                <p className="text-sm font-medium text-primary">{assignment.courseName}</p>
                <p className="mt-1 font-medium">{assignment.name}</p>
                <p className="mt-1 text-sm text-muted">
                  {formatDateTime(assignment.dueAt, dashboard.timezone)}
                </p>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h2 className="mb-4 text-xl font-semibold">Recently added files</h2>
          <div className="grid gap-3">
            {dashboard.files.slice(0, 4).map((file) => (
              <a
                key={file.id}
                href={file.url || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-border bg-card p-4 transition hover:border-primary"
              >
                <p className="text-sm font-medium text-primary">{file.courseName}</p>
                <p className="mt-1 font-medium">{file.name}</p>
              </a>
            ))}
          </div>
        </div>
      </section>
    </AppShell>
  );
}
