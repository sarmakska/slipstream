import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  detectMode,
  shouldEmit,
  shouldStartDashboard
} from "../src/mcp/mode-detect.js";

describe("detectMode", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "slipstream-mode-"));
  });
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("returns mcp-only when no Claude Code signals are present", () => {
    const result = detectMode({ env: {}, cwd: tmp });
    expect(result.mode).toBe("mcp-only");
    expect(result.explicit).toBe(false);
  });

  it("returns plugin when CLAUDE_PLUGIN_ROOT is set", () => {
    const result = detectMode({
      env: { CLAUDE_PLUGIN_ROOT: "/some/path" },
      cwd: tmp
    });
    expect(result.mode).toBe("plugin");
    expect(result.reason).toBe("CLAUDE_PLUGIN_ROOT");
  });

  it("returns plugin when CLAUDE_CODE_SESSION is set", () => {
    const result = detectMode({
      env: { CLAUDE_CODE_SESSION: "abc" },
      cwd: tmp
    });
    expect(result.mode).toBe("plugin");
    expect(result.reason).toBe("CLAUDE_CODE_SESSION");
  });

  it("returns plugin when .claude/hooks exists in cwd", () => {
    mkdirSync(join(tmp, ".claude", "hooks"), { recursive: true });
    const result = detectMode({ env: {}, cwd: tmp });
    expect(result.mode).toBe("plugin");
    expect(result.reason).toBe(".claude/hooks marker");
  });

  it("SLIPSTREAM_MODE override beats every other signal", () => {
    mkdirSync(join(tmp, ".claude", "hooks"), { recursive: true });
    const result = detectMode({
      env: { SLIPSTREAM_MODE: "mcp-only", CLAUDE_PLUGIN_ROOT: "/x" },
      cwd: tmp
    });
    expect(result.mode).toBe("mcp-only");
    expect(result.explicit).toBe(true);
  });

  it("ignores nonsense SLIPSTREAM_MODE values and falls through to detection", () => {
    const result = detectMode({
      env: { SLIPSTREAM_MODE: "garbage" },
      cwd: tmp
    });
    expect(result.mode).toBe("mcp-only");
    expect(result.explicit).toBe(false);
  });
});

describe("shouldEmit", () => {
  it("emits in mcp-only mode by default", () => {
    expect(shouldEmit({}, "mcp-only")).toBe(true);
  });

  it("stays quiet in plugin mode by default", () => {
    expect(shouldEmit({}, "plugin")).toBe(false);
  });

  it("respects SLIPSTREAM_MCP_EMIT=0 override in mcp-only mode", () => {
    expect(shouldEmit({ SLIPSTREAM_MCP_EMIT: "0" }, "mcp-only")).toBe(false);
  });

  it("respects SLIPSTREAM_MCP_EMIT=1 override in plugin mode", () => {
    expect(shouldEmit({ SLIPSTREAM_MCP_EMIT: "1" }, "plugin")).toBe(true);
  });
});

describe("shouldStartDashboard", () => {
  it("starts the dashboard in mcp-only mode by default", () => {
    expect(shouldStartDashboard({}, "mcp-only")).toBe(true);
  });

  it("stays quiet in plugin mode by default", () => {
    expect(shouldStartDashboard({}, "plugin")).toBe(false);
  });

  it("respects SLIPSTREAM_DASHBOARD=0 override", () => {
    expect(shouldStartDashboard({ SLIPSTREAM_DASHBOARD: "0" }, "mcp-only")).toBe(false);
  });

  it("respects SLIPSTREAM_DASHBOARD=1 override", () => {
    expect(shouldStartDashboard({ SLIPSTREAM_DASHBOARD: "1" }, "plugin")).toBe(true);
  });
});
