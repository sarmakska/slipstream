import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DOCTOR_FIXES, runDoctor, renderDoctor } from "../src/doctor/index.js";

describe("doctor one-line fixes", () => {
  it("exposes a remedy string for every documented check id", () => {
    const expected = [
      "claude-dir",
      "mcp-declared",
      "memory-dir",
      "dashboard-port",
      "dashboard-socket"
    ];
    for (const id of expected) {
      expect(DOCTOR_FIXES[id]).toBeTruthy();
      expect(DOCTOR_FIXES[id]!.length).toBeLessThan(120);
    }
    expect(Object.keys(DOCTOR_FIXES).length).toBeGreaterThanOrEqual(5);
  });

  let broken: string;
  beforeEach(async () => {
    broken = await mkdtemp(join(tmpdir(), "slipstream-doctor-fix-"));
    await mkdir(join(broken, ".claude-plugin"), { recursive: true });
    await writeFile(
      join(broken, ".claude-plugin", "plugin.json"),
      JSON.stringify({ name: "slipstream", version: "0.0.0" }),
      "utf8"
    );
    await mkdir(join(broken, "hooks"), { recursive: true });
    await writeFile(
      join(broken, "hooks", "hooks.json"),
      JSON.stringify({ hooks: {} }),
      "utf8"
    );
  });
  afterEach(async () => {
    await rm(broken, { recursive: true, force: true });
  });

  it("attaches the remedy to the failed check and prints it in the report", async () => {
    const report = await runDoctor(broken, broken);
    const failed = report.checks.find((c) => c.id === "mcp-declared");
    expect(failed?.pass).toBe(false);
    expect(failed?.fix).toBe(DOCTOR_FIXES["mcp-declared"]);
    const rendered = renderDoctor(report);
    expect(rendered).toContain("fix: ");
    expect(rendered).toContain(DOCTOR_FIXES["mcp-declared"]!);
  });
});
