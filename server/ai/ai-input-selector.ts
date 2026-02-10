export type FieldDefinition = {
  field_key: string;
  ai_exposed: boolean;
};

function setNestedValue(
  target: Record<string, unknown>,
  path: string[],
  value: unknown
): void {
  let current: Record<string, unknown> = target;
  for (let i = 0; i < path.length; i += 1) {
    const key = path[i];
    const isLast = i === path.length - 1;
    if (isLast) {
      current[key] = value;
      return;
    }
    const next = current[key];
    if (!next || typeof next !== "object" || Array.isArray(next)) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
}

function getNestedValue(
  source: Record<string, unknown>,
  path: string[]
): unknown {
  let current: unknown = source;
  for (const key of path) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

export function selectAIExposedFields(
  clientRecord: Record<string, unknown>,
  fieldCatalog: FieldDefinition[]
): Record<string, unknown> {
  const allowed = fieldCatalog.filter((field) => field.ai_exposed);
  const result: Record<string, unknown> = {};

  for (const field of allowed) {
    const path = field.field_key.split(".").filter(Boolean);
    if (path.length === 0) continue;
    const value = getNestedValue(clientRecord, path);
    if (value !== undefined) {
      setNestedValue(result, path, value);
    }
  }

  return result;
}
