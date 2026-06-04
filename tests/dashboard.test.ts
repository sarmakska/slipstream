import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  makeEvent,
  parseEvent,
  redactSecrets,
  eventSchema,
  EVENT_KINDS,
  type EventKind
} from "../src/dashboard/events.js";
import {
  appendEvent,
  readLog,
  readLogSince,
  listSessions,
  nextSeq
} from "../src/dashboard/log.js";
import { reduceEvents, applyEvent, emptyState } from "../src/dashboard/state.js";
import { DashboardServer } from "../src/dashboard/server.js";
import { startDashboard, liveServer } from "../src/dashboard/launch.js";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "slipstream-dash-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("event schema and redaction", () => {
  it("produces a valid event for every lifecycle kind", () => {
    for (const kind of EVENT_KINDS) {
      const draft = makeEvent({ session: "s1", agent: "main", kind, label: "x" });
      const full = { ...draft, seq: 0, ts: new Date().toISOString() };
      expect(() => eventSchema.parse(full)).not.toThrow();
    }
  });

  it("redacts obvious secrets in labels and payloads", () => {
    expect(redactSecrets("token sk-ABCDEF1234567890")).toContain("[redacted]");
    expect(redactSecrets("DATABASE_PASSWORD=hunter2supersecret")).toContain(
      "[redacted]"
    );
    const e = makeEvent({
      session: "s1",
      agent: "main",
      kind: "pre-tool",
      label: "Bearer abcdef1234567890token",
      data: { headers: "Authorization: Bearer abcdef1234567890token" }
    });
    expect(e.label).toContain("[redacted]");
    expect(JSON.stringify(e.data)).toContain("[redacted]");
  });

  it("parseEvent rejects malformed lines", () => {
    expect(parseEvent("not json")).toBeNull();
    expect(parseEvent("")).toBeNull();
    expect(parseEvent("{}")).toBeNull();
  });
});

describe("append-only log writer", () => {
  it("assigns monotonic sequences and never rewrites", async () => {
    const a = await appendEvent(root, makeEvent({ session: "s1", agent: "main", kind: "session-start", label: "a" }));
    const b = await appendEvent(root, makeEvent({ session: "s1", agent: "main", kind: "user-prompt", label: "b" }));
    expect(a.seq).toBe(0);
    expect(b.seq).toBe(1);
    const log = await readLog(root, "s1");
    expect(log).toHaveLength(2);
    expect(log[0]?.label).toBe("a");
    expect(await nextSeq(root, "s1")).toBe(2);
  });

  it("is concurrency-safe: parallel appends keep unique sequences and lose nothing", async () => {
    const kinds: EventKind[] = ["pre-tool", "post-tool", "user-prompt"];
    const writes = Array.from({ length: 25 }, (_, i) =>
      appendEvent(
        root,
        makeEvent({
          session: "race",
          agent: "main",
          kind: kinds[i % kinds.length] as EventKind,
          label: `e${i}`
        })
      )
    );
    await Promise.all(writes);
    const log = await readLog(root, "race");
    expect(log).toHaveLength(25);
    const seqs = log.map((e) => e.seq).sort((x, y) => x - y);
    expect(new Set(seqs).size).toBe(25);
    expect(seqs[0]).toBe(0);
    expect(seqs[seqs.length - 1]).toBe(24);
  });

  it("readLogSince returns only newer events", async () => {
    await appendEvent(root, makeEvent({ session: "s", agent: "main", kind: "session-start", label: "0" }));
    await appendEvent(root, makeEvent({ session: "s", agent: "main", kind: "stop", label: "1" }));
    const since = await readLogSince(root, "s", 0);
    expect(since).toHaveLength(1);
    expect(since[0]?.seq).toBe(1);
  });

  it("lists recorded sessions", async () => {
    await appendEvent(root, makeEvent({ session: "alpha", agent: "main", kind: "session-start", label: "x" }));
    await appendEvent(root, makeEvent({ session: "beta", agent: "main", kind: "session-start", label: "y" }));
    const sessions = await listSessions(root);
    expect(sessions).toContain("alpha");
    expect(sessions).toContain("beta");
  });
});

