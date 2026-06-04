# Performance and benchmarks

Every number here was measured on the machine I develop on: an Apple M3 Pro running Node 25, against this repository. No figure is invented. Where a number depends on project size, the project size is stated.

## Map generation

The project map is regenerated on demand. Over this repository (59 source files, 158 exported symbols, 211,926 bytes of source) `generateMap` runs in about **24 ms**. It reads each candidate file once, extracts only the public surface with a line scan, and never stores contents, so the cost scales with the number of files, not their size.

```
files 59  symbols 158  bytes 211,926  generate ~24 ms
```

For a project ten times this size, expect map generation in the low hundreds of milliseconds, dominated by file IO. It is cheap enough to regenerate per `/slipstream:map` invocation rather than cache aggressively.

## MCP server cold start and roundtrip

Spawning the bundled MCP server and completing `initialize` plus `tools/list` over stdio takes about **90 ms** wall time from cold, almost all of which is Node process startup. Once the server is up, a `tools/call` is a synchronous library call plus the map generation cost for the tools that need it. Claude Code keeps the server alive for the session, so the 90 ms is paid once.

## Recall ranking

Signal-ranked recall is pure and fast. Over a 50-memory store, `selectRelevant` runs in about **16 microseconds** per call (16.1 ms for 1,000 calls). Recall is never the bottleneck; it is bounded by a token ceiling, not by time, so a large store costs the same wall time and a bounded amount of context.

```
selectRelevant over 50 memories: ~16 us per call
```

## The token budget (the number that matters most)

The point of slipstream is fewer tokens, not faster milliseconds. The measured token figures, at the conservative 3.6 bytes per token estimate:

| Operation | Bytes | Approx tokens |
|---|---|---|
| Read whole `src/map/retrieve.ts` | 4,841 | ~1,345 |
| `sp_symbol(retrieve.ts, retrieveSymbol)` | 1,381 | ~384 (71% less) |
| Read every file in `src/` | 146,150 | ~40,597 |
| Read the `sp_map` index instead | 7,821 | ~2,173 (5.4% of reading everything) |

## Test suite

`pnpm test` runs **120 tests across 13 files in about 1.6 s**. The slowest files are the dashboard suite (a real SSE server end to end, 25 parallel log writers) and plugin-validate (it loads all 63 skills). The MCP stdio test spawns the real server and waits for three responses; it completes in well under a second.

## How to reproduce

```
pnpm install --frozen-lockfile
pnpm build
node -e "import('./dist/map/index.js').then(async m=>{const t=Date.now();const map=await m.generateMap('.');console.log(map.stats, Date.now()-t,'ms')})"
node dist/cli/index.js slice . src/map/retrieve.ts retrieveSymbol | wc -c
pnpm test
```

Your numbers will differ with CPU and disk, but the ratios (slice versus whole file, map versus whole tree) hold because they are properties of the data, not the machine.

## See also

- [Token efficiency](Token-Efficiency) for the worked savings.
- [Testing strategy](Testing-Strategy) for what the suite covers.
- [Architecture](Architecture) for why the hot paths are pure.

---
SarmaLinux . sarmalinux.com . [Repository](https://github.com/sarmakska/slipstream)
