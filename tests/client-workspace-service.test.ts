import { describe, expect, it, vi } from "vitest";
import { ClientWorkspaceService } from "../server/application/client/client-workspace-service";

describe("ClientWorkspaceService", () => {
  it("returns empty messages when client record is missing", async () => {
    const storage = {
      getProfileByUserId: vi.fn().mockResolvedValue({ id: "profile-1" }),
      getClientByProfileId: vi.fn().mockResolvedValue(undefined),
    } as any;
    const service = new ClientWorkspaceService(storage);

    const result = await service.messages("user-1");

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.data).toEqual([]);
  });

  it("limits recent tasks response to five items", async () => {
    const tasks = Array.from({ length: 7 }, (_, i) => ({
      id: `task-${i}`,
      createdAt: new Date(Date.now() - i * 1000).toISOString(),
      status: "Pending",
    }));
    const storage = {
      getProfileByUserId: vi.fn().mockResolvedValue({ id: "profile-1" }),
      getClientByProfileId: vi.fn().mockResolvedValue({ id: "client-1" }),
      getProjectsByClientId: vi.fn().mockResolvedValue([{ id: "project-1", name: "P1" }]),
      getProjectWithTasks: vi.fn().mockResolvedValue({ tasks }),
    } as any;
    const service = new ClientWorkspaceService(storage);

    const result = await service.recentTasks("user-1");

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(Array.isArray(result.data)).toBe(true);
    expect((result.data as unknown[]).length).toBe(5);
  });
});
