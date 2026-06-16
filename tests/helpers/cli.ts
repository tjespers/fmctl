import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const BIN = join(ROOT, 'dist', 'cli', 'main.js');

export interface CliRun {
  status: number;
  stdout: string;
  stderr: string;
}

/** Run the built `fmctl` binary as a child process (the agent's-eye view). */
export function runCli(args: string[], opts: { cwd?: string } = {}): CliRun {
  const result = spawnSync('node', [BIN, ...args], {
    cwd: opts.cwd ?? ROOT,
    encoding: 'utf8',
  });
  return { status: result.status ?? -1, stdout: result.stdout, stderr: result.stderr };
}
