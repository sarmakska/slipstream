/**
 * The live dashboard event model. Every claudepilot hook that fires during a
 * Claude Code session appends one of these to an append-only log. The dashboard
 * server tails that log and the UI reduces the stream into agent state. The
 * schema is deliberately small and flat so it is cheap to write, cheap to parse,
 * and easy to reason about during replay.
 *
 * One rule drives the design: an event is a fact that already happened. We never
 * mutate a written event. State on the dashboard is a fold over the log, so the
 * same log replayed twice reconstructs the same picture. That is what makes
 * replay free.
 */

import { z } from "zod";

/** The lifecycle points claudepilot observes. Mirrors the wired hooks. */
export const EVENT_KINDS = [
  "session-start",
  "user-prompt",
  "pre-tool",
  "post-tool",
  "subagent-start",
  "subagent-stop",
  "stop"
] as const;

export type EventKind = (typeof EVENT_KINDS)[number];

/**
 * A single lifecycle event. `agent` is the logical actor: the main session is
 * "main"; a subagent gets its own id so its activity groups separately in the
 * UI. `seq` is filled by the writer, not the caller, so ordering is owned by the
 * one process that appends.
 */
export const eventSchema = z.object({
  /** Monotonic sequence within a session, assigned by the writer. */
  seq: z.number().int().nonnegative(),
  /** ISO 8601 timestamp, assigned at write time. */
  ts: z.string(),
  /** The session this event belongs to, so replay can pick one session. */
  session: z.string().min(1),
  /** The actor: "main" or a subagent id. */
  agent: z.string().min(1),
  kind: z.enum(EVENT_KINDS),
  /** Short human label for the activity stream, already redacted. */
  label: z.string(),
  /** Optional structured payload, already redacted. */
  data: z.record(z.unknown()).optional()
});

export type DashboardEvent = z.infer<typeof eventSchema>;

/** What a caller supplies; the writer fills seq and ts. */
export type EventDraft = Omit<DashboardEvent, "seq" | "ts">;

/**
 * Patterns that look like secrets. The activity stream is local-only, but a
 * tool input can still carry a token or a connection string, and a user might
 * screen-share the dashboard. We redact before the event ever reaches disk, so
 * a secret is never persisted in the log either. The list is intentionally
 * blunt: false positives just mask a value, which is the safe direction.
 */
const SECRET_PATTERNS: RegExp[] = [
  // Bearer tokens and authorization headers.
  /\b(bearer\s+)[a-z0-9._-]{12,}/gi,
  // Common provider key prefixes: sk-, pk_, rk_, ghp_, github_pat_, etc.
  /\b(sk|pk|rk|ak|sk_live|sk_test|pk_live|pk_test|ghp|gho|ghs|github_pat|xoxb|xoxp|re)[_-][a-z0-9]{10,}/gi,
  // AWS access key ids.
  /\bAKIA[0-9A-Z]{16}\b/g,
  // Anything that reads like KEY=secret or TOKEN: secret.
  /\b([A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|PASSWD|PWD)[A-Z0-9_]*)\s*[=:]\s*("?)[^\s"']{6,}\2/gi,
  // Postgres/redis style connection strings with inline credentials.
  /\b([a-z]+:\/\/[^\s:@/]+:)[^\s@/]+@/gi
];

/** Replace the secret part of a match with a marker, keeping any label. */
export function redactSecrets(input: string): string {
  let out = input;
  for (const pattern of SECRET_PATTERNS) {
    out = out.replace(pattern, (match, ...groups) => {
      // The interesting captured prefix (label, scheme, "bearer ") is kept.
      const prefix = typeof groups[0] === "string" ? groups[0] : "";
      if (prefix && match.startsWith(prefix)) {
        return `${prefix}[redacted]`;
      }
      return "[redacted]";
    });
  }
  return out;
}

/** Recursively redact a structured payload. Strings only; shape is preserved. */
export function redactData(
  data: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  if (!data) return undefined;
  const walk = (value: unknown): unknown => {
    if (typeof value === "string") return redactSecrets(value);
    if (Array.isArray(value)) return value.map(walk);
    if (value && typeof value === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        out[k] = walk(v);
      }
      return out;
    }
    return value;
  };
  return walk(data) as Record<string, unknown>;
}

/**
 * Build a redacted draft from raw hook inputs. Both the label and any payload
 * are scrubbed here, so callers cannot accidentally skip redaction: the only
 * way to make an event is through this function.
 */
export function makeEvent(input: {
  session: string;
  agent: string;
  kind: EventKind;
  label: string;
  data?: Record<string, unknown>;
}): EventDraft {
  return {
    session: input.session,
    agent: input.agent || "main",
    kind: input.kind,
    label: redactSecrets(input.label).slice(0, 500),
    data: redactData(input.data)
  };
}

/** Parse one log line into an event, or null if it is malformed. */
export function parseEvent(line: string): DashboardEvent | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  try {
    return eventSchema.parse(JSON.parse(trimmed));
  } catch {
    return null;
  }
}
