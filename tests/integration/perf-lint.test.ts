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

import { afterAll, describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { lintPaths } from '../../src/lib/lint';
import { FIXTURES_ROOT } from '../helpers/corpus';

const SCHEMA = join(FIXTURES_ROOT, 'schemas', 'task.json');
const FILE_COUNT = 1000;
const BUDGET_MS = 10_000;

// SC-007 / quickstart scenario 11: linting 1,000 files completes in < 10 s.
// Heavy; runs only when RUN_SLOW is set (the default suite stays fast).
const slow = process.env.RUN_SLOW ? describe : describe.skip;

let dir: string | undefined;
afterAll(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
});

slow('lint performance (RUN_SLOW)', () => {
  it(`lints ${FILE_COUNT} governed files in under ${BUDGET_MS / 1000}s`, async () => {
    dir = mkdtempSync(join(tmpdir(), 'fmctl-perf-'));
    const states = ['draft', 'review', 'done'];
    for (let i = 0; i < FILE_COUNT; i++) {
      const status = states[i % states.length];
      writeFileSync(join(dir, `doc-${i}.md`), `---\nstatus: ${status}\ntype: task\n---\nbody ${i}\n`);
    }

    const start = performance.now();
    const result = await lintPaths([dir], { schema: SCHEMA });
    const elapsed = performance.now() - start;

    expect(result.summary.checked).toBe(FILE_COUNT);
    expect(result.summary.valid).toBe(FILE_COUNT);
    expect(elapsed).toBeLessThan(BUDGET_MS);
  });
});
