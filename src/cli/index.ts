#!/usr/bin/env node
import { writeFile, mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadSkills, SkillValidationError } from "../engine/index.js";
import {
  generateMap,
  mapToJson,
  mapToMarkdown,
  retrieveSymbol,
  retrieveLines,
  searchMap,
  createMapWatcher,
  buildCodeGraph
} from "../map/index.js";
import {
  addMemory,
  listMemories,
  memoryHealth,
  recallMemories,
  pruneMemory,
  regenerateIndex,
  memoryDir,
  selectRelevant,
  renderRecall,
  buildDigest,
  digestToMemory,
  captureObservations,
  countObservations,
  getObservations,
  searchObservations,
  timeline,
  distillProjectLessons,
  renderHits,
  renderTimeline,
  renderObservations,
  renderLessons,
  loadObservations,
  aggregateBySkill,
  renderSkillStats,
  writeActiveSkill,
  OBSERVATION_KINDS,
  type ObservationKind,
  type MemoryType,
  type TaskSignal
} from "../memory/index.js";
import { runDoctor, renderDoctor } from "../doctor/index.js";
import { formatStatusline } from "../statusline/index.js";
import {
  budget,
  guardRead,
  readContextUsage,
  loadBudgetConfig,
  saveBudgetConfig,
  loadSavings,
  summarizeSavings,
  renderSavings
} from "../context/index.js";
import { buildMindMap, mindMapToMermaid } from "../dashboard/model.js";
import { renderArtifact } from "../dashboard/artifact.js";
import { assembleBrief } from "../dashboard/brief.js";
import {
  appendEvent,
  readLog,
  listSessions,
  makeEvent,
  reduceEvents,
  startDashboard,
  openInBrowser,
  loadSettings,
  exportReplay,
  resolveSessionForExport,
  type EventKind
} from "../dashboard/index.js";
import { stepTokenHistory } from "../dashboard/state.js";
import { validatePlugin } from "../plugin-validate/index.js";
import { resolveSkillsDir, resolvePluginRoot } from "./skills-dir.js";

function getFlag(args: string[], name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1) return undefined;
  return args[idx + 1];
}

const USAGE = `slipstream internal helper

This is the helper binary the slipstream Claude Code plugin calls from its
hooks and slash commands. You do not run it as a product; install the plugin in
Claude Code in VS Code instead. See the README.

Usage:
  slipstream map [root] [--json out] [--md out] [--search "query"]
  slipstream slice <root> <file> <symbol>
  slipstream lines <root> <file> <start> <end>
  slipstream guard <root> <file>
  slipstream budget --bytes N [--window N]
  slipstream memory add --type T --desc "..." --body "..." [--tags a,b] [--root .]
  slipstream memory recall "query" [--root .] [--limit 5]
  slipstream memory list [--root .]
  slipstream memory doctor [--root .]
  slipstream memory prune <name> [--root .]
  slipstream memory index [--root .]
  slipstream memory search "query" [--kind K] [--session S] [--since ISO] [--limit N] [--root .]
  slipstream memory timeline <id|"query"> [--window N] [--session S] [--root .]
  slipstream memory observations <id> [id...] [--root .]
  slipstream memory lessons [--min N] [--limit N] [--root .]
  slipstream observe [--root .] [--session S] [--watch-map] [--ci]
  slipstream savings [--root .]
  slipstream mindmap [root] [--mermaid] [--html out.html]
  slipstream status [root] [--bytes N]
  slipstream brief [root] [--out file.md]
  slipstream graph [root] [--json]
  slipstream dashboard start [--root .] [--session S] [--open] [--foreground] [--watch-map]
  slipstream dashboard emit --kind K --label "..." [--root .] [--session S] [--agent A] [--bytes N]
  slipstream dashboard replay [--root .] [--session S]
  slipstream dashboard sessions [--root .]
  slipstream export <sessionId> --out replay.zip [--root .]
  slipstream stats --by-skill [--root .]
  slipstream validate [--skills dir]
  slipstream plugin-validate [--plugin dir]
  slipstream doctor [--plugin dir] [--root .]
  slipstream statusline [--root .] [--bytes N] [--skill S] [--model M] [--transcript path]
  slipstream recall-signal [--root .] [--branch B] [--files a,b] [--prompt "..."]
  slipstream digest [--root .] [--session S] [--trigger auto|manual] [--activity "a||b"] [--files a,b] [--open-task "..."]
`;

