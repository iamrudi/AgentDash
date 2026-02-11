import { describe, expect, it, vi } from "vitest";

const {
  dbMock,
  eqMock,
  encryptMock,
  getLinkedInStatusMock,
  fetchLinkedInDataMock,
} = vi.hoisted(() => ({
  dbMock: {
    select: vi.fn(),
    update: vi.fn(),
    insert: vi.fn(),
  },
  eqMock: vi.fn(),
  encryptMock: vi.fn(),
  getLinkedInStatusMock: vi.fn(),
  fetchLinkedInDataMock: vi.fn(),
}));

vi.mock("../server/db", () => ({
  db: dbMock,
}));

vi.mock("drizzle-orm", () => ({
  eq: eqMock,
}));

vi.mock("@shared/schema", () => ({
  agencySettings: { agencyId: "agency_id" },
}));

vi.mock("../server/lib/encryption", () => ({
  encrypt: encryptMock,
}));

vi.mock("../server/lib/linkedin", () => ({
  getLinkedInStatus: getLinkedInStatusMock,
  fetchLinkedInData: fetchLinkedInDataMock,
}));

import { LinkedinAgencyService } from "../server/application/integrations/linkedin-agency-service";

describe("LinkedinAgencyService", () => {
  it("returns 400 for missing agency on status", async () => {
    const service = new LinkedinAgencyService();
    const result = await service.getStatus(undefined);
    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
  });

  it("returns 400 for missing connect payload", async () => {
    const service = new LinkedinAgencyService();
    const result = await service.connect("agency-1", "", "");
    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
  });

  it("connects and updates existing agency settings", async () => {
    encryptMock.mockReturnValue({ encrypted: "enc", iv: "iv", authTag: "tag" });
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ id: "existing" }]),
    };
    const updateChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(undefined),
    };
    dbMock.select.mockReturnValue(selectChain);
    dbMock.update.mockReturnValue(updateChain);

    const service = new LinkedinAgencyService();
    const result = await service.connect("agency-1", "token", "org-1");

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(dbMock.update).toHaveBeenCalledTimes(1);
  });

  it("disconnects successfully", async () => {
    const updateChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(undefined),
    };
    dbMock.update.mockReturnValue(updateChain);
    const service = new LinkedinAgencyService();

    const result = await service.disconnect("agency-1");
    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
  });

  it("fetches data successfully", async () => {
    fetchLinkedInDataMock.mockResolvedValue({ posts: [] });
    const service = new LinkedinAgencyService();

    const result = await service.fetchData("agency-1");
    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
  });
});
