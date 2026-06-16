// Copyright 2026 Tim Jespers
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { Command, CommanderError } from 'commander';
import { registerGet } from './commands/get.js';
import { registerSet } from './commands/set.js';
import { registerLint } from './commands/lint.js';
import { takeExit } from './exit.js';

/** Build the `fmctl` command tree. A fresh instance per call — no shared state. */
export function buildProgram(): Command {
  const program = new Command();
  program
    .name('fmctl')
    .description('Schema-governed frontmatter management for Markdown files')
    .version('0.1.0') // x-release-please-version
    .exitOverride();

  registerGet(program);
  registerSet(program);
  registerLint(program);
  return program;
}

/**
 * Parse argv, run the selected command, and resolve to its exit code. Usable
 * both as the bin entry (via main.ts) and in-process (tests) — it never touches
 * `process.exitCode` or calls `process.exit`.
 */
export async function run(argv: string[]): Promise<number> {
  takeExit(); // clear any pending code from a prior in-process run
  const program = buildProgram();
  try {
    await program.parseAsync(argv);
  } catch (err) {
    if (err instanceof CommanderError) {
      const handled = err.code === 'commander.helpDisplayed' || err.code === 'commander.version' || err.code === 'commander.help';
      return handled ? 0 : 2; // usage error otherwise
    }
    process.stderr.write(`error: ${(err as Error).message}\n`);
    return 1;
  }
  return takeExit();
}
