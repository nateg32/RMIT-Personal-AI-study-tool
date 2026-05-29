import { describe, expect, it, vi } from "vitest";
import { CanvasClient } from "@/lib/canvas/client";

describe("CanvasClient", () => {
  it("follows Canvas Link header pagination", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ id: 1 }]), {
          headers: { link: '<https://canvas.test/api/v1/courses?page=2>; rel="next"' },
        }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: 2 }])));

    const client = new CanvasClient({
      baseUrl: "https://canvas.test",
      token: "secret-token",
      fetcher: fetcher as unknown as typeof fetch,
    });

    await expect(client.getAllPages<{ id: number }>("/api/v1/courses")).resolves.toEqual([
      { id: 1 },
      { id: 2 },
    ]);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("retries rate-limited responses", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response("Rate Limit Exceeded", { status: 429 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 1 })));

    const client = new CanvasClient({
      baseUrl: "https://canvas.test",
      token: "secret-token",
      fetcher: fetcher as unknown as typeof fetch,
    });

    await expect(client.request<{ id: number }>("/api/v1/users/self/profile")).resolves.toEqual({ id: 1 });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("normalizes pasted Canvas tokens before sending the auth header", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 1 })));

    const client = new CanvasClient({
      baseUrl: "https://canvas.test",
      token: "Bearer 9595~abc\r\nDEF ",
      fetcher: fetcher as unknown as typeof fetch,
    });

    await client.request<{ id: number }>("/api/v1/users/self/profile");

    expect(fetcher).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer 9595~abcDEF",
        }),
      }),
    );
  });

  it("requests assignment rubrics and module items for richer context", async () => {
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify([]))));

    const client = new CanvasClient({
      baseUrl: "https://canvas.test",
      token: "secret-token",
      fetcher: fetcher as unknown as typeof fetch,
    });

    await client.getAssignmentsWithSubmissions(123);
    await client.getCourseModulesWithItems(123);

    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("include[]=rubric"),
      expect.objectContaining({ headers: expect.any(Object) }),
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("include[]=items"),
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });
});