async function cmdMap(args: string[]): Promise<number> {
  const root = args[0] && !args[0].startsWith("--") ? args[0] : ".";
  const map = await generateMap(root);
  const search = getFlag(args, "search");
  if (search) {
    console.log(JSON.stringify(searchMap(map, search), null, 2));
    return 0;
  }
  const jsonOut = getFlag(args, "json");
  const mdOut = getFlag(args, "md");
  if (jsonOut) {
    await mkdir(resolve(jsonOut, ".."), { recursive: true });
    await writeFile(resolve(jsonOut), mapToJson(map), "utf8");
    console.log(`wrote ${map.stats.fileCount} files to ${jsonOut}`);
  }
  if (mdOut) {
    await mkdir(resolve(mdOut, ".."), { recursive: true });
    await writeFile(resolve(mdOut), mapToMarkdown(map), "utf8");
    console.log(`wrote markdown map to ${mdOut}`);
  }
  if (!jsonOut && !mdOut) console.log(mapToMarkdown(map));
  return 0;
}

async function cmdSlice(args: string[]): Promise<number> {
  const [root, file, symbol] = args;
  if (!root || !file || !symbol) {
    console.error("usage: slipstream slice <root> <file> <symbol>");
    return 2;
  }
  const map = await generateMap(root);
  const slice = await retrieveSymbol(map, file, symbol);
  if (!slice) {
    console.error(`no symbol "${symbol}" found in ${file}`);
    return 1;
  }
  console.log(`// ${slice.path}:${slice.startLine}-${slice.endLine} (${slice.kind})`);
  console.log(slice.code);
  return 0;
}

async function cmdLines(args: string[]): Promise<number> {
  const [root, file, startRaw, endRaw] = args;
  if (!root || !file || !startRaw || !endRaw) {
    console.error("usage: slipstream lines <root> <file> <start> <end>");
    return 2;
  }
  const slice = await retrieveLines(
    resolve(root),
    file,
    Number(startRaw),
    Number(endRaw)
  );
  if (!slice) {
    console.error(`could not read ${file}`);
    return 1;
  }
  console.log(`// ${slice.path}:${slice.startLine}-${slice.endLine}`);
  console.log(slice.code);
  return 0;
}

async function cmdGuard(args: string[]): Promise<number> {
  const [root, file] = args;
  if (!root || !file) {
    console.error("usage: slipstream guard <root> <file>");
    return 2;
  }
  const target = resolve(root, file);
  let bytes = 0;
  try {
    bytes = (await readFile(target)).byteLength;
  } catch {
    console.error(`cannot stat ${file}`);
    return 1;
  }
  const guard = guardRead(bytes, file);
  console.log(JSON.stringify(guard, null, 2));
  return 0;
}

function cmdBudget(args: string[]): number {
  const bytes = Number(getFlag(args, "bytes") ?? 0);
  const window = getFlag(args, "window");
  const report = budget({
    bytesRead: bytes,
    windowTokens: window ? Number(window) : undefined
  });
  console.log(JSON.stringify(report, null, 2));
  return 0;
}

