import { describe, expect, it } from "vitest";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  extractSymbols,
  generateMap,
  mapToJson,
  mapToMarkdown,
  retrieveSymbol,
  retrieveLines,
  searchMap
} from "../src/map/index.js";
import { buildMindMap, mindMapToMermaid } from "../src/dashboard/model.js";

const here = dirname(fileURLToPath(import.meta.url));
const sample = join(here, "..", "fixtures", "sample-project");

describe("extractSymbols", () => {
  it("extracts functions, types, interfaces, consts and imports", () => {
    const { symbols, imports } = extractSymbols(
      `import { x } from "./x.js";
export function foo() {}
export interface Bar {}
export type Baz = string;
export const QUX = 1;
export default foo;`
    );
    const names = symbols.map((s) => `${s.name}:${s.kind}`);
    expect(names).toContain("foo:function");
    expect(names).toContain("Bar:interface");
    expect(names).toContain("Baz:type");
    expect(names).toContain("QUX:const");
    expect(names).toContain("default:default");
    expect(imports).toContain("./x.js");
  });

  it("classifies an exported uppercase arrow returning JSX as a component", () => {
    const { symbols } = extractSymbols(
      `export const Button = () => (<button>ok</button>);`
    );
    expect(symbols[0]?.kind).toBe("component");
  });
});

describe("generateMap", () => {
  it("indexes the fixture project with correct files and symbols", async () => {
    const map = await generateMap(sample);
    const paths = map.files.map((f) => f.path).sort();
    expect(paths).toEqual(["src/cli.ts", "src/greet.ts", "src/index.ts"]);

    const greet = map.files.find((f) => f.path === "src/greet.ts");
    expect(greet?.symbols.map((s) => s.name)).toEqual([
      "Greeting",
      "Salutation",
      "greet",
      "DEFAULT_GREETING"
    ]);

    expect(map.stats.fileCount).toBe(3);
    expect(map.stats.symbolCount).toBeGreaterThanOrEqual(7);
    expect(map.entryPoints).toContain("src/index.ts");
    expect(map.entryPoints).toContain("src/cli.ts");
  });

  it("never embeds file contents, keeping output compact", async () => {
    const map = await generateMap(sample);
    const json = mapToJson(map);
    expect(json).not.toContain("hello there");
    expect(json).not.toContain("console.log");
  });

  it("infers a purpose from the leading comment", async () => {
    const map = await generateMap(sample);
    const index = map.files.find((f) => f.path === "src/index.ts");
    expect(index?.purpose).toContain("Entry point");
  });

  it("renders markdown grouped by directory", async () => {
    const map = await generateMap(sample);
    const md = mapToMarkdown(map);
    expect(md).toContain("# Project map");
    expect(md).toContain("### src");
    expect(md).toContain("greet (function)");
  });
});

describe("scoped retrieval", () => {
  it("returns just the requested symbol slice, not the whole file", async () => {
    const map = await generateMap(sample);
    const slice = await retrieveSymbol(map, "src/greet.ts", "greet");
    expect(slice).not.toBeNull();
    expect(slice?.code).toContain("export function greet");
    expect(slice?.code).toContain("return `hello ${trimmed}`");
    // It must not include a later, unrelated declaration.
    expect(slice?.code).not.toContain("DEFAULT_GREETING");
    expect(slice?.startLine).toBeGreaterThan(0);
    expect(slice?.endLine).toBeGreaterThanOrEqual(slice?.startLine ?? 0);
  });

  it("captures the leading doc comment of a symbol", async () => {
    const map = await generateMap(sample);
    const slice = await retrieveSymbol(map, "src/greet.ts", "greet");
    expect(slice?.code).toContain("scoped retrieval brace walker");
  });

  it("returns null for an unknown symbol", async () => {
    const map = await generateMap(sample);
    const slice = await retrieveSymbol(map, "src/greet.ts", "nope");
    expect(slice).toBeNull();
  });

  it("ranks files by relevance to a query", async () => {
    const map = await generateMap(sample);
    const hits = searchMap(map, "greet greeting");
    expect(hits[0]?.path).toBe("src/greet.ts");
  });

  it("returns a bounded line range slice", async () => {
    const slice = await retrieveLines(sample, "src/greet.ts", 1, 3);
    expect(slice).not.toBeNull();
    expect(slice?.startLine).toBe(1);
    expect(slice?.endLine).toBe(3);
    expect(slice?.code.split("\n")).toHaveLength(3);
  });

  it("clamps an out of range line request to the file", async () => {
    const slice = await retrieveLines(sample, "src/greet.ts", 1, 99999);
    expect(slice?.startLine).toBe(1);
    expect(slice?.endLine).toBeGreaterThan(1);
  });
});

describe("mind map", () => {
  it("renders a themed mermaid flowchart from the project map", async () => {
    const map = await generateMap(sample);
    const mermaid = mindMapToMermaid(buildMindMap(map));
    expect(mermaid).toContain("flowchart LR");
    expect(mermaid).toContain("#38bdf8");
    expect(mermaid).toContain("greet.ts");
    // Symbol leaves are dropped from the chat diagram.
    expect(mermaid).not.toContain("(function)");
  });
});
