import { AppShell } from "@/components/app-shell";
import { AssignmentsClient } from "@/components/assignments-client";
import { PageHeader } from "@/components/page-header";
import { requirePageUser } from "@/lib/auth";
import { getAssignmentsForUser } from "@/lib/data/lists";

export const dynamic = "force-dynamic";

export default async function AssignmentsPage() {
  const user = await requirePageUser();
  const assignments = await getAssignmentsForUser(user);

  return (
    <AppShell>
      <PageHeader
        eyebrow="Execution"
        title="Assignments due"
        description="Filter, prioritise, open Canvas, or turn any assignment into a focused study session."
      />
      <AssignmentsClient assignments={assignments} timezone={user.timezone} />
    </AppShell>
  );
}
