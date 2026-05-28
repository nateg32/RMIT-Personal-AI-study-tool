import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { getAnnouncementsForUser } from "@/lib/data/lists";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AnnouncementsPage() {
  const user = await requireUser();
  const announcements = await getAnnouncementsForUser(user);

  return (
    <AppShell>
      <PageHeader eyebrow="Signals" title="Announcements" description="Recent lecturer updates and course notices." />
      <div className="grid gap-4">
        {announcements.map((announcement) => {
          const message =
            "message" in announcement && typeof announcement.message === "string"
              ? announcement.message
              : "";
          return (
            <Card key={announcement.id}>
              <CardHeader>
                <Badge tone="medium">{announcement.courseName}</Badge>
                <CardTitle className="mt-3">{announcement.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted">
                <p>{formatDateTime(announcement.postedAt, user.timezone)}</p>
                {message ? <p>{message}</p> : null}
                {announcement.htmlUrl ? (
                  <a className="font-medium text-primary" href={announcement.htmlUrl} target="_blank" rel="noopener noreferrer">
                    Open announcement
                  </a>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </AppShell>
  );
}
