import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { getCoursesForUser } from "@/lib/data/lists";

export const dynamic = "force-dynamic";

export default async function CoursesPage() {
  const user = await requireUser();
  const courses = await getCoursesForUser(user);

  return (
    <AppShell>
      <PageHeader eyebrow="Canvas" title="Courses" description="Active Canvas courses from the latest sync." />
      <div className="grid gap-4 md:grid-cols-2">
        {courses.map((course) => (
          <Card key={course.id}>
            <CardHeader>
              <CardTitle>{course.name}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted">
              <p>{course.courseCode || "No course code"}</p>
              <p>{course.term || "No term"}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
