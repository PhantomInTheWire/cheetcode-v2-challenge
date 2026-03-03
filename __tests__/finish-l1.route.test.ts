import { describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  withAuthenticatedSessionMock: vi.fn(),
}));

vi.mock("../src/lib/route-handler", () => ({
  withAuthenticatedSession: hoisted.withAuthenticatedSessionMock,
}));

describe("/api/finish-l1", () => {
  it("delegates request handling through withAuthenticatedSession", async () => {
    hoisted.withAuthenticatedSessionMock.mockResolvedValueOnce(
      Response.json({ ok: true }, { status: 200 }),
    );

    const { POST } = await import("../src/app/api/finish-l1/route");
    const req = new Request("http://localhost/api/finish-l1", { method: "POST" });
    const res = await POST(req);

    expect(hoisted.withAuthenticatedSessionMock).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
