import { describe, expect, it, vi } from "vitest";
import { TestUserService } from "../server/application/test/test-user-service";
import { createTestCreateUserHandler } from "../server/routes/test";

describe("Test route handlers", () => {
  it("delegates create-user", async () => {
    const createUser = vi.fn().mockResolvedValue({ ok: true, status: 201, data: { message: "ok" } });
    const service = { createUser } as unknown as TestUserService;
    const handler = createTestCreateUserHandler(service);
    const req = {
      body: {
        email: "a@b.com",
        password: "secret",
        fullName: "A",
        role: "Client",
        companyName: "Acme",
        agencyId: "agency-1",
      },
    } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(createUser).toHaveBeenCalledWith({
      env: process.env.NODE_ENV,
      email: "a@b.com",
      password: "secret",
      fullName: "A",
      role: "Client",
      companyName: "Acme",
      requestedAgencyId: "agency-1",
    });
    expect(res.status).toHaveBeenCalledWith(201);
  });
});
