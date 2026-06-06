#!/usr/bin/env node
// Reproducible token-savings benchmark.
//
// Measures the cost of reading whole files versus pulling a single symbol through
// slipstream's project map, on real files in a project. Emits a Markdown table
// anyone can regenerate, so the savings claim is a number, not marketing.
//
// Usage: node scripts/benchmark-token-savings.mjs [root] [--files a.ts,b.ts]
// Requires a build first (the script imports from dist/).

import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : ".";

const flagIndex = process.argv.indexOf("--files");
const explicitFiles = flagIndex !== -1 && process.argv[flagIndex + 1]
  ? process.argv[flagIndex + 1].split(",").map((s) => s.trim()).filter(Boolean)
  : null;

const mapMod = await import(pathToFileURL(join(here, "..", "dist", "map", "index.js")).href);
const benchMod = await import(pathToFileURL(join(here, "..", "dist", "map", "benchmark.js")).href);

const map = await mapMod.generateMap(root);

// Choose the files to measure: the explicit list, or the three with the most
// exported symbols, which are where scoped reads help most.
let chosen;
if (explicitFiles) {
  chosen = explicitFiles.map((p) => map.files.find((f) => f.path === p)).filter(Boolean);
} else {
  chosen = [...map.files].filter((f) => f.symbols.length > 0)
    .sort((a, b) => b.symbols.length - a.symbols.length)
    .slice(0, 3);
}

const rows = [];
for (const file of chosen) {
  if (file.symbols.length === 0) continue;
  const wholeBytes = Buffer.byteLength(await readFile(join(map.root, file.path), "utf8"), "utf8");
  // Average the scoped read across every exported symbol, the realistic cost of
  // a typical "pull the one thing I need" read, rather than cherry-picking the
  // smallest symbol. This is the conservative, honest figure.
  let sum = 0;
  let counted = 0;
  for (const symbol of file.symbols) {
    const slice = await mapMod.retrieveSymbol(map, file.path, symbol.name);
    if (!slice) continue;
    sum += Buffer.byteLength(slice.code, "utf8");
    counted += 1;
  }
  if (counted === 0) continue;
  const scopedBytes = Math.round(sum / counted);
  rows.push(benchMod.benchmarkRow(file.path, `${counted} symbols, avg`, wholeBytes, scopedBytes));
}

process.stdout.write(benchMod.formatBenchmark(rows));