async function cmdMemory(args: string[]): Promise<number> {
  const sub = args[0];
  const rest = args.slice(1);
  const root = getFlag(rest, "root") ?? ".";
  switch (sub) {
    case "add": {
      const type = getFlag(rest, "type") as MemoryType | undefined;
      const desc = getFlag(rest, "desc");
      const body = getFlag(rest, "body");
      const name = getFlag(rest, "name");
      const tags = getFlag(rest, "tags");
      if (!type || !desc || !body) {
        console.error("usage: slipstream memory add --type T --desc ... --body ...");
        return 2;
      }
      const m = await addMemory(root, {
        name,
        type,
        description: desc,
        body,
        tags: tags ? tags.split(",").map((t) => t.trim()) : []
      });
      console.log(`saved memory "${m.name}" (${m.type}) to ${m.sourcePath}`);
      return 0;
    }
    case "recall": {
      const query = rest.find((a) => !a.startsWith("--")) ?? "";
      const limit = Number(getFlag(rest, "limit") ?? 5);
      const hits = recallMemories(await listMemories(root), query, limit);
      if (hits.length === 0) {
        console.log("no matching memories");
        return 0;
      }
      for (const m of hits) {
        console.log(`## ${m.name} (${m.type})`);
        console.log(m.description);
        console.log("");
        console.log(m.body);
        console.log("");
      }
      return 0;
    }
    case "list": {
      const all = await listMemories(root);
      console.log(`${all.length} memories in ${memoryDir(root)}`);
      for (const m of all) console.log(`  ${m.name} [${m.type}] ${m.description}`);
      return 0;
    }
    case "doctor": {
      const all = await listMemories(root);
      const h = memoryHealth(all, Date.now());
      console.log(h.note);
      const types = Object.entries(h.byType).sort((a, b) => b[1] - a[1]);
      if (types.length) console.log("by type: " + types.map(([t, n]) => `${t} ${n}`).join(", "));
      // Exit non-zero when the store needs attention, so a script can gate on it.
      return h.duplicates > 0 || h.stale > 0 ? 1 : 0;
    }
    case "prune": {
      const name = rest.find((a) => !a.startsWith("--"));
      if (!name) {
        console.error("usage: slipstream memory prune <name>");
        return 2;
      }
      const ok = await pruneMemory(root, name);
      console.log(ok ? `pruned "${name}"` : `no memory named "${name}"`);
      return ok ? 0 : 1;
    }
    case "index": {
      const rendered = await regenerateIndex(root);
      console.log(rendered);
      return 0;
    }
    case "search": {
      const query = rest.find((a) => !a.startsWith("--")) ?? "";
      if (!query) {
        console.error('usage: slipstream memory search "query" [--kind K] [--session S] [--since ISO] [--limit N]');
        return 2;
      }
      const kindArg = getFlag(rest, "kind");
      const kind =
        kindArg && OBSERVATION_KINDS.includes(kindArg as ObservationKind)
          ? (kindArg as ObservationKind)
          : undefined;
      const hits = await searchObservations(root, {
        query,
        kind,
        session: getFlag(rest, "session"),
        since: getFlag(rest, "since"),
        limit: Number(getFlag(rest, "limit") ?? 10)
      });
      console.log(renderHits(hits));
      return 0;
    }
    case "timeline": {
      const raw = rest.find((a) => !a.startsWith("--")) ?? "";
      if (!raw) {
        console.error('usage: slipstream memory timeline <id|"query"> [--window N] [--session S]');
        return 2;
      }
      const asNum = Number(raw);
      const around = Number.isFinite(asNum) && /^\d+$/.test(raw) ? asNum : raw;
      const entries = await timeline(root, {
        around,
        window: Number(getFlag(rest, "window") ?? 3),
        session: getFlag(rest, "session")
      });
      console.log(renderTimeline(entries));
      return 0;
    }
    case "observations": {
      const ids = rest
        .filter((a) => !a.startsWith("--"))
        .flatMap((a) => a.split(","))
        .map((n) => Number(n.trim()))
        .filter((n) => Number.isFinite(n));
      if (ids.length === 0) {
        console.error("usage: slipstream memory observations <id> [id...]");
        return 2;
      }
      console.log(renderObservations(await getObservations(root, ids)));
      return 0;
    }
    case "lessons": {
      const lessons = await distillProjectLessons(root, {
        minCount: Number(getFlag(rest, "min") ?? 3),
        limit: Number(getFlag(rest, "limit") ?? 10)
      });
      console.log(renderLessons(lessons));
      return 0;
    }
    default:
      console.error(
        "usage: slipstream memory <add|recall|list|prune|index|search|timeline|observations|lessons>"
      );
      return 2;
  }
}

