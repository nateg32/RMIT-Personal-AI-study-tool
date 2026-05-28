import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePageUser } from "@/lib/auth";
import { getFilesForUser } from "@/lib/data/lists";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function FilesPage() {
  const user = await requirePageUser();
  const files = await getFilesForUser(user);

  return (
    <AppShell>
      <PageHeader eyebrow="Materials" title="Files" description="Recently added or updated Canvas files." />
      <div className="grid gap-4 md:grid-cols-2">
        {files.map((file) => (
          <Card key={file.id}>
            <CardHeader>
              <CardTitle>{file.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted">
              <p>{file.courseName}</p>
              <p>Updated {formatDateTime(file.updatedAtCanvas, user.timezone)}</p>
              {file.url ? (
                <a className="font-medium text-primary" href={file.url} target="_blank" rel="noopener noreferrer">
                  Open file
                </a>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
