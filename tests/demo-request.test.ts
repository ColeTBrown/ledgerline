import { describe, expect, it } from "vitest";
import { demoRequestSchema } from "@/lib/validation/demo-request";
import { POST } from "@/app/api/demo-request/route";

const valid = { name: "Jordan Lee", email: "jordan@firm.com", firm: "Acme Capital", firmType: "Asset manager" };

describe("demo request schema", () => {
  it("accepts a valid request and coerces seats", () => {
    const r = demoRequestSchema.safeParse({ ...valid, seats: "25" });
    expect(r.success).toBe(true);
    expect(r.success && r.data.seats).toBe(25);
  });

  it("rejects bad email and unknown firm type", () => {
    expect(demoRequestSchema.safeParse({ ...valid, email: "nope" }).success).toBe(false);
    expect(demoRequestSchema.safeParse({ ...valid, firmType: "Bakery" }).success).toBe(false);
  });
});

describe("POST /api/demo-request", () => {
  const post = (body: string) =>
    POST(new Request("http://localhost/api/demo-request", { method: "POST", body, headers: { "content-type": "application/json" } }));

  it("returns 200 for valid input", async () => {
    const res = await post(JSON.stringify(valid));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("returns 422 with field issues for invalid input", async () => {
    const res = await post(JSON.stringify({ ...valid, email: "x" }));
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.issues.email).toBeDefined();
  });

  it("returns 400 for malformed JSON", async () => {
    const res = await post("{not json");
    expect(res.status).toBe(400);
  });
});