/**
 * Capture observations for a session by folding its dashboard event log into the
 * observation store. The Stop hook shells out to this after each turn; it is
 * incremental and idempotent thanks to the per-session cursor, so running it twice
 * adds nothing the second time.
 */
/** Report how much slipstream has optimised: scoped reads versus whole-file reads. */
async function cmdSavings(args: string[]): Promise<number> {
  const root = getFlag(args, "root") ?? ".";
  console.log(renderSavings(summarizeSavings(await loadSavings(root))));
  return 0;
}

async function cmdGraph(args: string[]): Promise<number> {
  const root = args[0] && !args[0].startsWith("--") ? args[0] : getFlag(args, "root") ?? ".";
  const graph = buildCodeGraph(await generateMap(root));
  if (getFlag(args, "json")) {
    console.log(JSON.stringify(graph, null, 2));
    return 0;
  }
  const god = [...graph.nodes].sort((a, b) => b.degree - a.degree).slice(0, 12);
  console.log(`${graph.nodes.length} files, ${graph.edges.length} internal imports.`);
  console.log("\nMost-connected files (the god nodes everything flows through):");
  for (const n of god) console.log(`  ${n.degree.toString().padStart(3)}  ${n.id}`);
  return 0;
}

async function cmdBrief(args: string[]): Promise<number> {
  const root = args[0] && !args[0].startsWith("--") ? args[0] : getFlag(args, "root") ?? ".";
  let name = "project";
  let version = "0.0.0";
  try {
    const pkg = JSON.parse(await readFile(resolve(root, "package.json"), "utf8")) as { name?: string; version?: string };
    name = pkg.name ?? name;
    version = pkg.version ?? version;
  } catch {
    // No package.json: keep the defaults.
  }
  const md = await assembleBrief(root, name, version, new Date().toISOString());
  const out = getFlag(args, "out");
  if (out) {
    await writeFile(resolve(out), md, "utf8");
    console.log(`wrote project brief to ${out}`);
  } else {
    process.stdout.write(md);
  }
  return 0;
}

async function cmdObserve(args: string[]): Promise<number> {
  const root = getFlag(args, "root") ?? ".";
  const session = getFlag(args, "session") ?? "main";
  const ci = args.includes("--ci");
  if (ci) return runObserveCi(root, session);
  const written = await captureObservations(root, session);
  console.log(
    written.length
      ? `captured ${written.length} observation(s) for session ${session} (ids ${written
          .map((o) => o.id)
          .join(", ")})`
      : `no new observations for session ${session}`
  );
  if (args.includes("--watch-map")) {
    const watcher = createMapWatcher({
      root,
      onChange: async () => {
        const next = await captureObservations(root, session);
        if (next.length) {
          console.log(`re-captured ${next.length} observation(s) after map change`);
        }
      }
    });
    process.on("SIGINT", () => {
      watcher.close();
      process.exit(0);
    });
    await new Promise(() => {});
  }
  return 0;
}

/**
 * CI mode: capture observations, emit one JSON line per observation to stdout,
 * never start the dashboard, never open a socket. Exit code 0 unless capture
 * threw. Suitable for piping in GitHub Actions.
 */
async function runObserveCi(root: string, session: string): Promise<number> {
  const written = await captureObservations(root, session);
  for (const o of written) {
    process.stdout.write(JSON.stringify(o) + "\n");
  }
  return 0;
}

async function cmdMindmap(args: string[]): Promise<number> {
  const root = args[0] && !args[0].startsWith("--") ? args[0] : ".";
  const map = await generateMap(root);
  const tree = buildMindMap(map);
  const htmlOut = getFlag(args, "html");
  if (htmlOut) {
    await writeFile(resolve(htmlOut), renderArtifact(map, tree), "utf8");
    console.log(`wrote mind map artifact to ${htmlOut}`);
    return 0;
  }
  console.log(mindMapToMermaid(tree));
  return 0;
}

