import { describe, expect, it } from "vitest";
import { ROLE_IDS, ROLES, isRoleId } from "@/config/roles";
import { TOOLS, getTool, groupTools, toolsForRole } from "@/tools/registry";

describe("tool registry", () => {
  it("has unique, URL-safe ids", () => {
    const ids = TOOLS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
  });

  it("only references known roles", () => {
    for (const tool of TOOLS) for (const r of tool.roles) expect(isRoleId(r)).toBe(true);
  });

  it("gives every role at least three dedicated tools plus shared tools", () => {
    const shared = TOOLS.filter((t) => t.roles.length === 0);
    expect(shared.map((t) => t.id)).toEqual(expect.arrayContaining(["tvm", "spreadsheet", "scenarios"]));
    for (const role of ROLE_IDS) {
      const tools = toolsForRole(role);
      expect(tools.length - shared.length).toBeGreaterThanOrEqual(3);
      // Shared tools come last.
      expect(tools.slice(-shared.length)).toEqual(shared);
    }
  });

  it("looks up tools and groups them in order", () => {
    expect(getTool("dcf")?.name).toBe("DCF Model");
    expect(getTool("nope")).toBeUndefined();
    const groups = groupTools(toolsForRole("analyst"));
    expect(groups[0]?.group).toBe("Valuation");
    expect(groups.flatMap((g) => g.tools)).toHaveLength(toolsForRole("analyst").length);
  });
});

describe("roles", () => {
  it("assigns unique single-digit shortcuts 1–5", () => {
    const shortcuts = ROLE_IDS.map((r) => ROLES[r].shortcut);
    expect(shortcuts).toEqual(["1", "2", "3", "4", "5"]);
  });

  it("validates role ids", () => {
    expect(isRoleId("analyst")).toBe(true);
    expect(isRoleId("trader")).toBe(false);
    expect(isRoleId(undefined)).toBe(false);
  });
});
