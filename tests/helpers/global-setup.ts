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
