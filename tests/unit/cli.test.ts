import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run } from '../../src/cli/program';
import { readFixture, stageTree, FIXTURES_ROOT } from '../helpers/corpus';

const SCHEMA = join(FIXTURES_ROOT, 'schemas', 'task.json');
const tmp: string[] = [];

function scratchFile(fixture: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'fmctl-cli-'));
  tmp.push(dir);
  const path = join(dir, 'doc.md');
  writeFileSync(path, readFixture(fixture));
  return path;
}
afterEach(() => {
  for (const d of tmp.splice(0)) rmSync(d, { recursive: true, force: true });
});

/** Run the CLI in-process, capturing stdout/stderr and the resolved exit code. */
async function cli(...args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  const out: string[] = [];
  const err: string[] = [];
  const so = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
    out.push(String(chunk));
    return true;
  });
  const se = vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
    err.push(String(chunk));
    return true;
  });
  try {
    const code = await run(['node', 'fmctl', ...args]);
    return { code, stdout: out.join(''), stderr: err.join('') };
  } finally {
    so.mockRestore();
    se.mockRestore();
  }
}

describe('CLI (in-process)', () => {
  describe('get', () => {
    it('prints a scalar plainly', async () => {
      const r = await cli('get', scratchFile('splice/simple.md'), 'status');
      expect(r.code).toBe(0);
      expect(r.stdout.trim()).toBe('draft');
    });

    it('emits GetResult JSON', async () => {
      const file = scratchFile('splice/simple.md');
      const r = await cli('get', file, 'status', '--json');
      expect(r.code).toBe(0);
      expect(JSON.parse(r.stdout)).toEqual({ file, field: 'status', value: 'draft' });
    });

    it('exit 3 on a missing field', async () => {
      const r = await cli('get', scratchFile('splice/simple.md'), 'nope');
      expect(r.code).toBe(3);
    });
  });

  describe('set', () => {
    it('writes a validated edit and prints a one-liner', async () => {
      const file = scratchFile('splice/simple.md');
      const r = await cli('set', file, 'status=review', '--schema', SCHEMA);
      expect(r.code).toBe(0);
      expect(r.stdout).toContain('status: draft → review');
      expect(readFileSync(file, 'utf8')).toContain('status: review');
    });

    it('refuses a violation (exit 1) with JSON violations[]', async () => {
      const r = await cli('set', scratchFile('splice/simple.md'), 'status=bogus', '--schema', SCHEMA, '--json');
      expect(r.code).toBe(1);
      expect(JSON.parse(r.stderr).error.violations[0]).toMatchObject({ field: 'status' });
    });

    it('bypasses validation with --no-validate', async () => {
      const file = scratchFile('splice/simple.md');
      const r = await cli('set', file, 'status=bogus', '--schema', SCHEMA, '--no-validate');
      expect(r.code).toBe(0);
      expect(readFileSync(file, 'utf8')).toContain('status: bogus');
    });

    it('emits the unvalidated-write notice when no schema resolves', async () => {
      const r = await cli('set', scratchFile('splice/simple.md'), 'status=done');
      expect(r.code).toBe(0);
      expect(r.stderr).toContain('notice: unvalidated write');
    });

    it('exit 2 (nested-path-unsupported) on a dotted field', async () => {
      const r = await cli('set', scratchFile('splice/simple.md'), 'meta.author=x', '--json');
      expect(r.code).toBe(2);
      expect(JSON.parse(r.stderr).error.code).toBe('nested-path-unsupported');
    });

    it('exit 2 on an assignment without =', async () => {
      const r = await cli('set', scratchFile('splice/simple.md'), 'novalue');
      expect(r.code).toBe(2);
    });
  });

  describe('lint', () => {
    it('reports per-file + summary, exit 1 on invalid/error', async () => {
      const dir = stageTree('lint');
      tmp.push(dir);
      const r = await cli('lint', dir, '--schema', SCHEMA);
      expect(r.code).toBe(1);
      expect(r.stdout).toMatch(/\d+ checked, \d+ valid, \d+ invalid/);
    });

    it('emits LintResult JSON', async () => {
      const dir = stageTree('lint');
      tmp.push(dir);
      const r = await cli('lint', dir, '--schema', SCHEMA, '--json');
      expect(JSON.parse(r.stdout).summary.invalid).toBe(1);
    });

    it('exit 5 (nothing-validated) with no schema', async () => {
      const dir = stageTree('lint');
      tmp.push(dir);
      const r = await cli('lint', join(dir, 'nested'));
      expect(r.code).toBe(5);
      expect(r.stderr).toContain('nothing could be validated');
    });
  });

  describe('program', () => {
    it('exit 0 on --help', async () => {
      const r = await cli('--help');
      expect(r.code).toBe(0);
    });

    it('exit 2 on an unknown command', async () => {
      const r = await cli('frobnicate');
      expect(r.code).toBe(2);
    });
  });
});
