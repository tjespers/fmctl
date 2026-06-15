import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, chmodSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeVerified } from '../../src/lib/writer';
import { spliceFields } from '../../src/lib/splice';
import { FrontmatterDocument } from '../../src/lib/document';
import { VerificationError, IoError } from '../../src/lib/errors';
import { readFixture } from '../helpers/corpus';

const dirs: string[] = [];
function scratch(): string {
  const d = mkdtempSync(join(tmpdir(), 'fmctl-writer-'));
  dirs.push(d);
  return d;
}
afterEach(() => {
  for (const d of dirs.splice(0)) {
    try {
      chmodSync(d, 0o755);
      rmSync(d, { recursive: true, force: true });
    } catch {
      /* best effort */
    }
  }
});

async function stage(fixture: string): Promise<{ path: string; doc: FrontmatterDocument; original: string }> {
  const original = readFixture(fixture);
  const path = join(scratch(), 'doc.md');
  writeFileSync(path, original);
  const doc = await FrontmatterDocument.load(path);
  return { path, doc, original };
}

describe('writeVerified — atomic verify-or-revert', () => {
  it('commits a valid edit and leaves the file byte-exact', async () => {
    const { path, doc } = await stage('splice/simple.md');
    const { raw } = spliceFields(doc, [{ name: 'status', value: 'review' }]);
    await writeVerified({ path, oldDoc: doc, newRaw: raw, changes: [{ name: 'status', value: 'review' }] });
    expect(readFileSync(path, 'utf8')).toBe(readFixture('splice/expected/simple--status-review.md'));
  });

  it('commits a field append', async () => {
    const { path, doc } = await stage('splice/simple.md');
    const { raw } = spliceFields(doc, [{ name: 'priority', value: 'high' }]);
    await writeVerified({ path, oldDoc: doc, newRaw: raw, changes: [{ name: 'priority', value: 'high' }] });
    expect(readFileSync(path, 'utf8')).toBe(readFixture('splice/expected/simple--append-priority.md'));
  });

  it('leaves no temp file litter after a successful write', async () => {
    const { path, doc } = await stage('splice/simple.md');
    const { raw } = spliceFields(doc, [{ name: 'status', value: 'review' }]);
    await writeVerified({ path, oldDoc: doc, newRaw: raw, changes: [{ name: 'status', value: 'review' }] });
    const dir = join(path, '..');
    expect(readdirSync(dir)).toEqual(['doc.md']);
  });

  it('refuses (VerificationError) when written data does not match intent; file untouched', async () => {
    const { path, doc, original } = await stage('splice/simple.md');
    // newRaw sets status to "done" but we claim the change was "review"
    const corrupt = spliceFields(doc, [{ name: 'status', value: 'done' }]).raw;
    await expect(
      writeVerified({ path, oldDoc: doc, newRaw: corrupt, changes: [{ name: 'status', value: 'review' }] }),
    ).rejects.toBeInstanceOf(VerificationError);
    expect(readFileSync(path, 'utf8')).toBe(original);
  });

  it('refuses (VerificationError) when bytes outside the changed field differ; file untouched', async () => {
    const { path, doc, original } = await stage('splice/simple.md');
    // correct status edit, but the body is also mutated — confinement must catch it
    const good = spliceFields(doc, [{ name: 'status', value: 'review' }]).raw;
    const tampered = good.replace('# Body must stay byte-identical', '# Body got CLOBBERED');
    expect(tampered).not.toBe(good);
    await expect(
      writeVerified({ path, oldDoc: doc, newRaw: tampered, changes: [{ name: 'status', value: 'review' }] }),
    ).rejects.toBeInstanceOf(VerificationError);
    expect(readFileSync(path, 'utf8')).toBe(original);
  });

  it('raises IoError and preserves the original when the directory is unwritable', async () => {
    const { path, doc, original } = await stage('splice/simple.md');
    const { raw } = spliceFields(doc, [{ name: 'status', value: 'review' }]);
    chmodSync(join(path, '..'), 0o555);
    try {
      await expect(
        writeVerified({ path, oldDoc: doc, newRaw: raw, changes: [{ name: 'status', value: 'review' }] }),
      ).rejects.toBeInstanceOf(IoError);
      expect(readFileSync(path, 'utf8')).toBe(original);
    } finally {
      chmodSync(join(path, '..'), 0o755);
    }
  });
});
