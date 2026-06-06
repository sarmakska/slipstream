import { describe, expect, it } from "vitest";
import { sessionReport } from "../src/dashboard/report.js";
import type { Story } from "../src/dashboard/story.js";

function story(): Story {
  return {
    session: "4f2a1234abcd",
    promptCount: 2,
    toolCount: 3,
    lanes: [
      {
        index: 0, ts: "2026-06-06T12:00:00Z", prompt: "add a flow tab", opening: false,
        actions: [
          { seq: 1, ts: "t", agent: "main", kind: "post-tool", tool: "Edit", label: "Edit src/ui.ts", file: "src/ui.ts" }
        ],
        files: ["src/ui.ts"], toolCount: 1, delegated: false, summary: "1 tool call, edited ui.ts."
      },
      {
        index: 1, ts: "2026-06-06T12:10:00Z", prompt: "release it", opening: false,
        actions: [], files: [], toolCount: 0, delegated: false, summary: "No tool calls yet."
      }
    ]
  };
}

describe("sessionReport", () => {
  it("renders a Markdown report with a title, summary and the lanes", () => {
    const md = sessionReport(story(), "2026-06-06T13:00:00Z");
    expect(md).toContain("# Session 4f2a1234 report");
    expect(md).toContain("Generated 2026-06-06T13:00:00Z.");
    expect(md).toContain("2 prompts, 3 tool calls");
    expect(md).toContain("Files touched: src/ui.ts.");
    expect(md).toContain("### add a flow tab");
    expect(md).toContain("- Edit src/ui.ts");
    expect(md).toContain("### release it");
  });

  it("handles an empty story", () => {
    const md = sessionReport({ session: "s", promptCount: 0, toolCount: 0, lanes: [] }, "t");
    expect(md).toContain("# Session s report");
    expect(md).toContain("0 prompts, 0 tool calls");
  });
});
