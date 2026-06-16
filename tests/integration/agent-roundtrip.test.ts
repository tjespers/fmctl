import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runCli } from '../helpers/cli';
import { readFixture, FIXTURES_ROOT } from '../helpers/corpus';

const SCHEMA = join(FIXTURES_ROOT, 'schemas', 'task.json');
const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

/**
 * SC-004 / quickstart scenario 10: an agent completes a read → edit → validate
 * cycle consuming ONLY JSON stdout/stderr and exit codes — no human parsing.
 */
describe('agent round-trip (JSON + exit codes only)', () => {
  it('reads state, edits with validation, and confirms via lint on the first attempt', () => {
    const dir = mkdtempSync(join(tmpdir(), 'fmctl-agent-'));
    dirs.push(dir);
    const file = join(dir, 'task.md');
    writeFileSync(file, readFixture('splice/simple.md'));

    // 1. READ — get current state as JSON
    const got = runCli(['get', file, 'status', '--json']);
    expect(got.status).toBe(0);
    const current = JSON.parse(got.stdout).value as string;
    expect(current).toBe('draft');

    // 2. DECIDE + EDIT — advance the state, validated, JSON result
    const next = current === 'draft' ? 'review' : 'done';
    const set = runCli(['set', file, `status=${next}`, '--schema', SCHEMA, '--json']);
    expect(set.status).toBe(0);
    const setResult = JSON.parse(set.stdout);
    expect(setResult.validated).toBe(true);
    expect(setResult.changes[0]).toMatchObject({ field: 'status', after: 'review' });

    // 3. VALIDATE — confirm the corpus is clean via lint JSON
    const lint = runCli(['lint', dir, '--schema', SCHEMA, '--json']);
    expect(lint.status).toBe(0);
    expect(JSON.parse(lint.stdout).summary.invalid).toBe(0);
  });

  it('surfaces a refusal an agent can act on: violations[] + a distinct exit code', () => {
    const dir = mkdtempSync(join(tmpdir(), 'fmctl-agent-'));
    dirs.push(dir);
    const file = join(dir, 'task.md');
    writeFileSync(file, readFixture('splice/simple.md'));

    const set = runCli(['set', file, 'status=nonsense', '--schema', SCHEMA, '--json']);
    expect(set.status).toBe(1); // distinct validation exit code
    const err = JSON.parse(set.stderr).error;
    expect(err.code).toBe('validation');
    expect(err.violations[0]).toMatchObject({ field: 'status', expected: expect.stringContaining('draft') });
  });
});
