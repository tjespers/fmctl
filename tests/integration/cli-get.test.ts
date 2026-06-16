import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { runCli } from '../helpers/cli';
import { FIXTURES_ROOT } from '../helpers/corpus';

const simple = join(FIXTURES_ROOT, 'splice', 'simple.md');

describe('fmctl get (integration)', () => {
  it('prints a scalar value plainly (exit 0)', () => {
    const run = runCli(['get', simple, 'status']);
    expect(run.status).toBe(0);
    expect(run.stdout.trim()).toBe('draft');
  });

  it('renders a list value as YAML flow', () => {
    const run = runCli(['get', simple, 'links']);
    expect(run.status).toBe(0);
    expect(run.stdout.trim()).toBe('[ ./other.md ]');
  });

  it('emits the GetResult shape with --json', () => {
    const run = runCli(['get', simple, 'status', '--json']);
    expect(run.status).toBe(0);
    expect(JSON.parse(run.stdout)).toEqual({ file: simple, field: 'status', value: 'draft' });
  });

  it('exit 3 when the field is missing', () => {
    const run = runCli(['get', simple, 'nope']);
    expect(run.status).toBe(3);
  });

  it('exit 3 when the file does not exist', () => {
    const run = runCli(['get', join(FIXTURES_ROOT, 'splice', 'nope.md'), 'status']);
    expect(run.status).toBe(3);
  });

  it('exit 4 on malformed frontmatter', () => {
    const run = runCli(['get', join(FIXTURES_ROOT, 'splice', 'broken-yaml.md'), 'status']);
    expect(run.status).toBe(4);
  });

  it('reads the whole frontmatter as JSON when no field is given', () => {
    const run = runCli(['get', simple, '--json']);
    expect(run.status).toBe(0);
    expect(JSON.parse(run.stdout)).toEqual({
      file: simple,
      frontmatter: { status: 'draft', type: 'task', links: ['./other.md'] },
    });
  });

  it('renders the whole frontmatter as field: value lines for humans', () => {
    const run = runCli(['get', simple]);
    expect(run.status).toBe(0);
    expect(run.stdout).toContain('status: draft');
    expect(run.stdout).toContain('type: task');
  });
});
