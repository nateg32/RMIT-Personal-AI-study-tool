import StudySidekickApp from "@/components/study-sidekick/App";
import type { ViewType } from "@/components/study-sidekick/lib/utils";
import { requirePageUser } from "@/lib/auth";

export async function StudySidekickPage({ initialView }: { initialView: ViewType }) {
  await requirePageUser();
  return <StudySidekickApp initialView={initialView} />;
}
