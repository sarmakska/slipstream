import { describe, expect, it } from "vitest";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdtemp, mkdir, writeFile, rm, cp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { validatePlugin } from "../src/plugin-validate/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..");

describe("validatePlugin", () => {
  it("passes on the real claudepilot plugin", async () => {
    const result = await validatePlugin(repoRoot, join(repoRoot, "skills"));
    if (!result.ok) {
      throw new Error("plugin invalid:\n" + result.issues.join("\n"));
    }
    expect(result.ok).toBe(true);
    expect(result.checks.length).toBeGreaterThanOrEqual(5);
  });

  it("fails when the manifest is missing", async () => {
    const dir = await mkdtemp(join(tmpdir(), "claudepilot-plugin-"));
    try {
      const result = await validatePlugin(dir, join(repoRoot, "skills"));
      expect(result.ok).toBe(false);
      expect(result.issues.some((i) => i.includes("manifest"))).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("fails when a hook event is not wired", async () => {
    const dir = await mkdtemp(join(tmpdir(), "claudepilot-plugin-"));
    try {
      await mkdir(join(dir, ".claude-plugin"), { recursive: true });
      await mkdir(join(dir, "hooks"), { recursive: true });
      await mkdir(join(dir, "commands"), { recursive: true });
      await writeFile(
        join(dir, ".claude-plugin", "plugin.json"),
        JSON.stringify({
          name: "claudepilot",
          version: "0.1.0",
          description: "x",
          author: "Sarma"
        })
      );
      await writeFile(
        join(dir, ".claude-plugin", "marketplace.json"),
        JSON.stringify({ name: "m", plugins: [{ name: "claudepilot", source: "." }] })
      );
      // Only wires SessionStart, missing the other three.
      await writeFile(
        join(dir, "hooks", "hooks.json"),
        JSON.stringify({ hooks: { SessionStart: [] } })
      );
      await writeFile(
        join(dir, "commands", "map.md"),
        "---\ndescription: a command\n---\nbody"
      );
      await cp(join(repoRoot, "skills"), join(dir, "skills"), { recursive: true });

      const result = await validatePlugin(dir, join(dir, "skills"));
      expect(result.ok).toBe(false);
      expect(result.issues.some((i) => i.includes("PreToolUse"))).toBe(true);
      expect(result.issues.some((i) => i.includes("Stop"))).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
