import type { IStorage } from "../../storage";

interface ProvisionResult {
  profileId: string;
}

interface TestUserDeps {
  provisionUser: (input: {
    email: string;
    password: string;
    fullName?: string;
    role: string;
    agencyId: string | null;
    clientData?: { companyName: string };
  }) => Promise<ProvisionResult>;
}

const defaultDeps: TestUserDeps = {
  provisionUser: async (input) => {
    const { provisionUser } = await import("../../lib/user-provisioning");
    return provisionUser(input as any) as Promise<ProvisionResult>;
  },
};

export interface TestUserResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

export class TestUserService {
  constructor(private readonly storage: IStorage, private readonly deps: TestUserDeps = defaultDeps) {}

  async createUser(input: {
    env?: string;
    email?: string;
    password?: string;
    fullName?: string;
    role?: string;
    companyName?: string;
    requestedAgencyId?: string;
  }): Promise<TestUserResult<unknown>> {
    if (input.env !== "development") {
      return { ok: false, status: 404, error: "Not found" };
    }

    const role = input.role || "Client";
    let agencyId: string | undefined = input.requestedAgencyId;

    if (!agencyId && (role === "Client" || !input.role)) {
      const defaultAgency = await this.storage.getDefaultAgency();
      if (!defaultAgency) {
        return { ok: false, status: 500, error: "System configuration error: No default agency found" };
      }
      agencyId = defaultAgency.id;
    }

    const result = await this.deps.provisionUser({
      email: input.email || "",
      password: input.password || "",
      fullName: input.fullName,
      role,
      agencyId: agencyId || null,
      clientData: input.companyName ? { companyName: input.companyName } : undefined,
    });

    return {
      ok: true,
      status: 201,
      data: {
        message: "Test user created successfully",
        user: { id: result.profileId, email: input.email },
        profile: {
          id: result.profileId,
          fullName: input.fullName,
          role,
          agencyId,
        },
      },
    };
  }
}
