import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock3,
  Flame,
  Flag,
  FolderOpen,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { AssignmentCard } from "@/components/assignment-card";
import { DailyBriefButton } from "@/components/daily-brief-button";
import { DashboardCommandBar } from "@/components/dashboard-command-bar";
import { SyncButton } from "@/components/sync-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { requirePageUser } from "@/lib/auth";
import { getDashboardData } from "@/lib/data/dashboard";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requirePageUser();
  const dashboard = await getDashboardData(user);
  const nextDeadline = dashboard.dueToday[0] || dashboard.dueThisWeek[0] || dashboard.unsubmitted[0];
  const noteStyles = ["sticky-note-mint", "sticky-note-peach", "sticky-note-lavender"];

  return (
    <AppShell>
      <header className="sticky top-0 z-20 -mx-4 mb-8 bg-background/85 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6 md:-mx-8 md:px-8 lg:-mx-12 lg:px-12">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-bold text-primary">Today</p>
            <h1 className="mt-1 text-4xl font-bold text-primary sm:text-5xl">
              Good morning, {dashboard.userName}.
            </h1>
            <p className="mt-3 max-w-2xl text-lg text-muted">
              Your sidekick has sorted Canvas into what changed, what is due, and what deserves focus first.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <DailyBriefButton />
            <SyncButton />
          </div>
        </div>
      </header>

      <div className="mb-8 max-w-3xl">
        <DashboardCommandBar />
      </div>

      {dashboard.stale ? (
        <div className="mb-8 flex items-start gap-3 rounded-lg border-2 border-warning/30 bg-warning/10 p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-warning" />
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

      <section className="mb-8 grid gap-5 lg:grid-cols-12">
        <div className="sticky-note sticky-note-mint rounded-lg p-6 lg:col-span-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-2xl font-bold text-primary">
                Daily briefing
                <Sparkles className="h-5 w-5" />
              </h2>
              <p className="mt-3 max-w-2xl text-muted">
                A quick snapshot of the academic pressure for today, based on your latest Canvas sync.
              </p>
              <div className="mt-6 flex gap-8">
                <div>
                  <p className="text-5xl font-bold text-primary">{dashboard.dueToday.length}</p>
                  <p className="text-xs font-bold uppercase text-muted">Due today</p>
                </div>
                <div className="h-16 w-0.5 rounded-full bg-primary/20" />
                <div>
                  <p className="text-5xl font-bold text-secondary">{dashboard.dueThisWeek.length}</p>
                  <p className="text-xs font-bold uppercase text-muted">This week</p>
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-white/70 bg-white/45 p-4 backdrop-blur dark:border-white/10 dark:bg-white/5 md:w-64">
              <p className="text-xs font-bold uppercase text-muted">Next deadline</p>
              <p className="mt-2 font-bold text-primary">{nextDeadline?.name || "No deadline synced yet"}</p>
              <p className="mt-1 text-sm text-muted">
                {nextDeadline?.dueAt
                  ? formatDateTime(nextDeadline.dueAt, dashboard.timezone)
                  : "Run Sync now when Canvas is ready."}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 lg:col-span-4">
          <Card className="bg-surface-container-low">
            <CardContent className="flex items-center justify-between p-5">
              <div>
                <p className="text-xs font-bold uppercase text-muted">Risk level</p>
                <p className="mt-1 text-2xl font-bold">{dashboard.riskLevel}</p>
              </div>
              <Flame className="h-9 w-9 text-danger" />
            </CardContent>
          </Card>
          <Card className="bg-surface-container-low">
            <CardContent className="flex items-center justify-between p-5">
              <div>
                <p className="text-xs font-bold uppercase text-muted">Unsubmitted</p>
                <p className="mt-1 text-2xl font-bold">{dashboard.unsubmitted.length} tasks</p>
              </div>
              <Clock3 className="h-9 w-9 text-warning" />
            </CardContent>
          </Card>
          <Card className="bg-surface-container-low">
            <CardContent className="flex items-center justify-between p-5">
              <div>
                <p className="text-xs font-bold uppercase text-muted">Focus streak</p>
                <p className="mt-1 text-2xl font-bold">3 days</p>
              </div>
              <CheckCircle2 className="h-9 w-9 text-primary" />
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="mb-10">
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="flex items-center gap-2 text-2xl font-bold text-primary">
            Today&apos;s mission
            <Flag className="h-5 w-5" />
          </h2>
          <Link className="text-sm font-bold text-primary hover:underline" href="/assignments">
            View planner
          </Link>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {dashboard.todayMission.slice(0, 3).map((item, index) => (
            <div
              key={item}
              className={`sticky-note ${noteStyles[index % noteStyles.length]} relative flex min-h-44 flex-col rounded-lg p-5`}
            >
              <p className="text-xs font-bold uppercase text-muted">Priority {index + 1}</p>
              <p className="mt-3 text-xl font-bold">{item}</p>
              <div className="mt-auto flex items-center justify-between pt-6">
                <Badge tone={index === 0 ? "high" : "medium"}>{index === 0 ? "start first" : "next"}</Badge>
                <CheckCircle2 className="h-6 w-6 text-primary/50" />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
        <div className="space-y-4">
          <h2 className="mb-4 text-2xl font-bold text-primary">Due today</h2>
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
              <p className="rounded-lg border-2 border-surface-variant bg-surface-container p-5 text-sm text-muted">
                Nothing due today from the latest sync.
              </p>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="flex items-center gap-2 text-2xl font-bold text-primary">
            New announcements
            <Bell className="h-5 w-5" />
          </h2>
          {dashboard.announcements.slice(0, 4).map((announcement) => (
            <a
              key={announcement.id}
              href={announcement.htmlUrl || "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-lg border-2 border-surface-variant bg-card p-5 bubbly-shadow transition hover:border-primary"
            >
              <p className="text-sm font-bold text-primary">{announcement.courseName}</p>
              <p className="mt-1 font-bold">{announcement.title}</p>
            </a>
          ))}
        </div>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-4 text-2xl font-bold text-primary">Due this week</h2>
          <div className="grid gap-3">
            {dashboard.dueThisWeek.slice(0, 4).map((assignment) => (
              <div key={assignment.id} className="rounded-lg border-2 border-surface-variant bg-card p-4 bubbly-shadow">
                <p className="text-sm font-bold text-primary">{assignment.courseName}</p>
                <p className="mt-1 font-bold">{assignment.name}</p>
                <p className="mt-1 text-sm text-muted">
                  {formatDateTime(assignment.dueAt, dashboard.timezone)}
                </p>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h2 className="mb-4 flex items-center gap-2 text-2xl font-bold text-primary">
            Recently added files
            <FolderOpen className="h-5 w-5" />
          </h2>
          <div className="grid gap-3">
            {dashboard.files.slice(0, 4).map((file) => (
              <a
                key={file.id}
                href={file.url || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border-2 border-surface-variant bg-card p-4 bubbly-shadow transition hover:border-primary"
              >
                <p className="text-sm font-bold text-primary">{file.courseName}</p>
                <p className="mt-1 font-bold">{file.name}</p>
              </a>
            ))}
          </div>
        </div>
      </section>
    </AppShell>
  );
}
