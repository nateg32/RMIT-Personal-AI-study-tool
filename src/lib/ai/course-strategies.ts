import type { AssignmentContextPack } from "@/lib/types";
import { cleanPlannerText } from "@/lib/ai/planning-text";

type StudyPlanningInput = {
  durationMinutes: number;
  extraContext?: string;
  context: AssignmentContextPack;
};

function sourceTextForPlanning(input: StudyPlanningInput, max = 4_000) {
  return cleanPlannerText(
    [
      input.extraContext,
      input.context.assignment.name,
      input.context.assignment.description,
      input.context.assignment.rubricSummary,
      input.context.relatedResources.map((resource) => resource.title).join(" "),
      input.context.relatedFiles.map((resource) => resource.title).join(" "),
    ]
      .filter(Boolean)
      .join(" "),
    max,
  );
}

function extractListedWorkItems(source: string) {
  const text = cleanPlannerText(source, 4_000);
  const matches = Array.from(
    text.matchAll(
      /\b(Lab\s*[-:]?\s*\d+|Activity)\s*[-:]?\s*([\s\S]*?)(?=\s+\b(?:Lab\s*[-:]?\s*\d+|Activity)\b|\s+\b(?:Learning Outcomes?|Course Learning Outcomes?|Deadline|Weighting|Submission|IMPORTANT)\b|$)/gi,
    ),
  );
  const seen = new Set<string>();

  return matches
    .map((match) => {
      const label = cleanPlannerText(match[1], 28).replace(/\s+/g, " ");
      const name = cleanPlannerText(match[2], 90)
        .replace(/\s*(?:Lab|Activity)\s*[-:]?\s*$/i, "")
        .trim();
      if (!label || !name) return "";
      return `${label.replace(/lab/i, "Lab").replace(/activity/i, "Activity")}: ${name}`;
    })
    .filter((item) => {
      const key = item.toLowerCase();
      if (!item || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 10);
}

function isAwsAcademyLabTask(input: StudyPlanningInput) {
  const source = sourceTextForPlanning(input).toLowerCase();
  return (
    source.includes("aws academy") ||
    source.includes("aws cloud foundations") ||
    (source.includes("lab") && source.includes("activity") && source.includes("aws"))
  );
}

export function taskSpecificDeliverables(input: StudyPlanningInput) {
  if (!isAwsAcademyLabTask(input)) return null;
  const listed = extractListedWorkItems(sourceTextForPlanning(input));
  const firstHalf = listed.slice(0, Math.ceil(listed.length / 2));
  const secondHalf = listed.slice(Math.ceil(listed.length / 2));

  return [
    firstHalf.length
      ? `Complete these AWS Academy items first: ${firstHalf.join("; ")}`
      : "Open AWS Academy Cloud Foundations and check which labs or activities are still incomplete.",
    secondHalf.length
      ? `Complete the remaining AWS Academy items: ${secondHalf.join("; ")}`
      : "Work through the remaining AWS Academy labs or activities in the milestone.",
    "Press the AWS Academy submit/check-completion action for each finished lab or activity.",
    "Save quick evidence of completion, such as screenshots or completion notes, in case Canvas still shows unsubmitted.",
    "Recheck the Canvas brief only for deadline, weighting, and external submission instructions.",
  ].slice(0, 5);
}

export function taskSpecificCriteria(input: StudyPlanningInput) {
  if (!isAwsAcademyLabTask(input)) return null;

  return [
    "Every listed AWS Academy lab/activity is completed in the AWS Academy platform.",
    "Each item has been submitted or marked complete inside AWS Academy, not just opened.",
    "Completion evidence is saved so you can prove progress if Canvas does not update.",
    "Canvas instructions are checked for deadline, weighting, and any special submission note.",
  ];
}

export function taskSpecificSummary(input: StudyPlanningInput) {
  const assignment = input.context.assignment;
  if (!isAwsAcademyLabTask(input)) return "";
  const listed = extractListedWorkItems(sourceTextForPlanning(input));
  const itemCount = listed.length || 8;

  return `${assignment.name} is an external AWS Academy completion task. The work is to finish ${itemCount} listed labs/activities in AWS Academy, submit/check completion there, and keep evidence because Canvas may not track the external platform status.`;
}

export function taskSpecificBlocks(
  input: StudyPlanningInput,
  deliverables: string[],
  resources: AssignmentContextPack["relatedResources"],
) {
  if (!isAwsAcademyLabTask(input)) return null;
  const duration = input.durationMinutes;
  const listed = extractListedWorkItems(sourceTextForPlanning(input));
  const firstHalf = listed.slice(0, Math.ceil(listed.length / 2));
  const secondHalf = listed.slice(Math.ceil(listed.length / 2));
  const awsResource = resources.find((resource) => /aws|academy|milestone|lab/i.test(resource.title));

  return [
    {
      name: "Check AWS Academy progress",
      minutes: Math.max(8, Math.round(duration * 0.15)),
      goal: "Know exactly which listed items are unfinished before doing work.",
      tasks: [
        "Open the Canvas brief, then open the linked AWS Academy Cloud Foundations course.",
        "Compare AWS Academy completion status against the milestone list.",
        listed.length
          ? `Mark unfinished items from this list: ${listed.join("; ")}`
          : "Mark every unfinished lab or activity in the milestone.",
      ],
      resources: ["Canvas assignment", awsResource?.title].filter((item): item is string => Boolean(item)),
      breakMinutes: duration >= 60 ? 3 : 0,
    },
    {
      name: "Finish the first AWS items",
      minutes: Math.max(15, Math.round(duration * 0.3)),
      goal: "Complete the first chunk inside AWS Academy, not in Canvas.",
      tasks: [
        firstHalf.length ? `Complete: ${firstHalf.join("; ")}` : deliverables[0],
        "Use the AWS Academy lab instructions step by step and do not skip validation/check steps.",
        "Take a screenshot or note when each item shows complete/submitted.",
      ],
      resources: [awsResource?.title || "AWS Academy Cloud Foundations"],
      breakMinutes: duration >= 75 ? 5 : 0,
    },
    {
      name: "Finish the remaining AWS items",
      minutes: Math.max(18, Math.round(duration * 0.35)),
      goal: "Clear the remaining listed labs/activities and keep proof.",
      tasks: [
        secondHalf.length ? `Complete: ${secondHalf.join("; ")}` : deliverables[1],
        "Submit or check completion for each item inside AWS Academy.",
        "Write down any item that is blocked so the next session starts cleanly.",
      ],
      resources: [awsResource?.title || "AWS Academy Cloud Foundations"],
      breakMinutes: duration >= 90 ? 5 : 0,
    },
    {
      name: "Submission evidence check",
      minutes: Math.max(8, duration - Math.round(duration * 0.8)),
      goal: "Leave with confidence that the external-platform submission is done.",
      tasks: [
        "Confirm every required AWS Academy item shows complete/submitted.",
        "Save evidence in a folder or notes file.",
        "Return to Canvas and note that the milestone is externally completed if Canvas still says unsubmitted.",
      ],
      resources: ["Canvas assignment", "AWS Academy Cloud Foundations"],
    },
  ];
}
