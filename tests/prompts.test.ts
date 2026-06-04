import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { handleRequest, type JsonRpcRequest } from "../src/mcp/server.js";
import {
  parseSkillFrontmatter,
  listSkillPrompts,
  getSkillPrompt
} from "../src/mcp/prompts.js";

const here = dirname(fileURLToPath(import.meta.url));
const realSkills = resolve(here, "..", "skills", "context");

describe("parseSkillFrontmatter", () => {
  it("extracts name and description from a YAML head", () => {
    const raw = [
      "---",
      "name: think-before-coding",
      "description: Use before writing code.",
      "---",
      "",
      "the body"
    ].join("\n");
    const { name, description, body } = parseSkillFrontmatter(raw, "fallback");
    expect(name).toBe("think-before-coding");
    expect(description).toBe("Use before writing code.");
    expect(body).toBe("the body");
  });

  it("falls back to the directory stem when there is no frontmatter", () => {
    const { name, description, body } = parseSkillFrontmatter("no fences here", "stem");
    expect(name).toBe("stem");
    expect(description).toBe("");
    expect(body).toContain("no fences");
  });

  it("strips quoted values", () => {
    const raw = [
      "---",
      "name: 'quoted-name'",
      'description: "quoted desc"',
      "---",
      "body"
    ].join("\n");
    const { name, description } = parseSkillFrontmatter(raw, "fb");
    expect(name).toBe("quoted-name");
    expect(description).toBe("quoted desc");
  });
});

describe("listSkillPrompts on the real skills tree", () => {
  it("returns the discipline skills with name + description", async () => {
    const prompts = await listSkillPrompts(realSkills);
    const names = prompts.map((p) => p.name);
    expect(names).toContain("think-before-coding");
    expect(names).toContain("write-plan");
    expect(names).toContain("systematic-debugging");
    expect(names).toContain("scoped-read");
    expect(names).toContain("context-budget");
    expect(names).toContain("compact-and-offload");
    for (const p of prompts) {
      expect(p.description.length).toBeGreaterThan(0);
    }
  });
});

describe("getSkillPrompt", () => {
  it("returns the body content for a known skill", async () => {
    const detail = await getSkillPrompt("think-before-coding", realSkills);
    expect(detail).not.toBeNull();
    expect(detail!.content.length).toBeGreaterThan(0);
  });

  it("returns null for an unknown skill", async () => {
    const detail = await getSkillPrompt("not-a-real-skill", realSkills);
    expect(detail).toBeNull();
  });
});

describe("listSkillPrompts on an empty tmp dir", () => {
  let tmp: string;
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "slipstream-prompts-"));
  });
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("returns an empty list when nothing is on disk", async () => {
    const prompts = await listSkillPrompts(tmp);
    expect(prompts).toEqual([]);
  });

  it("picks up a single hand-rolled SKILL.md", async () => {
    mkdirSync(join(tmp, "my-skill"), { recursive: true });
    await writeFile(
      join(tmp, "my-skill", "SKILL.md"),
      ["---", "name: my-skill", "description: a tiny test", "---", "hello"].join("\n"),
      "utf8"
    );
    const prompts = await listSkillPrompts(tmp);
    expect(prompts.length).toBe(1);
    expect(prompts[0]!.name).toBe("my-skill");
  });
});

describe("MCP prompts/list and prompts/get over the request handler", () => {
  const ctx = { defaultRoot: process.cwd() };

  it("prompts/list returns a list with name and description for each skill", async () => {
    const res = await handleRequest(
      { jsonrpc: "2.0", id: 1, method: "prompts/list" } as JsonRpcRequest,
      ctx
    );
    const prompts = (res?.result as { prompts: Array<{ name: string }> }).prompts;
    expect(prompts.some((p) => p.name === "think-before-coding")).toBe(true);
  });

  it("prompts/get returns the body of a known skill in MCP message shape", async () => {
    const res = await handleRequest(
      {
        jsonrpc: "2.0",
        id: 2,
        method: "prompts/get",
        params: { name: "think-before-coding" }
      } as JsonRpcRequest,
      ctx
    );
    const result = res?.result as {
      messages: Array<{ role: string; content: { type: string; text: string } }>;
    };
    expect(result.messages[0]!.role).toBe("user");
    expect(result.messages[0]!.content.type).toBe("text");
    expect(result.messages[0]!.content.text.length).toBeGreaterThan(0);
  });

  it("prompts/get with an unknown name returns an INVALID_PARAMS error", async () => {
    const res = await handleRequest(
      {
        jsonrpc: "2.0",
        id: 3,
        method: "prompts/get",
        params: { name: "no-such-skill" }
      } as JsonRpcRequest,
      ctx
    );
    expect(res?.error).toBeDefined();
    expect(res?.error?.code).toBe(-32602);
  });

  it("initialize advertises a prompts capability", async () => {
    const res = await handleRequest(
      { jsonrpc: "2.0", id: 4, method: "initialize" } as JsonRpcRequest,
      ctx
    );
    const caps = (res?.result as { capabilities: { prompts?: unknown } }).capabilities;
    expect(caps.prompts).toBeDefined();
  });
});
