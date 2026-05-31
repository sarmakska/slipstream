// Greeting helpers for the sample project.

export interface Greeting {
  language: string;
  text: string;
}

export type Salutation = "formal" | "casual";

/**
 * Build a greeting string for a given name. This multi line body exercises the
 * scoped retrieval brace walker.
 */
export function greet(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return "hello there";
  }
  return `hello ${trimmed}`;
}

export const DEFAULT_GREETING: Greeting = {
  language: "en",
  text: "hello"
};