async function cmdStatus(args: string[]): Promise<number> {
  const root = args[0] && !args[0].startsWith("--") ? args[0] : ".";
  const bytes = Number(getFlag(args, "bytes") ?? 0);
  const map = await generateMap(root);
  const report = budget({ bytesRead: bytes });
  const memories = await listMemories(root);
  console.log("# slipstream status");
  console.log("");
  console.log(
    `Project: ${map.stats.fileCount} files, ${map.stats.symbolCount} exported symbols.`
  );
  console.log(
    `Context budget: about ${report.approxTokens} of ${report.windowTokens} ` +
      `tokens used (${(report.usedFraction * 100).toFixed(0)} percent), level ${report.level}.`
  );
  console.log(`Advice: ${report.advice}`);
  console.log(`Memory: ${memories.length} durable facts stored.`);
  console.log("");
  console.log("## Mind map");
  console.log("");
  console.log("```mermaid");
  console.log(mindMapToMermaid(buildMindMap(map)));
  console.log("```");
  return 0;
}

async function cmdDashboard(args: string[]): Promise<number> {
  const sub = args[0];
  const rest = args.slice(1);
  const root = getFlag(rest, "root") ?? ".";
  const session = getFlag(rest, "session");
  switch (sub) {
    case "start": {
      const settings = await loadSettings(root);
      const foreground = rest.includes("--foreground");
      const result = await startDashboard({
        projectRoot: root,
        session,
        detached: !foreground
      });
      const wantOpen =
        rest.includes("--open") || (settings.autoOpen && result.started);
      if (wantOpen) openInBrowser(result.url);
      console.log(
        result.started
          ? `slipstream dashboard running at ${result.url}`
          : `slipstream dashboard already running at ${result.url}`
      );
      let watcher: { close: () => void } | null = null;
      if (rest.includes("--watch-map")) {
        watcher = createMapWatcher({
          root,
          onChange: async () => {
            await generateMap(root).catch(() => null);
          }
        });
      }
      // In the foreground case startDashboard returns the live server; keep the
      // process alive so `--foreground` actually serves.
      if (foreground && result.server) {
        process.on("SIGINT", () => {
          if (watcher) watcher.close();
          process.exit(0);
        });
        await new Promise(() => {});
      }
      return 0;
    }
    case "emit": {
      const kind = getFlag(rest, "kind") as EventKind | undefined;
      const label = getFlag(rest, "label") ?? "";
      const agent = getFlag(rest, "agent") ?? "main";
      const bytes = getFlag(rest, "bytes");
      if (!kind) {
        console.error("usage: slipstream dashboard emit --kind K --label ...");
        return 2;
      }
      const data: Record<string, unknown> = {};
      if (bytes) data["bytes"] = Number(bytes);
      const event = await appendEvent(
        root,
        makeEvent({
          session: session ?? "main",
          agent,
          kind,
          label,
          data: Object.keys(data).length ? data : undefined
        })
      );
      console.log(`emitted ${event.kind} #${event.seq} to session ${event.session}`);
      return 0;
    }
    case "replay": {
      const sessions = session
        ? [session]
        : (await listSessions(root)).slice(0, 1);
      const target = sessions[0];
      if (!target) {
        console.log("no recorded sessions to replay");
        return 0;
      }
      const state = reduceEvents(await readLog(root, target));
      console.log(`# replay of session ${target}`);
      console.log(`agents: ${state.agents.length}, events: ${state.lastSeq + 1}`);
      for (const a of state.agents) {
        console.log(`  ${a.id} [${a.status}] ${a.toolCalls} tools, ~${a.approxTokens} tokens`);
      }
      return 0;
    }
    case "sessions": {
      const sessions = await listSessions(root);
      console.log(`${sessions.length} recorded session(s)`);
      for (const s of sessions) console.log(`  ${s}`);
      return 0;
    }
    default:
      console.error("usage: slipstream dashboard <start|emit|replay|sessions>");
      return 2;
  }
}

async function cmdDoctor(args: string[]): Promise<number> {
  const pluginRoot = getFlag(args, "plugin") ?? resolvePluginRoot();
  const root = getFlag(args, "root") ?? ".";
  const report = await runDoctor(pluginRoot, resolve(root));
  console.log(renderDoctor(report));
  return report.ok ? 0 : 1;
}

