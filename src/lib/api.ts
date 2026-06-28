import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { isProductionRuntime } from "@/lib/env";
import { redactSecret } from "@/lib/utils";

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function jsonError(error: unknown, status = 500) {
  if (isProductionRuntime() && status >= 500) {
    return NextResponse.json({ error: "Unexpected error" }, { status });
  }

  const message =
    error instanceof ZodError
      ? "Invalid request"
      : error instanceof Error
        ? redactSecret(error.message)
        : "Unexpected error";

  return NextResponse.json({ error: message }, { status });
}

export async function parseJson<T>(
  request: Request,
  parser: { parse(value: unknown): T },
) {
  const body = await request.json().catch(() => null);
  return parser.parse(body);
}
