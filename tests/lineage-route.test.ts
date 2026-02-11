import { describe, expect, it, vi } from "vitest";
import { LineageService } from "../server/application/lineage/lineage-service";
import { createProjectLineageHandler, createTaskLineageHandler } from "../server/routes/lineage";

describe("Lineage route handlers", () => {
  it("delegates task lineage to service", async () => {
    const getTaskLineage = vi.fn().mockResolvedValue({ ok: true, status: 200, data: { id: "task-1" } });
    const service = { getTaskLineage } as unknown as LineageService;
    const handler = createTaskLineageHandler(service);
    const req = { params: { taskId: "task-1" }, user: { agencyId: "agency-1", isSuperAdmin: false } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(getTaskLineage).toHaveBeenCalledWith("task-1", { agencyId: "agency-1", isSuperAdmin: false });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates project lineage to service", async () => {
    const getProjectLineage = vi.fn().mockResolvedValue({ ok: true, status: 200, data: { id: "project-1" } });
    const service = { getProjectLineage } as unknown as LineageService;
    const handler = createProjectLineageHandler(service);
    const req = { params: { projectId: "project-1" }, user: { agencyId: "agency-1", isSuperAdmin: false } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(getProjectLineage).toHaveBeenCalledWith("project-1", { agencyId: "agency-1", isSuperAdmin: false });
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

