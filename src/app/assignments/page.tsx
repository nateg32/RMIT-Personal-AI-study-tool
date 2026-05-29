import { StudySidekickPage } from "@/components/study-sidekick/study-sidekick-page";

export const dynamic = "force-dynamic";

export default async function AssignmentsPage() {
  return <StudySidekickPage initialView="assignments" />;
}
