import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

describe("Control-plane role guard coverage", () => {
  it("keeps workflows routes behind Admin/SuperAdmin gate", () => {
    const file = path.join(process.cwd(), "server", "routes", "workflows.ts");
    const source = fs.readFileSync(file, "utf8");
    expect(source).toMatch(/workflowsRouter\.use\(requireAuth,\s*requireRole\("Admin",\s*"SuperAdmin"\)\)/);
  });

  it("keeps rule-engine routes behind Admin/SuperAdmin gate", () => {
    const file = path.join(process.cwd(), "server", "routes", "rule-engine.ts");
    const source = fs.readFileSync(file, "utf8");
    expect(source).toMatch(/router\.use\(requireAuth,\s*requireRole\("Admin",\s*"SuperAdmin"\)\)/);
  });

  it("keeps signals routes behind Admin/SuperAdmin gate", () => {
    const file = path.join(process.cwd(), "server", "routes", "signals.ts");
    const source = fs.readFileSync(file, "utf8");
    expect(source).toMatch(/router\.use\(requireAuth,\s*requireRole\("Admin",\s*"SuperAdmin"\)\)/);
  });

  it("keeps test create-user route authenticated and superadmin-only", () => {
    const file = path.join(process.cwd(), "server", "routes", "test.ts");
    const source = fs.readFileSync(file, "utf8");
    expect(source).toMatch(/router\.post\("\/create-user",\s*requireAuth,\s*requireRole\("SuperAdmin"\),\s*createTestCreateUserHandler\(\)\)/);
  });
});
