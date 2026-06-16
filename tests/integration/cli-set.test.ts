import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runCli } from '../helpers/cli';
import { readFixture, FIXTURES_ROOT } from '../helpers/corpus';

const SCHEMA = join(FIXTURES_ROOT, 'schemas', 'task.json');
const dirs: string[] = [];

function stage(fixture: string, name = 'doc.md'): { dir: string; path: string; original: string } {
  const dir = mkdtempSync(join(tmpdir(), 'fmctl-cli-set-'));
  dirs.push(dir);
  const path = join(dir, name);
  const original = readFixture(fixture);
  writeFileSync(path, original);
  return { dir, path, original };
}
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe('fmctl set (integration)', () => {
  it('writes a validated edit and emits JSON with before/after/governedBy', () => {
    const { path } = stage('splice/simple.md');
    const run = runCli(['set', path, 'status=review', '--schema', SCHEMA, '--json']);
    expect(run.status).toBe(0);
    const out = JSON.parse(run.stdout);
    expect(out.changes[0]).toEqual({ field: 'status', before: 'draft', after: 'review', created: false });
    expect(out.validated).toBe(true);
    expect(out.governedBy).toMatchObject({ authority: 'invocation', location: SCHEMA });
    expect(readFileSync(path, 'utf8')).toBe(readFixture('splice/expected/simple--status-review.md'));
  });

  it('renders a human one-liner per change', () => {
    const { path } = stage('splice/simple.md');
    const run = runCli(['set', path, 'status=review', '--schema', SCHEMA]);
    expect(run.status).toBe(0);
    expect(run.stdout).toContain('status: draft → review');
  });

  it('refuses a schema violation with exit 1 and JSON violations[]; file untouched', () => {
    const { path, original } = stage('splice/simple.md');
    const run = runCli(['set', path, 'status=bogus', '--schema', SCHEMA, '--json']);
    expect(run.status).toBe(1);
    const err = JSON.parse(run.stderr).error;
    expect(err.code).toBe('validation');
    expect(err.violations[0]).toMatchObject({ field: 'status', value: 'bogus', keyword: 'enum' });
    expect(readFileSync(path, 'utf8')).toBe(original);
  });

  it('parses a flow-list value and replaces the field wholesale', () => {
    const { path } = stage('splice/simple.md');
    const run = runCli(['set', path, 'links=[./other.md, ./new.md]', '--schema', SCHEMA, '--json']);
    expect(run.status).toBe(0);
    expect(readFileSync(path, 'utf8')).toBe(readFixture('splice/expected/simple--links-replace.md'));
  });

  it('--no-validate bypasses schema validation only', () => {
    const { path } = stage('splice/simple.md');
    const run = runCli(['set', path, 'status=bogus', '--schema', SCHEMA, '--no-validate']);
    expect(run.status).toBe(0);
    expect(readFileSync(path, 'utf8')).toContain('status: bogus');
  });

  it('emits an unvalidated-write notice on stderr when no schema resolves', () => {
    const { path } = stage('splice/simple.md');
    const run = runCli(['set', path, 'status=done']);
    expect(run.status).toBe(0);
    expect(run.stderr).toContain('notice: unvalidated write');
  });

  it('exit 2 on usage error (assignment without =)', () => {
    const { path } = stage('splice/simple.md');
    const run = runCli(['set', path, 'novalue']);
    expect(run.status).toBe(2);
  });

  it('exit 2 with code nested-path-unsupported on a dotted field name', () => {
    const { path, original } = stage('splice/simple.md');
    const run = runCli(['set', path, 'meta.author=x', '--json']);
    expect(run.status).toBe(2);
    expect(JSON.parse(run.stderr).error.code).toBe('nested-path-unsupported');
    expect(readFileSync(path, 'utf8')).toBe(original);
  });

  it('exit 3 when the target file does not exist', () => {
    const { dir } = stage('splice/simple.md');
    const run = runCli(['set', join(dir, 'nope.md'), 'status=review', '--schema', SCHEMA]);
    expect(run.status).toBe(3);
  });

  it('exit 4 on malformed frontmatter', () => {
    const { path } = stage('splice/broken-yaml.md');
    const run = runCli(['set', path, 'status=review', '--schema', SCHEMA]);
    expect(run.status).toBe(4);
  });

  it('exit 5 when the schema override is unusable', () => {
    const { path } = stage('splice/simple.md');
    const run = runCli(['set', path, 'status=review', '--schema', '/no/such/schema.json']);
    expect(run.status).toBe(5);
  });

  it('exit 7 on a filesystem failure (unwritable directory); file untouched', () => {
    const { dir, path, original } = stage('splice/simple.md');
    chmodSync(dir, 0o555);
    try {
      const run = runCli(['set', path, 'status=review', '--schema', SCHEMA]);
      expect(run.status).toBe(7);
      expect(readFileSync(path, 'utf8')).toBe(original);
    } finally {
      chmodSync(dir, 0o755);
    }
  });
});
