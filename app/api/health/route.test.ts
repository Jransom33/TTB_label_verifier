import { GET } from "@/app/api/health/route";
import { expect, test } from "vitest";

/*
 * Assumption: health is a 200 `{ data: { status: "ok" }, requestId }` envelope.
 * This does not prove a live deployment probe will accept that shape.
 * Follow-up: verification failure tests and README contract docs.
 */
test("GET /api/health returns the availability envelope and hides secrets", async () => {
  // Plant a fake secret so the assertion fails if the route ever echoes env.
  process.env.PROVIDER_API_KEY = "secret-value-do-not-leak";

  const response = GET();
  const body: unknown = await response.json();
  const text = JSON.stringify(body);

  expect(response.status).toBe(200);
  expect(body).toEqual({
    data: { status: "ok" },
    requestId: expect.stringMatching(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    ),
  });
  expect(response.headers.get("x-request-id")).toBe(
    (body as { requestId: string }).requestId,
  );

  expect(text).not.toContain("secret-value-do-not-leak");
  expect(text.toLowerCase()).not.toMatch(/openai|anthropic|google|azure|provider/i);
  expect(text).not.toContain("PROVIDER_API_KEY");
});
