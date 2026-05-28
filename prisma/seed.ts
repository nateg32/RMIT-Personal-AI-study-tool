import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.upsert({
    where: { email: "s4169571@student.rmit.edu.au" },
    create: {
      email: "s4169571@student.rmit.edu.au",
      name: "Nathaniel Kipkogey Gaitho",
      timezone: "Australia/Sydney",
    },
    update: {
      name: "Nathaniel Kipkogey Gaitho",
      timezone: "Australia/Sydney",
    },
  });

  const courses = [
    { canvasCourseId: 157395, name: "Algorithms and Analysis", courseCode: "COSC2123" },
    { canvasCourseId: 158381, name: "Cloud Foundations", courseCode: "COSC2757" },
    { canvasCourseId: 161436, name: "Introduction to Cyber Security", courseCode: "INTE2625" },
    { canvasCourseId: 158444, name: "Software Engineering Fundamentals", courseCode: "ISYS3413" },
  ];

  for (const course of courses) {
    await prisma.course.upsert({
      where: { userId_canvasCourseId: { userId: user.id, canvasCourseId: course.canvasCourseId } },
      create: { userId: user.id, ...course, term: "UGRD Semester 1 2026", active: true },
      update: { ...course, active: true },
    });
  }

  const cloud = await prisma.course.findUniqueOrThrow({
    where: { userId_canvasCourseId: { userId: user.id, canvasCourseId: 158381 } },
  });

  const assignment = await prisma.assignment.upsert({
    where: { courseId_canvasAssignmentId: { courseId: cloud.id, canvasAssignmentId: 1215560 } },
    create: {
      userId: user.id,
      courseId: cloud.id,
      canvasAssignmentId: 1215560,
      name: "Milestone 2.2 AWS Academy Labs and Activities",
      description:
        "Complete the AWS Academy lab activities for Milestone 2.2, collect evidence of completion, and submit the required files through Canvas.",
      dueAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
      pointsPossible: 8,
      htmlUrl: "https://rmit.instructure.com/courses/158381/assignments/1215560",
      submissionTypes: ["online_upload"],
      rubric: [
        {
          description: "Lab completion evidence",
          points: 4,
          long_description: "Screenshots or AWS Academy evidence clearly show the required activities are complete.",
        },
        {
          description: "Accuracy and completeness",
          points: 3,
          long_description: "Submitted work matches the milestone requirements and uses correct naming/format.",
        },
        {
          description: "Submission quality",
          points: 1,
          long_description: "Canvas submission is readable, organised, and uploaded before the deadline.",
        },
      ],
      rubricSummary:
        "Lab completion evidence (4 pts): screenshots or AWS Academy evidence clearly show the required activities are complete | Accuracy and completeness (3 pts): submitted work matches the milestone requirements and uses correct naming/format | Submission quality (1 pt): Canvas submission is readable, organised, and uploaded before the deadline",
    },
    update: {
      description:
        "Complete the AWS Academy lab activities for Milestone 2.2, collect evidence of completion, and submit the required files through Canvas.",
      dueAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
      pointsPossible: 8,
      rubric: [
        {
          description: "Lab completion evidence",
          points: 4,
          long_description: "Screenshots or AWS Academy evidence clearly show the required activities are complete.",
        },
        {
          description: "Accuracy and completeness",
          points: 3,
          long_description: "Submitted work matches the milestone requirements and uses correct naming/format.",
        },
        {
          description: "Submission quality",
          points: 1,
          long_description: "Canvas submission is readable, organised, and uploaded before the deadline.",
        },
      ],
      rubricSummary:
        "Lab completion evidence (4 pts): screenshots or AWS Academy evidence clearly show the required activities are complete | Accuracy and completeness (3 pts): submitted work matches the milestone requirements and uses correct naming/format | Submission quality (1 pt): Canvas submission is readable, organised, and uploaded before the deadline",
    },
  });

  await prisma.canvasResource.upsert({
    where: { courseId_canvasModuleItemId: { courseId: cloud.id, canvasModuleItemId: 9001001 } },
    create: {
      userId: user.id,
      courseId: cloud.id,
      canvasModuleItemId: 9001001,
      moduleName: "Week 12",
      title: "Milestone 2.2 AWS Academy lab guide",
      resourceType: "File",
      htmlUrl: "https://rmit.instructure.com/courses/158381/files",
      position: 1,
      published: true,
    },
    update: {
      moduleName: "Week 12",
      title: "Milestone 2.2 AWS Academy lab guide",
      resourceType: "File",
      htmlUrl: "https://rmit.instructure.com/courses/158381/files",
      position: 1,
      published: true,
    },
  });

  await prisma.submission.upsert({
    where: { assignmentId: assignment.id },
    create: { assignmentId: assignment.id, workflowState: "unsubmitted", missing: false, late: false },
    update: { workflowState: "unsubmitted", missing: false, late: false },
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
