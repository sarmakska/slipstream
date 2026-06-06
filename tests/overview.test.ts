import { describe, expect, it } from "vitest";
import { summariseMap, narrateOverview } from "../src/dashboard/overview.js";
import type { ProjectMap, FileEntry } from "../src/map/types.js";

function file(path: string, symbols: number, lines: number, purpose = "source module"): FileEntry {
  return {
    path,
    purpose,
    symbols: Array.from({ length: symbols }, (_, i) => ({ name: `s${i}`, kind: "function" as const })),
    imports: [],
    bytes: lines * 30,
    lines
  };
}

function map(files: FileEntry[]): ProjectMap {
  const symbolCount = files.reduce((n, f) => n + f.symbols.length, 0);
  const totalBytes = files.reduce((n, f) => n + f.bytes, 0);
  return {
    version: 1,
    root: "/repo",
    generatedAt: "2026-06-06T12:00:00Z",
    entryPoints: ["src/cli/index.ts"],
    files,
    stats: { fileCount: files.length, symbolCount, totalBytes }
  };
}

describe("summariseMap", () => {
  it("groups src files into src/<area> and others by top segment", () => {
    const o = summariseMap(map([
      file("src/dashboard/server.ts", 3, 100),
      file("src/dashboard/ui.ts", 1, 200),
      file("src/memory/observe.ts", 5, 150),
      file("tests/x.test.ts", 0, 40, "test suite"),
      file("hooks/stop.mjs", 0, 30)
    ]));
    const names = o.areas.map((a) => a.area);
    expect(names).toContain("src/dashboard");
    expect(names).toContain("src/memory");
    expect(names).toContain("tests");
    expect(names).toContain("hooks");
  });

  it("sums files, symbols and lines per area", () => {
    const o = summariseMap(map([
      file("src/dashboard/server.ts", 3, 100),
      file("src/dashboard/ui.ts", 1, 200)
    ]));
    const dash = o.areas.find((a) => a.area === "src/dashboard");
    expect(dash).toBeDefined();
    expect(dash!.files).toBe(2);
    expect(dash!.symbols).toBe(4);
    expect(dash!.lines).toBe(300);
  });

  it("orders areas by symbol count, largest first", () => {
    const o = summariseMap(map([
      file("src/small/a.ts", 1, 10),
      file("src/big/a.ts", 9, 10)
    ]));
    expect(o.areas[0].area).toBe("src/big");
  });

  it("uses a known role for a recognised area", () => {
    const o = summariseMap(map([file("src/memory/observe.ts", 2, 50)]));
    expect(o.areas[0].role).toContain("observation memory");
  });

  it("falls back to the dominant purpose for an unknown area", () => {
    const o = summariseMap(map([
      file("src/widgets/a.ts", 1, 10, "renders a widget"),
      file("src/widgets/b.ts", 1, 10, "renders a widget")
    ]));
    expect(o.areas[0].role).toBe("renders a widget.");
  });

  it("narrates structure and activity in one meaningful paragraph", () => {
    const o = summariseMap(map([file("src/dashboard/server.ts", 3, 100), file("src/memory/observe.ts", 5, 50)]));
    const withData = narrateOverview(o, { sessions: 3, observations: 8, memories: 2 });
    expect(withData).toContain("2 files");
    expect(withData).toContain("8 observations across 3 sessions");
    expect(withData).toContain("2 durable memories");
  });

  it("narrates a useful empty state when nothing has been observed", () => {
    const o = summariseMap(map([file("src/a.ts", 1, 10)]));
    const cold = narrateOverview(o, { sessions: 0, observations: 0, memories: 0 });
    expect(cold).toContain("No sessions recorded yet");
    expect(cold).toContain("1 file");
  });

  it("reports top-level stats and entry points", () => {
    const o = summariseMap(map([file("src/cli/index.ts", 1, 30)]));
    expect(o.fileCount).toBe(1);
    expect(o.symbolCount).toBe(1);
    expect(o.entryPoints).toEqual(["src/cli/index.ts"]);
    expect(typeof o.kib).toBe("number");
  });
});
