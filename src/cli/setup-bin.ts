#!/usr/bin/env node
/**
 * `slipstream-setup` is the entry point for the editor-aware setup command.
 * It is shipped as a separate bin so the wiring lives in one self-contained
 * file and the main dispatcher does not need to change. The implementation
 * lives in setup.ts and is fully unit-tested there; this file is the I/O shell.
 */
import { parseSetupArgs, runSetup } from "./setup.js";

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const opts = parseSetupArgs(args, process.cwd());
  const result = await runSetup(opts);
  for (const note of result.notes) console.log(note);
  return result.exitCode;
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
