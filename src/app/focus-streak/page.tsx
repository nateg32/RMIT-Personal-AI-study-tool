import { StudySidekickPage } from "@/components/study-sidekick/study-sidekick-page";

export const dynamic = "force-dynamic";

export default async function FocusStreakPage() {
  return <StudySidekickPage initialView="streak" />;
}
