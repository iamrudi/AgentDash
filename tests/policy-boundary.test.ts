import { describe, expect, it, vi } from "vitest";
import { policyBoundary } from "../server/middleware/policy-boundary";

describe("Policy boundary middleware", () => {
  it("rejects when no user is attached", () => {
    const middleware = policyBoundary("workflows");
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    const next = vi.fn();

    middleware({} as any, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("allows request when user is attached", () => {
    const middleware = policyBoundary("workflows");
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn(), locals: {} } as any;
    const next = vi.fn();

    middleware({ user: { id: "user-1" } } as any, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.locals.policyBoundary).toBe("workflows");
  });
});