async function cmdStatusline(args: string[]): Promise<number> {
  const root = getFlag(args, "root") ?? ".";
  const bytes = Number(getFlag(args, "bytes") ?? 0);
  const skill = getFlag(args, "skill");
  const model = getFlag(args, "model");
  const transcript = getFlag(args, "transcript");
  let memoryCount = 0;
  try {
    memoryCount = (await listMemories(root)).length;
  } catch {
    memoryCount = 0;
  }
  let observationCount = 0;
  try {
    observationCount = await countObservations(root);
  } catch {
    observationCount = 0;
  }
  let optimizationPct = 0;
  try {
    optimizationPct = summarizeSavings(await loadSavings(root)).pct;
  } catch {
    optimizationPct = 0;
  }

  // Prefer the true context size from the host transcript when one is supplied,
  // so the gauge reflects the whole window, not just bytes slipstream served.
  // Persist it to budget.json so the dashboard gauge reads the same real number.
  const config = await loadBudgetConfig(root).catch(() => null);
  let actualTokens: number | undefined;
  if (transcript) {
    const usage = await readContextUsage(transcript);
    if (usage) {
      actualTokens = usage.contextTokens;
      // Persist only when it actually changed, so a frequent statusline render
      // does not rewrite budget.json on every tick.
      if (config?.actualTokens !== actualTokens) {
        await saveBudgetConfig(root, { actualTokens }).catch(() => {});
      }
    }
  }

  // Persist the active skill so the next observation capture can stamp it on
  // each new observation. Skill-less renders clear the marker so the per-skill
  // stats do not attribute idle turns to a stale skill.
  await writeActiveSkill(root, skill).catch(() => {});

  // Build a recent step history so the statusline can append a forecast suffix
  // once the budget is engaged. Errors are silently ignored; the statusline is
  // a hot path and any failure here must not break rendering.
  let stepHistory: number[] | undefined;
  try {
    const sessions = await listSessions(root);
    const target = sessions[0];
    if (target) {
      stepHistory = stepTokenHistory(await readLog(root, target));
    }
  } catch {
    stepHistory = undefined;
  }

  console.log(
    formatStatusline({
      bytesRead: bytes,
      actualTokens,
      windowTokens: config?.targetTokens,
      memoryCount,
      observationCount,
      optimizationPct,
      activeSkill: skill,
      model,
      stepHistory
    })
  );
  return 0;
}

function buildSignal(args: string[]): TaskSignal {
  const branch = getFlag(args, "branch");
  const filesRaw = getFlag(args, "files");
  const prompt = getFlag(args, "prompt");
  return {
    branch: branch || undefined,
    changedFiles: filesRaw ? filesRaw.split(",").map((f) => f.trim()).filter(Boolean) : undefined,
    lastPrompt: prompt || undefined
  };
}

async function cmdRecallSignal(args: string[]): Promise<number> {
  const root = getFlag(args, "root") ?? ".";
  const signal = buildSignal(args);
  const hits = selectRelevant(await listMemories(root), signal);
  const rendered = renderRecall(hits);
  if (rendered) console.log(rendered);
  return 0;
}

async function cmdDigest(args: string[]): Promise<number> {
  const root = getFlag(args, "root") ?? ".";
  const session = getFlag(args, "session") ?? "main";
  const trigger = (getFlag(args, "trigger") as "auto" | "manual" | undefined) ?? "auto";
  const activityRaw = getFlag(args, "activity");
  const filesRaw = getFlag(args, "files");
  const openTask = getFlag(args, "open-task");
  const digest = buildDigest({
    session,
    trigger,
    activity: activityRaw ? activityRaw.split("||").map((s) => s.trim()).filter(Boolean) : [],
    filesTouched: filesRaw ? filesRaw.split(",").map((f) => f.trim()).filter(Boolean) : [],
    openTaskHint: openTask
  });
  const m = await addMemory(root, digestToMemory(digest));
  console.log(`wrote session digest "${m.name}" (${digest.trigger}) to ${m.sourcePath}`);
  return 0;
}

