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

import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Integration tests drive the built CLI binary, so compile once before the suite.
export default function setup(): void {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const result = spawnSync('npm', ['run', 'build'], { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error('tsc build failed before tests:\n' + (result.stderr || result.stdout));
  }
}
