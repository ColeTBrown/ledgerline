import { NextResponse } from "next/server";
import { z } from "zod";
import { demoRequestSchema } from "@/lib/validation/demo-request";

/**
 * Demo request intake. For now this only validates and logs; wire it to a
 * CRM or email provider when one is chosen.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = demoRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Validation failed.", issues: z.flattenError(parsed.error).fieldErrors },
      { status: 422 },
    );
  }

  console.info("[demo-request]", { ...parsed.data, receivedAt: new Date().toISOString() });
  return NextResponse.json({ ok: true });
}
