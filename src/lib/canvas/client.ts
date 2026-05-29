import { setTimeout as delay } from "node:timers/promises";
import { redactSecret } from "@/lib/utils";

type Fetcher = typeof fetch;

function normalizeAccessToken(token: string) {
  let normalized = token
    .trim()
    .replace(/^Bearer\s+/i, "")
    .replace(/^["'`]|["'`]$/g, "")
    .trim();

  if (normalized.startsWith("[") && normalized.endsWith("]")) {
    normalized = normalized.slice(1, -1).trim();
  }

  return normalized
    .replace(/[\u0000-\u001f\u007f\s]+/g, "")
    .replace(/[^\x21-\x7e]/g, "");
}

export type CanvasCourse = {
  id: number;
  name?: string;
  course_code?: string;
  workflow_state?: string;
  term?: { name?: string };
};

export type CanvasAssignment = {
  id: number;
  name: string;
  description?: string | null;
  due_at?: string | null;
  lock_at?: string | null;
  points_possible?: number | null;
  html_url?: string | null;
  submission_types?: string[];
  created_at?: string | null;
  updated_at?: string | null;
  submission?: CanvasSubmission | null;
  rubric?: CanvasRubricCriterion[] | null;
  rubric_settings?: Record<string, unknown> | null;
  all_dates?: unknown[] | null;
  overrides?: unknown[] | null;
  score_statistics?: Record<string, unknown> | null;
};

export type CanvasRubricCriterion = {
  id?: string;
  description?: string | null;
  long_description?: string | null;
  points?: number | null;
  ratings?: Array<{
    id?: string;
    description?: string | null;
    long_description?: string | null;
    points?: number | null;
  }>;
};

export type CanvasSubmission = {
  submitted_at?: string | null;
  workflow_state?: string | null;
  score?: number | null;
  grade?: string | null;
  late?: boolean;
  missing?: boolean;
  attempt?: number | null;
};

export type CanvasAnnouncement = {
  id: number;
  title: string;
  message?: string | null;
  posted_at?: string | null;
  delayed_post_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  context_code?: string | null;
  html_url?: string | null;
  url?: string | null;
};

export type CanvasFile = {
  id: number;
  display_name?: string;
  filename?: string;
  url?: string;
  "content-type"?: string;
  size?: number;
  created_at?: string | null;
  updated_at?: string | null;
};

export type CanvasModuleItem = {
  id: number;
  title?: string;
  type?: string;
  content_id?: number | null;
  html_url?: string | null;
  url?: string | null;
  external_url?: string | null;
  page_url?: string | null;
  position?: number | null;
  published?: boolean | null;
};

export type CanvasModule = {
  id: number;
  name?: string;
  position?: number;
  items?: CanvasModuleItem[];
};

export class CanvasClient {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly fetcher: Fetcher;
  private readonly timeoutMs: number;

  constructor(input: {
    baseUrl: string;
    token: string;
    fetcher?: Fetcher;
    timeoutMs?: number;
  }) {
    this.baseUrl = input.baseUrl.replace(/\/$/, "");
    this.token = normalizeAccessToken(input.token);
    this.fetcher = input.fetcher || fetch;
    this.timeoutMs = input.timeoutMs || 20_000;
  }

  async getCurrentUser() {
    return this.request<{ id: number; name: string; login_id?: string; primary_email?: string }>(
      "/api/v1/users/self/profile",
    );
  }

  async getCourses() {
    return this.getAllPages<CanvasCourse>(
      "/api/v1/courses?enrollment_state=active&include[]=term&per_page=50",
    );
  }

  async getAssignmentsWithSubmissions(courseId: number) {
    return this.getAllPages<CanvasAssignment>(
      `/api/v1/courses/${courseId}/assignments?include[]=submission&include[]=all_dates&include[]=overrides&include[]=score_statistics&order_by=due_at&per_page=100`,
    );
  }

  async getAssignmentDetails(courseId: number, assignmentId: number) {
    return this.request<CanvasAssignment>(
      `/api/v1/courses/${courseId}/assignments/${assignmentId}?include[]=submission&include[]=overrides&include[]=score_statistics&all_dates=true`,
    );
  }

  async getRecentAnnouncements(courseIds: number[], startDate: Date, endDate: Date) {
    if (courseIds.length === 0) return [];
    const params = new URLSearchParams({
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      active_only: "true",
      per_page: "50",
    });
    for (const courseId of courseIds) params.append("context_codes[]", `course_${courseId}`);
    return this.getAllPages<CanvasAnnouncement>(`/api/v1/announcements?${params}`);
  }

  async getCourseAnnouncements(courseId: number) {
    return this.getAllPages<CanvasAnnouncement>(
      `/api/v1/courses/${courseId}/discussion_topics?only_announcements=true&order_by=recent_activity&per_page=100`,
    );
  }

  async getCourseFiles(courseId: number, maxItems?: number) {
    return this.getAllPages<CanvasFile>(`/api/v1/courses/${courseId}/files?per_page=50`, maxItems);
  }

  async getCourseModulesWithItems(courseId: number, maxItems?: number) {
    return this.getAllPages<CanvasModule>(
      `/api/v1/courses/${courseId}/modules?include[]=items&per_page=50`,
      maxItems,
    );
  }

  async getRubricsIfAvailable(courseId: number) {
    try {
      return await this.getAllPages<unknown>(`/api/v1/courses/${courseId}/rubrics?per_page=50`);
    } catch {
      return [];
    }
  }

  async getAllPages<T>(pathOrUrl: string, maxItems?: number) {
    const items: T[] = [];
    let nextUrl: string | null = this.toUrl(pathOrUrl);
    while (nextUrl && (!maxItems || items.length < maxItems)) {
      const page: { data: T[]; next: string | null } =
        await this.requestWithMeta<T[]>(nextUrl);
      items.push(...page.data);
      nextUrl = page.next;
    }
    return maxItems ? items.slice(0, maxItems) : items;
  }

  async request<T>(pathOrUrl: string) {
    const { data } = await this.requestWithMeta<T>(pathOrUrl);
    return data;
  }

  private async requestWithMeta<T>(pathOrUrl: string, attempt = 0): Promise<{ data: T; next: string | null }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetcher(this.toUrl(pathOrUrl), {
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: "application/json",
        },
        signal: controller.signal,
      });

      if ((response.status === 429 || response.status === 403) && attempt < 3) {
        const body = await response.text().catch(() => "");
        if (response.status === 429 || body.toLowerCase().includes("rate limit")) {
          await delay(500 * 2 ** attempt);
          return this.requestWithMeta<T>(pathOrUrl, attempt + 1);
        }
      }

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(
          redactSecret(`Canvas request failed ${response.status}: ${text || response.statusText}`),
        );
      }

      const data = (await response.json()) as T;
      return { data, next: this.getNextLink(response.headers.get("link")) };
    } finally {
      clearTimeout(timeout);
    }
  }

  private toUrl(pathOrUrl: string) {
    if (pathOrUrl.startsWith("http")) return pathOrUrl;
    return `${this.baseUrl}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
  }

  private getNextLink(header: string | null) {
    if (!header) return null;
    for (const part of header.split(",")) {
      const match = part.match(/<([^>]+)>;\s*rel="next"/i);
      if (match?.[1]) return match[1];
    }
    return null;
  }
}
