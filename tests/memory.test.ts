import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  addMemory,
  updateMemory,
  pruneMemory,
  listMemories,
  recallMemories,
  renderIndex,
  normaliseMemory,
  memoryDir,
  MEMORY_INDEX
} from "../src/memory/index.js";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "claudepilot-mem-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("normaliseMemory", () => {
  it("derives a kebab name from the description and stamps timestamps", () => {
    const m = normaliseMemory({
      description: "We use Drizzle ORM on D1",
      type: "decision",
      body: "Chosen for the edge."
    });
    expect(m.name).toBe("we-use-drizzle-orm-on-d1");
    expect(m.created).toBeTruthy();
    expect(m.updated).toBeTruthy();
  });

  it("rejects an unknown type and empty fields", () => {
    expect(() =>
      // @ts-expect-error testing a bad type
      normaliseMemory({ description: "x", type: "bogus", body: "y" })
    ).toThrow(/unknown memory type/);
    expect(() =>
      normaliseMemory({ description: "", type: "fact", body: "y" })
    ).toThrow(/description/);
  });
});

describe("addMemory and listMemories", () => {
  it("writes one file per memory and a MEMORY.md index", async () => {
    await addMemory(root, {
      description: "Auth uses Supabase",
      type: "architecture",
      body: "Sessions live in Supabase auth.",
      tags: ["auth", "supabase"]
    });
    const memories = await listMemories(root);
    expect(memories).toHaveLength(1);
    expect(memories[0]?.name).toBe("auth-uses-supabase");

    const index = await readFile(join(memoryDir(root), MEMORY_INDEX), "utf8");
    expect(index).toContain("auth-uses-supabase");
    expect(index).toContain("architecture");
  });

  it("overwriting a memory preserves the original created timestamp", async () => {
    const first = await addMemory(root, {
      name: "stack",
      description: "Stack choice",
      type: "decision",
      body: "v1"
    });
    const second = await addMemory(root, {
      name: "stack",
      description: "Stack choice",
      type: "decision",
      body: "v2"
    });
    expect(second.created).toBe(first.created);
    const memories = await listMemories(root);
    expect(memories).toHaveLength(1);
    expect(memories[0]?.body).toBe("v2");
  });
});

describe("updateMemory and pruneMemory", () => {
  it("updates a body while keeping the name", async () => {
    await addMemory(root, {
      name: "deploy",
      description: "Deploy target",
      type: "decision",
      body: "Vercel"
    });
    const updated = await updateMemory(root, "deploy", { body: "Cloudflare Pages" });
    expect(updated.body).toBe("Cloudflare Pages");
  });

  it("prunes a memory and refreshes the index", async () => {
    await addMemory(root, {
      name: "temp",
      description: "Temporary",
      type: "todo",
      body: "Remove later"
    });
    expect(await pruneMemory(root, "temp")).toBe(true);
    expect(await pruneMemory(root, "temp")).toBe(false);
    expect(await listMemories(root)).toHaveLength(0);
  });
});

describe("recallMemories", () => {
  it("ranks memories by relevance to a query using frontmatter only", async () => {
    await addMemory(root, {
      description: "Payments use Stripe checkout",
      type: "decision",
      body: "Stripe hosted checkout.",
      tags: ["payments", "stripe"]
    });
    await addMemory(root, {
      description: "Emails go through Resend",
      type: "decision",
      body: "Resend for transactional mail.",
      tags: ["email", "resend"]
    });
    const hits = recallMemories(await listMemories(root), "stripe payments");
    expect(hits[0]?.name).toBe("payments-use-stripe-checkout");
  });

  it("returns nothing for an empty query", async () => {
    await addMemory(root, {
      description: "x",
      type: "fact",
      body: "y"
    });
    expect(recallMemories(await listMemories(root), "")).toHaveLength(0);
  });
});

describe("renderIndex", () => {
  it("groups memories by type", () => {
    const md = renderIndex([
      {
        name: "a",
        description: "first",
        type: "decision",
        tags: [],
        body: "x",
        sourcePath: "a.md"
      },
      {
        name: "b",
        description: "second",
        type: "gotcha",
        tags: ["edge"],
        body: "y",
        sourcePath: "b.md"
      }
    ]);
    expect(md).toContain("## decision");
    expect(md).toContain("## gotcha");
    expect(md).toContain("**a**: first");
    expect(md).toContain("tags: edge");
  });
});
