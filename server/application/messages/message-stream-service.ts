import type { IStorage } from "../../storage";

type SupabaseUser = { id: string };

interface MessageStreamDeps {
  getUserByToken: (token: string) => Promise<SupabaseUser | null>;
}

const defaultDeps: MessageStreamDeps = {
  getUserByToken: async (token) => {
    const { supabaseAdmin } = await import("../../lib/supabase");
    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      return null;
    }

    return { id: user.id };
  },
};

export interface MessageStreamResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

export class MessageStreamService {
  constructor(private readonly storage: IStorage, private readonly deps: MessageStreamDeps = defaultDeps) {}

  async authenticateStream(token: string | undefined): Promise<MessageStreamResult<{ agencyId: string }>> {
    if (!token) {
      return { ok: false, status: 401, error: "Authentication token required" };
    }

    const user = await this.deps.getUserByToken(token);
    if (!user) {
      return { ok: false, status: 401, error: "Invalid or expired token" };
    }

    const profile = await this.storage.getProfileByUserId(user.id);
    if (!profile || profile.role !== "Admin") {
      return { ok: false, status: 403, error: "Admin access required" };
    }

    if (!profile.agencyId) {
      return { ok: false, status: 403, error: "Agency association required" };
    }

    return { ok: true, status: 200, data: { agencyId: profile.agencyId } };
  }
}
