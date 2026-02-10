import { describe, expect, it, vi } from "vitest";

vi.mock("../server/db", () => ({ db: {} }));

import type { AuthRequest } from "../server/middleware/supabase-auth";

const mockStorage = {
  getClientById: async (id: string) => ({ id, agencyId: "agency-b" }),
} as any;

describe("Tenant isolation", () => {
  it("denies cross-agency client access for admins", async () => {
    const { verifyClientAccess } = await import("../server/middleware/supabase-auth");
    const req = {
      user: {
        id: "user-1",
        email: "admin@example.com",
        role: "Admin",
        agencyId: "agency-a",
      },
    } as AuthRequest;

    const allowed = await verifyClientAccess(req, "client-1", mockStorage);
    expect(allowed).toBe(false);
  });
});
