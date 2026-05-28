import { ExternalLink, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getUrgency, isSubmitted } from "@/lib/prioritization";
import type { CanvasAssignmentSummary } from "@/lib/types";
import { formatDateTime, formatRelativeDue } from "@/lib/utils";

export function AssignmentCard({
  assignment,
  timezone = "Australia/Sydney",
  onCreate,
}: {
  assignment: CanvasAssignmentSummary;
  timezone?: string;
  onCreate?: (assignment: CanvasAssignmentSummary) => void;
}) {
  const urgency = getUrgency(assignment);
  const submitted = isSubmitted(assignment);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-muted">
              {assignment.courseName}
              {assignment.courseCode ? ` · ${assignment.courseCode}` : ""}
            </p>
            <CardTitle className="mt-1">{assignment.name}</CardTitle>
          </div>
          <Badge tone={urgency.label}>{urgency.label}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <p className="text-muted">Due</p>
            <p className="font-medium">{formatDateTime(assignment.dueAt, timezone)}</p>
          </div>
          <div>
            <p className="text-muted">Status</p>
            <p className="font-medium">{submitted ? "Submitted" : "Unsubmitted"}</p>
          </div>
          <div>
            <p className="text-muted">Estimated time</p>
            <p className="font-medium">{urgency.estimatedTime}</p>
          </div>
        </div>
        <p className="text-sm text-muted">
          {formatRelativeDue(assignment.dueAt, timezone)} · {urgency.reason}
          {assignment.pointsPossible ? ` · ${assignment.pointsPossible} pts` : ""}
        </p>
        <div className="flex flex-wrap gap-2">
          {assignment.htmlUrl ? (
            <ButtonLink href={assignment.htmlUrl} variant="secondary" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
              Open Canvas
            </ButtonLink>
          ) : null}
          {onCreate ? (
            <Button type="button" onClick={() => onCreate(assignment)}>
              <Sparkles className="h-4 w-4" />
              Create Study Session
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
