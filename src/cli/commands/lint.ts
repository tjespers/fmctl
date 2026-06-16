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

import type { Command } from 'commander';
import { lintPaths } from '../../lib/index.js';
import type { LintResult } from '../../lib/index.js';
import { printLintResult, fail } from '../output.js';
import { setExit } from '../exit.js';

export function registerLint(program: Command): void {
  program
    .command('lint')
    .description('Validate Markdown frontmatter across files and directories')
    .argument('[paths...]', 'files or directories to lint (default ".")')
    .option('--json', 'machine-readable output')
    .option('--schema <path>', 'schema override applied to every file')
    .action(async (paths: string[], opts: LintCliOptions) => {
      const json = opts.json === true;
      try {
        const roots = paths.length > 0 ? paths : ['.'];
        const result = await lintPaths(roots, opts.schema !== undefined ? { schema: opts.schema } : {});
        printLintResult(result, json);
        setExit(decideExit(result, opts.schema !== undefined, json));
      } catch (err) {
        setExit(fail(err, json));
      }
    });
}

interface LintCliOptions {
  json?: boolean;
  schema?: string;
}

function decideExit(result: LintResult, hadOverride: boolean, json: boolean): number {
  if (result.files.some((f) => f.status === 'invalid' || f.status === 'error')) {
    return 1;
  }
  if (!hadOverride && result.summary.checked === 0 && result.files.length > 0) {
    const message = 'nothing could be validated (no schema resolved for any file)';
    if (json) {
      process.stderr.write(JSON.stringify({ error: { code: 'nothing-validated', message } }) + '\n');
    } else {
      process.stderr.write(`error: ${message}\n`);
    }
    return 5; // FR-013 distinct nothing-validated failure
  }
  return 0;
}
