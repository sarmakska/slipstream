import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  REDACT_CONFIG_REL,
  loadCustomRules,
  loadRedactor,
  makeRedactor
} from "../src/dashboard/redact-config.js";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "slipstream-redact-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("configurable redaction", () => {
  it("merges custom patterns with the built-in redactor", async () => {
    await mkdir(join(root, ".claude", "slipstream"), { recursive: true });
    await writeFile(
      join(root, REDACT_CONFIG_REL),
      JSON.stringify({
        patterns: [{ pattern: "ACME-[A-Z0-9]{6}", label: "Acme token" }]
      }),
      "utf8"
    );
    const redact = await loadRedactor(root);
    const out = redact("token ACME-ABC123 and AKIAABCDEFGHIJKLMNOP key");
    expect(out).toContain("[redacted]");
    expect(out).not.toContain("ACME-ABC123");
    expect(out).not.toContain("AKIAABCDEFGHIJKLMNOP");
  });

  it("returns no custom rules when the file is malformed", async () => {
    await mkdir(join(root, ".claude", "slipstream"), { recursive: true });
    await writeFile(join(root, REDACT_CONFIG_REL), "not json {{{", "utf8");
    expect(await loadCustomRules(root)).toEqual([]);
  });

  it("applies custom patterns to inputs the built-in redactor leaves alone", () => {
    const redact = makeRedactor([/internal-[a-z]+@example\.com/g]);
    expect(redact("ping internal-bob@example.com please")).toBe(
      "ping [redacted] please"
    );
  });
});
