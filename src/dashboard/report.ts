/**
 * Report: render a session as a shareable Markdown document, the said-to-did
 * story plus a summary, so a session can be handed to a teammate or kept as a
 * record without sharing the whole local store. Pure over the folded story; the
 * server serves the string as a download.
 */

import type { Story } from "./story.js";

export function sessionReport(story: Story, generatedAt: string): string {
  const shortId = (story.session || "session").slice(0, 8);
  const lines: string[] = [];
  lines.push(`# Session ${shortId} report`);
  lines.push("");
  lines.push(`Generated ${generatedAt}.`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(
    `- ${story.promptCount} prompt${story.promptCount === 1 ? "" : "s"}, ` +
      `${story.toolCount} tool call${story.toolCount === 1 ? "" : "s"} across ` +
      `${story.lanes.length} lane${story.lanes.length === 1 ? "" : "s"}.`
  );
  const files = new Set<string>();
  for (const lane of story.lanes) for (const f of lane.files) files.add(f);
  if (files.size > 0) lines.push(`- Files touched: ${[...files].join(", ")}.`);
  lines.push("");

  lines.push("## What happened");
  lines.push("");
  for (const lane of story.lanes) {
    const heading = lane.opening ? "Session opened" : lane.prompt;
    lines.push(`### ${heading}`);
    lines.push("");
    lines.push(`_${lane.summary}_`);
    if (lane.actions.length > 0) {
      lines.push("");
      for (const a of lane.actions) lines.push(`- ${a.label}`);
    }
    lines.push("");
  }

  return lines.join("\n").trim() + "\n";
}
