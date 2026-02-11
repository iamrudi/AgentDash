import type { IStorage } from "../../storage";

interface AuthDeps {
  provisionUser: (input: {
    email: string;
    password: string;
    fullName?: string;
    role: "Client";
    agencyId: string;
    clientData?: { companyName: string };
  }) => Promise<void>;
  signInWithPassword: (
    email: string,
    password: string
  ) => Promise<{ data: { session: any; user: any } }>;
  refreshAccessToken: (refreshToken: string) => Promise<{ data: { session: any; user: any } }>;
}

const defaultDeps: AuthDeps = {
  provisionUser: async (input) => {
    const { provisionUser } = await import("../../lib/user-provisioning");
    await provisionUser(input as any);
  },
  signInWithPassword: async (email, password) => {
    const { signInWithPassword } = await import("../../lib/supabase-auth");
    return signInWithPassword(email, password) as any;
  },
  refreshAccessToken: async (refreshToken) => {
    const { refreshAccessToken } = await import("../../lib/supabase-auth");
    return refreshAccessToken(refreshToken) as any;
  },
};

export interface AuthResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

export class AuthService {
  constructor(private readonly storage: IStorage, private readonly deps: AuthDeps = defaultDeps) {}

  async signup(payload: {
    email: string;
    password: string;
    fullName?: string;
    companyName?: string;
  }): Promise<AuthResult<{ message: string }>> {
    const defaultAgency = await this.storage.getDefaultAgency();
    if (!defaultAgency) {
      return { ok: false, status: 500, error: "System configuration error: No default agency found" };
    }

    await this.deps.provisionUser({
      email: payload.email,
      password: payload.password,
      fullName: payload.fullName,
      role: "Client",
      agencyId: defaultAgency.id,
      clientData: payload.companyName ? { companyName: payload.companyName } : undefined,
    });

    return { ok: true, status: 201, data: { message: "Account created successfully" } };
  }

  async login(payload: { email: string; password: string }): Promise<AuthResult<unknown>> {
    const authResult = await this.deps.signInWithPassword(payload.email, payload.password);
    if (!authResult.data.session) {
      return { ok: false, status: 401, error: "Invalid credentials" };
    }

    return this.buildAuthResponse(authResult, payload.email);
  }

  async refresh(payload: { refreshToken?: string }): Promise<AuthResult<unknown>> {
    if (!payload.refreshToken) {
      return { ok: false, status: 400, error: "Refresh token required" };
    }

    const authResult = await this.deps.refreshAccessToken(payload.refreshToken);
    if (!authResult.data.session) {
      return { ok: false, status: 401, error: "Invalid refresh token" };
    }

    return this.buildAuthResponse(authResult);
  }

  private async buildAuthResponse(
    authResult: { data: { session: any; user: any } },
    fallbackEmail?: string
  ): Promise<AuthResult<unknown>> {
    const profile = await this.storage.getProfileByUserId(authResult.data.user!.id);
    if (!profile) {
      return { ok: false, status: 404, error: "Profile not found" };
    }

    let agencyId: string | undefined;
    let clientId: string | undefined;

    if (profile.role === "Client") {
      const client = await this.storage.getClientByProfileId(profile.id);
      clientId = client?.id;
      agencyId = client?.agencyId;
    } else if (profile.role === "Admin" || profile.role === "Staff") {
      agencyId = profile.agencyId || undefined;
    }

    return {
      ok: true,
      status: 200,
      data: {
        token: authResult.data.session!.access_token,
        refreshToken: authResult.data.session!.refresh_token,
        expiresAt: authResult.data.session!.expires_at,
        user: {
          id: authResult.data.user!.id,
          email: authResult.data.user!.email || fallbackEmail,
          profile,
          clientId,
          agencyId,
        },
      },
    };
  }
}
