import { describe, expect, it, vi } from "vitest";
import { AgencyProjectService } from "../server/application/agency/agency-project-service";

describe("AgencyProjectService", () => {
  it("fails list when non-superadmin has no agency", async () => {
    const service = new AgencyProjectService({} as any);
    const result = await service.listProjects({ isSuperAdmin: false, agencyId: undefined });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(403);
    expect(result.error).toBe("Agency association required");
  });

  it("lists all projects for superadmin", async () => {
    const storage = {
      getAllProjects: vi.fn().mockResolvedValue([{ id: "project-1" }]),
    } as any;
    const service = new AgencyProjectService(storage);

    const result = await service.listProjects({ isSuperAdmin: true, agencyId: undefined });

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(storage.getAllProjects).toHaveBeenCalledWith();
  });

  it("fails create when user lacks agency and is not superadmin", async () => {
    const service = new AgencyProjectService({} as any);
    const result = await service.createProject({ isSuperAdmin: false, agencyId: undefined }, { name: "X" });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(403);
    expect(result.error).toBe("Agency association required");
  });

  it("fails create when client does not belong to agency", async () => {
    const storage = {
      getClientById: vi.fn().mockResolvedValue({ id: "client-1", agencyId: "agency-2" }),
    } as any;
    const service = new AgencyProjectService(storage);

    const result = await service.createProject(
      { isSuperAdmin: false, agencyId: "agency-1" },
      { name: "Project", status: "Planning", clientId: "client-1" }
    );

    expect(result.ok).toBe(false);
    expect(result.status).toBe(403);
    expect(result.error).toBe("Client does not belong to your agency");
  });

  it("fails closed on invalid project payload", async () => {
    const storage = {
      getClientById: vi.fn(),
      createProject: vi.fn(),
    } as any;
    const service = new AgencyProjectService(storage);

    const result = await service.createProject({ isSuperAdmin: false, agencyId: "agency-1" }, { name: "Project" });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
  });

  it("returns 404 when project is missing", async () => {
    const storage = {
      getProjectWithTasks: vi.fn().mockResolvedValue(undefined),
    } as any;
    const service = new AgencyProjectService(storage);

    const result = await service.getProject("project-1");

    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
    expect(result.error).toBe("Project not found");
  });
});
