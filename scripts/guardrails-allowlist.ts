export const ALLOWLIST_ALLOWED_PREFIXES = ["docs/", "tests/", "scripts/"] as const;

export type AllowlistValidationResult = {
  ok: boolean;
  errors: string[];
};

export function validateAllowlistEntries(entries: string[]): AllowlistValidationResult {
  const errors: string[] = [];

  for (const rawEntry of entries) {
    const entry = rawEntry.trim();
    if (!entry || entry.startsWith("#")) {
      continue;
    }

    if (entry.startsWith("server/")) {
      errors.push(`server/** not allowed in allowlist: ${entry}`);
      continue;
    }

    const hasAllowedPrefix = ALLOWLIST_ALLOWED_PREFIXES.some((prefix) =>
      entry.startsWith(prefix)
    );
    if (!hasAllowedPrefix) {
      errors.push(`allowlist entry must be under docs/, tests/, or scripts/: ${entry}`);
    }
  }

  return { ok: errors.length === 0, errors };
}
