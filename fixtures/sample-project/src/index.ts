// Entry point for the sample project used in tests.
import { greet } from "./greet.js";

export const VERSION = "1.0.0";

export function main(): string {
  return greet("world");
}

export default main;
