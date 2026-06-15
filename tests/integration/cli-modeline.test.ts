import { afterEach, describe, expect, it } from 'vitest';
import { rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runCli } from '../helpers/cli';
import { stageTree } from '../helpers/corpus';

const trees: string[] = [];
function tree(): string {
  const d = stageTree('modeline');
  trees.push(d);
  return d;
}
afterEach(() => {
  for (const d of trees.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe('fmctl modeline governance (integration)', () => {
  it('lint attributes a modeline-governed file to authority "document"', () => {
    const root = tree();
    const run = runCli(['lint', join(root, 'governed.md'), '--json']);
    expect(run.status).toBe(0);
    const result = JSON.parse(run.stdout);
    expect(result.files[0].status).toBe('valid');
    expect(result.files[0].governedBy.authority).toBe('document');
  });

  it('set enforces the modeline schema with no --schema flag', () => {
    const root = tree();
    const run = runCli(['set', join(root, 'governed.md'), 'status=bogus']);
    expect(run.status).toBe(1); // validation refusal via modeline
  });

  it('a successful set preserves the modeline comment byte-for-byte', () => {
    const root = tree();
    const file = join(root, 'governed.md');
    const run = runCli(['set', file, 'status=review']);
    expect(run.status).toBe(0);
    const after = readFileSync(file, 'utf8');
    expect(after).toContain('# fmctl: $schema=./schema.json');
    expect(after).toContain('status: review');
  });

  it('governs an external-standard file (additionalProperties:false) without adding a data field', () => {
    const root = tree();
    const file = join(root, 'external.md');
    // valid edit under the strict schema; modeline is a comment, not data
    const run = runCli(['set', file, 'kind=tool']);
    expect(run.status).toBe(0);
    const after = readFileSync(file, 'utf8');
    expect(after).toContain('# fmctl: $schema=./strict.json');
    // an invalid value is still refused by the strict schema
    const bad = runCli(['set', file, 'kind=nope']);
    expect(bad.status).toBe(1);
  });

  it('rejects a URI modeline ref with exit 5; get still reads the file', () => {
    const root = tree();
    const file = join(root, 'uri.md');
    expect(runCli(['set', file, 'status=review']).status).toBe(5);
    const get = runCli(['get', file, 'status']);
    expect(get.status).toBe(0);
    expect(get.stdout.trim()).toBe('draft');
  });

  it('lint reports a broken modeline ref as a per-file error (exit 1)', () => {
    const root = tree();
    const run = runCli(['lint', join(root, 'broken-ref.md'), '--json']);
    expect(run.status).toBe(1);
    expect(JSON.parse(run.stdout).files[0].status).toBe('error');
  });
});
