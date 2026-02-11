import { describe, expect, it, vi } from "vitest";
import { AgencyClientService } from "../server/application/agency/agency-client-service";

describe("AgencyClientService", () => {
  it("returns 404 when client is missing", async () => {
    const storage = {
      getClientById: vi.fn().mockResolvedValue(undefined),
    } as any;
    const service = new AgencyClientService(storage);

    const result = await service.getClient("client-1");

    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
    expect(result.error).toBe("Client not found");
  });

  it("lists clients by agency", async () => {
    const storage = {
      getAllClientsWithDetails: vi.fn().mockResolvedValue([{ id: "client-1" }]),
    } as any;
    const service = new AgencyClientService(storage);

    const result = await service.listClients("agency-1");

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(storage.getAllClientsWithDetails).toHaveBeenCalledWith("agency-1");
  });
});
