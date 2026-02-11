import { describe, expect, it, vi } from "vitest";
import { ProposalPrintService } from "../server/application/proposals/proposal-print-service";

describe("ProposalPrintService", () => {
  it("returns 404 when proposal is missing for token generation", async () => {
    const storage = {
      getProposalById: vi.fn().mockResolvedValue(undefined),
    } as any;
    const service = new ProposalPrintService(storage, {} as any);

    const result = await service.createPrintToken({ proposalId: "p1", userId: "u1", agencyId: "a1", role: "Admin" });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
    expect(result.error).toBe("Proposal not found");
  });

  it("returns 403 when non-admin attempts token generation", async () => {
    const storage = {
      getProposalById: vi.fn().mockResolvedValue({ id: "p1", agencyId: "a1" }),
    } as any;
    const deps = {
      generatePrintToken: vi.fn(),
      validatePrintToken: vi.fn(),
      parseMarkdown: vi.fn(),
      now: vi.fn(),
    } as any;
    const service = new ProposalPrintService(storage, deps);

    const result = await service.createPrintToken({ proposalId: "p1", userId: "u1", agencyId: "a1", role: "Staff" });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(403);
    expect(result.error).toBe("Only admins can export proposals");
  });

  it("returns 401 html when print token missing", async () => {
    const service = new ProposalPrintService({} as any, {} as any);
    const result = await service.renderPrintView({ proposalId: "p1", token: undefined });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(401);
    expect(result.error).toContain("Print token required");
  });

  it("returns 403 html when token agency mismatches proposal", async () => {
    const storage = {
      getProposalById: vi.fn().mockResolvedValue({ id: "p1", agencyId: "a2" }),
    } as any;
    const deps = {
      generatePrintToken: vi.fn(),
      validatePrintToken: vi.fn().mockResolvedValue({ userId: "u1", agencyId: "a1", role: "Admin" }),
      parseMarkdown: vi.fn(),
      now: vi.fn(),
    } as any;
    const service = new ProposalPrintService(storage, deps);

    const result = await service.renderPrintView({ proposalId: "p1", token: "t1" });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(403);
    expect(result.error).toContain("Invalid print token for this proposal");
  });

  it("renders html when token and proposal are valid", async () => {
    const storage = {
      getProposalById: vi.fn().mockResolvedValue({
        id: "p1",
        agencyId: "a1",
        dealId: "d1",
        name: "Proposal A",
        status: "draft",
        createdAt: new Date("2026-01-01"),
      }),
      getProposalSectionsByProposalId: vi.fn().mockResolvedValue([{ title: "Intro", content: "# Hello" }]),
      getDealById: vi.fn().mockResolvedValue({ id: "d1", contactId: "c1" }),
      getContactById: vi.fn().mockResolvedValue({ firstName: "Alex", lastName: "Doe", email: "a@x.com", phone: null }),
    } as any;
    const deps = {
      generatePrintToken: vi.fn(),
      validatePrintToken: vi.fn().mockResolvedValue({ userId: "u1", agencyId: "a1", role: "Admin" }),
      parseMarkdown: vi.fn().mockResolvedValue("<h1>Hello</h1>"),
      now: vi.fn().mockReturnValue(new Date("2026-02-11")),
    } as any;
    const service = new ProposalPrintService(storage, deps);

    const result = await service.renderPrintView({ proposalId: "p1", token: "t1" });

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.data?.html).toContain("Proposal A");
    expect(result.data?.html).toContain("<h1>Hello</h1>");
  });
});
