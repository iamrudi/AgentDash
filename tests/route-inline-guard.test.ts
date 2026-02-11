import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

const ROUTES_DIR = path.join(process.cwd(), "server", "routes");
const INLINE_ASYNC_ROUTE_PATTERN = /\b[A-Za-z_$][\w$]*\.(get|post|patch|put|delete)\([^\n]*async\s*\(/g;
const LEGACY_INLINE_ALLOWED = new Set([
  "server/routes/invoices.ts",
  "server/routes/knowledge-documents.ts",
  "server/routes/knowledge.ts",
  "server/routes/tasks.ts",
  "server/routes/workflows.ts",
]);

function listTsFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listTsFiles(fullPath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".ts")) {
      files.push(fullPath);
    }
  }

  return files;
}

describe("Route decomposition guard", () => {
  it("has no inline async route handlers under server/routes", () => {
    const offenders: string[] = [];
    const files = listTsFiles(ROUTES_DIR);

    for (const file of files) {
      const source = fs.readFileSync(file, "utf8");
      const matches = source.match(INLINE_ASYNC_ROUTE_PATTERN);
      if (matches && matches.length > 0) {
        const relative = path.relative(process.cwd(), file);
        if (!LEGACY_INLINE_ALLOWED.has(relative)) {
          offenders.push(`${relative} (${matches.length})`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