describe("state reduction and replay", () => {
  it("reconstructs agent state from a recorded log", async () => {
    const s = "replay1";
    await appendEvent(root, makeEvent({ session: s, agent: "main", kind: "session-start", label: "start" }));
    await appendEvent(root, makeEvent({ session: s, agent: "main", kind: "user-prompt", label: "build the thing" }));
    await appendEvent(root, makeEvent({ session: s, agent: "main", kind: "pre-tool", label: "Read src/a.ts" }));
    await appendEvent(root, makeEvent({ session: s, agent: "main", kind: "post-tool", label: "Read done", data: { bytes: 3600 } }));
    await appendEvent(root, makeEvent({ session: s, agent: "worker-1", kind: "subagent-stop", label: "subagent finished" }));
    await appendEvent(root, makeEvent({ session: s, agent: "main", kind: "stop", label: "done" }));

    const state = reduceEvents(await readLog(root, s));
    const main = state.agents.find((a) => a.id === "main");
    const worker = state.agents.find((a) => a.id === "worker-1");
    expect(main?.status).toBe("waiting");
    expect(main?.toolCalls).toBe(1);
    expect(main?.approxTokens).toBe(1000); // 3600 / 3.6
    expect(worker?.status).toBe("done");
    expect(state.lastSeq).toBe(5);
  });

  it("applyEvent is idempotent for an already folded sequence", () => {
    const state = emptyState();
    const e = { seq: 0, ts: "t", session: "s", agent: "main", kind: "pre-tool" as const, label: "x" };
    applyEvent(state, e);
    applyEvent(state, e);
    expect(state.agents[0]?.toolCalls).toBe(1);
  });

  it("carries a live plan from event payloads", () => {
    const state = emptyState();
    applyEvent(state, {
      seq: 0, ts: "t", session: "s", agent: "main", kind: "user-prompt",
      label: "plan", data: { plan: ["step one", "step two"] }
    });
    expect(state.plan).toEqual(["step one", "step two"]);
  });
});

describe("server", () => {
  it("starts on a free port, serves the UI, and streams an event end to end", async () => {
    const session = "stream1";
    await appendEvent(root, makeEvent({ session, agent: "main", kind: "session-start", label: "start" }));
    const server = new DashboardServer({ projectRoot: root, session, pollMs: 50 });
    const port = await server.listen();
    expect(port).toBeGreaterThan(0);

    try {
      const html = await fetch(`http://127.0.0.1:${port}/`).then((r) => r.text());
      expect(html).toContain("slipstream");

      // Consume the SSE stream by hand: read the snapshot frame, then append a
      // fresh event and assert a "state" frame arrives carrying it.
      const controller = new AbortController();
      const res = await fetch(`http://127.0.0.1:${port}/api/stream?session=${session}`, {
        signal: controller.signal
      });
      const reader = (res.body as ReadableStream<Uint8Array>).getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let sawSnapshot = false;
      let statePayload: string | null = null;

      const deadline = Date.now() + 5000;
      while (Date.now() < deadline && statePayload === null) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let sep;
        while ((sep = buffer.indexOf("\n\n")) !== -1) {
          const frame = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          const ev = /event: (\w+)/.exec(frame)?.[1];
          const data = /data: (.+)/.exec(frame)?.[1];
          if (ev === "snapshot" && !sawSnapshot) {
            sawSnapshot = true;
            await appendEvent(root, makeEvent({ session, agent: "main", kind: "pre-tool", label: "Read x" }));
          } else if (ev === "state") {
            statePayload = data ?? null;
          }
        }
      }
      controller.abort();
      await reader.cancel().catch(() => {});

      expect(sawSnapshot).toBe(true);
      expect(statePayload).not.toBeNull();
      const pushed = JSON.parse(statePayload as string);
      expect(pushed.agents[0].toolCalls).toBe(1);
    } finally {
      await server.close();
    }
  }, 10000);

  it("closes without leaving the port bound", async () => {
    const server = new DashboardServer({ projectRoot: root });
    const port = await server.listen();
    await server.close();
    const second = new DashboardServer({ projectRoot: root, port });
    // Rebinding the same port proves the first released it.
    await expect(second.listen()).resolves.toBe(port);
    await second.close();
  });
});

describe("idempotent start", () => {
  it("a second start reuses the live server instead of spawning another", async () => {
    const first = await startDashboard({ projectRoot: root, session: "s", detached: false });
    expect(first.started).toBe(true);
    try {
      const live = await liveServer(root);
      expect(live?.port).toBe(first.port);

      const second = await startDashboard({ projectRoot: root, session: "s", detached: false });
      expect(second.started).toBe(false);
      expect(second.port).toBe(first.port);
      expect(second.server).toBeUndefined();
    } finally {
      await first.server?.close();
    }
  });
});
