import { describe, expect, it, vi } from "vitest";
import { ProposalPrintService } from "../server/application/proposals/proposal-print-service";
import { createProposalPrintTokenHandler, createProposalPrintViewHandler } from "../server/routes/proposals";

describe("Proposals route handlers", () => {
  it("delegates print-token creation", async () => {
    const createPrintToken = vi.fn().mockResolvedValue({ ok: true, status: 200, data: { token: "t1" } });
    const service = { createPrintToken } as unknown as ProposalPrintService;
    const handler = createProposalPrintTokenHandler(service);
    const req = { params: { id: "p1" }, user: { id: "u1", agencyId: "a1", role: "Admin" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(createPrintToken).toHaveBeenCalledWith({ proposalId: "p1", userId: "u1", agencyId: "a1", role: "Admin" });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates printable view rendering", async () => {
    const renderPrintView = vi.fn().mockResolvedValue({ ok: true, status: 200, data: { html: "<html></html>" } });
    const service = { renderPrintView } as unknown as ProposalPrintService;
    const handler = createProposalPrintViewHandler(service);
    const req = { params: { id: "p1" }, query: { token: "t1" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn(), send: vi.fn(), setHeader: vi.fn() };

    await handler(req, res);

    expect(renderPrintView).toHaveBeenCalledWith({ proposalId: "p1", token: "t1" });
    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "text/html");
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
