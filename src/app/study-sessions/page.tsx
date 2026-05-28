import type { StudyPlan } from "@/lib/types";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { StudySessionRunner } from "@/components/study-session-runner";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { getStudySessionsForUser } from "@/lib/data/lists";

export const dynamic = "force-dynamic";

export default async function StudySessionsPage() {
  const user = await requireUser();
  const sessions = await getStudySessionsForUser(user);

  return (
    <AppShell>
      <PageHeader eyebrow="Focus" title="Study sessions" description="Generated plans and progress checkpoints." />
      <div className="grid gap-4">
        {sessions.length === 0 ? (
          <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted">
            Create your first study session from the assignments page.
          </p>
        ) : (
          sessions.map((session) => {
            const plan = session.generatedPlanJson as unknown as StudyPlan;
            return (
              <Card key={session.id}>
                <CardHeader>
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle>{session.title}</CardTitle>
                    <Badge tone={plan.riskLevel}>{plan.riskLevel}</Badge>
                  </div>
                  <p className="text-sm text-muted">
                    {session.durationMinutes} minutes - {session.status}
                  </p>
                </CardHeader>
                <div className="px-5 pb-5">
                  <StudySessionRunner sessionId={session.id} initialPlan={plan} status={session.status} />
                </div>
              </Card>
            );
          })
        )}
      </div>
    </AppShell>
  );
}