async function cmdStats(args: string[]): Promise<number> {
  const root = getFlag(args, "root") ?? ".";
  if (args.includes("--by-skill")) {
    const obs = await loadObservations(root);
    const stats = aggregateBySkill(obs);
    console.log(renderSkillStats(stats));
    return 0;
  }
  console.error("usage: slipstream stats --by-skill [--root .]");
  return 2;
}

async function cmdExport(args: string[]): Promise<number> {
  const positional = args.filter((a) => !a.startsWith("--"));
  const sessionArg = positional[0];
  if (!sessionArg) {
    console.error("usage: slipstream export <sessionId> --out replay.zip [--root .]");
    return 2;
  }
  const out = getFlag(args, "out");
  if (!out) {
    console.error("usage: slipstream export <sessionId> --out replay.zip");
    return 2;
  }
  const root = getFlag(args, "root") ?? ".";
  const sessionId = await resolveSessionForExport(root, sessionArg);
  const manifest = await exportReplay(resolve(out), {
    projectRoot: root,
    sessionId
  });
  console.log(
    `wrote replay bundle for session ${sessionId} to ${out} ` +
      `(${manifest.files.length} file${manifest.files.length === 1 ? "" : "s"})`
  );
  return 0;
}

async function cmdValidate(args: string[]): Promise<number> {
  const skillsDir = resolveSkillsDir(getFlag(args, "skills"));
  try {
    const skills = await loadSkills(skillsDir);
    const byCategory = new Map<string, number>();
    for (const skill of skills) {
      byCategory.set(skill.category, (byCategory.get(skill.category) ?? 0) + 1);
    }
    console.log(`OK: ${skills.length} skills loaded from ${skillsDir}`);
    for (const [cat, count] of [...byCategory.entries()].sort()) {
      console.log(`  ${cat}: ${count}`);
    }
    return 0;
  } catch (error) {
    if (error instanceof SkillValidationError) {
      console.error(`FAILED: ${error.issues.length} issues`);
      for (const issue of error.issues) {
        console.error(`  ${issue.sourcePath}: ${issue.message}`);
      }
      return 1;
    }
    console.error((error as Error).message);
    return 1;
  }
}

async function cmdPluginValidate(args: string[]): Promise<number> {
  const pluginRoot = getFlag(args, "plugin") ?? resolvePluginRoot();
  const result = await validatePlugin(pluginRoot, resolveSkillsDir());
  if (result.ok) {
    console.log(`OK: plugin valid (${result.checks.length} checks passed)`);
    for (const c of result.checks) console.log(`  pass: ${c}`);
    return 0;
  }
  console.error(`FAILED: ${result.issues.length} plugin issues`);
  for (const issue of result.issues) console.error(`  ${issue}`);
  return 1;
}

async function main(): Promise<number> {
  const [, , command, ...rest] = process.argv;
  switch (command) {
    case "map":
      return cmdMap(rest);
    case "slice":
      return cmdSlice(rest);
    case "lines":
      return cmdLines(rest);
    case "guard":
      return cmdGuard(rest);
    case "budget":
      return cmdBudget(rest);
    case "memory":
      return cmdMemory(rest);
    case "observe":
      return cmdObserve(rest);
    case "savings":
      return cmdSavings(rest);
    case "mindmap":
      return cmdMindmap(rest);
    case "status":
      return cmdStatus(rest);
    case "brief":
      return cmdBrief(rest);
    case "graph":
      return cmdGraph(rest);
    case "dashboard":
      return cmdDashboard(rest);
    case "export":
      return cmdExport(rest);
    case "stats":
      return cmdStats(rest);
    case "validate":
      return cmdValidate(rest);
    case "plugin-validate":
      return cmdPluginValidate(rest);
    case "doctor":
      return cmdDoctor(rest);
    case "statusline":
      return cmdStatusline(rest);
    case "recall-signal":
      return cmdRecallSignal(rest);
    case "digest":
      return cmdDigest(rest);
    case undefined:
    case "help":
    case "--help":
    case "-h":
      console.log(USAGE);
      return 0;
    default:
      console.error(`unknown command: ${command}\n`);
      console.log(USAGE);
      return 2;
  }
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
