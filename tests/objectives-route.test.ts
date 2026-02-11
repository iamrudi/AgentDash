import { describe, expect, it, vi } from "vitest";
import { ObjectiveService } from "../server/application/objectives/objective-service";
import {
  createObjectivesListHandler,
  createObjectiveCreateHandler,
  createObjectiveUpdateHandler,
  createObjectiveDeleteHandler,
} from "../server/routes/objectives";

describe("Objectives route handlers", () => {
  it("delegates list to service", async () => {
    const listByClientId = vi.fn().mockResolvedValue({ ok: true, status: 200, data: [] });
    const service = { listByClientId } as unknown as ObjectiveService;
    const handler = createObjectivesListHandler(service);
    const req = { params: { clientId: "client-1" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(listByClientId).toHaveBeenCalledWith("client-1");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates create to service", async () => {
    const create = vi.fn().mockResolvedValue({ ok: true, status: 201, data: { id: "obj-1" } });
    const service = { create } as unknown as ObjectiveService;
    const handler = createObjectiveCreateHandler(service);
    const req = { params: { clientId: "client-1" }, body: { description: "d", targetMetric: "m" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(create).toHaveBeenCalledWith("client-1", { description: "d", targetMetric: "m" });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("delegates update to service", async () => {
    const update = vi.fn().mockResolvedValue({ ok: true, status: 200, data: { id: "obj-1" } });
    const service = { update } as unknown as ObjectiveService;
    const handler = createObjectiveUpdateHandler(service);
    const req = { params: { id: "obj-1" }, body: { description: "updated" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(update).toHaveBeenCalledWith("obj-1", { description: "updated" });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates delete to service", async () => {
    const remove = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    const service = { delete: remove } as unknown as ObjectiveService;
    const handler = createObjectiveDeleteHandler(service);
    const req = { params: { id: "obj-1" } } as any;
    const res = { status: vi.fn().mockReturnThis(), send: vi.fn() };

    await handler(req, res);

    expect(remove).toHaveBeenCalledWith("obj-1");
    expect(res.status).toHaveBeenCalledWith(204);
  });
});
