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
import { getField, getFrontmatter } from '../../lib/index.js';
import { printGetResult, printFrontmatter, fail } from '../output.js';
import { setExit } from '../exit.js';

export function registerGet(program: Command): void {
  program
    .command('get')
    .description('Read one top-level frontmatter field, or the whole block')
    .argument('<file>', 'Markdown file to read')
    .argument('[field]', 'top-level field name; omit to read the whole frontmatter')
    .option('--json', 'machine-readable output')
    .option('--schema <path>', 'accepted for symmetry; reads never validate')
    .action(async (file: string, field: string | undefined, opts: GetCliOptions) => {
      const json = opts.json === true;
      try {
        if (field === undefined) {
          printFrontmatter(await getFrontmatter(file), json);
        } else {
          printGetResult(await getField(file, field), json);
        }
        setExit(0);
      } catch (err) {
        setExit(fail(err, json));
      }
    });
}

interface GetCliOptions {
  json?: boolean;
  schema?: string;
}
