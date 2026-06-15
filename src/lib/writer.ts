import { readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { FrontmatterDocument } from './document.js';
import { IoError, VerificationError } from './errors.js';
import type { FieldChange } from './splice.js';
import type { JsonValue } from './types.js';

export interface VerifiedWrite {
  path: string;
  oldDoc: FrontmatterDocument;
  /** New full file content produced by the splice engine. */
  newRaw: string;
  /** The intended changes (names + parsed values). */
  changes: FieldChange[];
}

/**
 * Atomic, self-verifying write (constitution Principle II; FR-007). Writes to a
 * temp file in the same directory, verifies the temp content *before* renaming
 * over the original — so the original is never replaced by unverified bytes —
 * and on any anomaly removes the temp, leaves the original intact, and throws.
 */
export async function writeVerified(w: VerifiedWrite): Promise<void> {
  const intendedData = intendedDataOf(w.oldDoc, w.changes);
  const tempPath = join(dirname(w.path), `.${basename(w.path)}.fmctl-${process.pid}.tmp`);

  try {
    await writeFile(tempPath, w.newRaw, 'utf8');
  } catch (err) {
    await safeUnlink(tempPath);
    throw new IoError(`cannot write temporary file for ${w.path}: ${(err as Error).message}`, {
      file: w.path,
      cause: err,
    });
  }

  try {
    const onDisk = await readFile(tempPath, 'utf8');
    verify(w, onDisk, intendedData);
  } catch (err) {
    await safeUnlink(tempPath);
    if (err instanceof VerificationError) throw err;
    throw new VerificationError(`post-write verification failed for ${w.path}: ${(err as Error).message}`, {
      file: w.path,
      cause: err,
    });
  }

  try {
    await rename(tempPath, w.path);
  } catch (err) {
    await safeUnlink(tempPath);
    await ensureOriginalIntact(w.path, w.oldDoc.raw);
    throw new IoError(`cannot commit write to ${w.path}: ${(err as Error).message}`, { file: w.path, cause: err });
  }
}

function intendedDataOf(oldDoc: FrontmatterDocument, changes: FieldChange[]): Record<string, JsonValue> {
  const data: Record<string, JsonValue> = { ...oldDoc.data };
  for (const change of changes) data[change.name] = change.value;
  return data;
}

function verify(w: VerifiedWrite, onDisk: string, intendedData: Record<string, JsonValue>): void {
  // (a) bytes read back are exactly what we meant to write (no disk corruption)
  if (onDisk !== w.newRaw) {
    throw new VerificationError(`written bytes differ from intended content for ${w.path}`, { file: w.path });
  }

  // (b) re-parse and confirm the resulting data matches the intended change
  let newDoc: FrontmatterDocument;
  try {
    newDoc = FrontmatterDocument.fromString(onDisk, w.path);
  } catch (err) {
    throw new VerificationError(`written file does not re-parse for ${w.path}: ${(err as Error).message}`, {
      file: w.path,
      cause: err,
    });
  }
  if (!isDeepStrictEqual(newDoc.data, intendedData)) {
    throw new VerificationError(`written data does not match the intended change for ${w.path}`, { file: w.path });
  }

  // (c) textual confinement: every byte outside the changed/created field lines
  //     is identical — the executable form of FR-004.
  const changed = new Set(w.changes.map((c) => c.name));
  const oldRemainder = removeLines(w.oldDoc.raw, fileLineSet(w.oldDoc, changed));
  const newRemainder = removeLines(onDisk, fileLineSet(newDoc, changed));
  if (oldRemainder !== newRemainder) {
    throw new VerificationError(`write touched bytes outside the changed fields for ${w.path}`, { file: w.path });
  }
}

/** 1-based file lines occupied by the named fields' entries. */
function fileLineSet(doc: FrontmatterDocument, names: Set<string>): Set<number> {
  const base = countNewlines(doc.raw.slice(0, doc.frontmatter.range[0]));
  const set = new Set<number>();
  for (const name of names) {
    const field = doc.field(name);
    if (!field) continue;
    for (let line = field.entryLines[0]; line <= field.entryLines[1]; line++) {
      set.add(base + line);
    }
  }
  return set;
}

function removeLines(raw: string, lineSet: Set<number>): string {
  if (lineSet.size === 0) return raw;
  return splitLinesKeepEnds(raw)
    .filter((_, i) => !lineSet.has(i + 1))
    .join('');
}

function splitLinesKeepEnds(raw: string): string[] {
  const out: string[] = [];
  let start = 0;
  for (let i = 0; i < raw.length; i++) {
    if (raw.charCodeAt(i) === 10) {
      out.push(raw.slice(start, i + 1));
      start = i + 1;
    }
  }
  if (start < raw.length) out.push(raw.slice(start));
  return out;
}

function countNewlines(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) === 10) n++;
  }
  return n;
}

async function safeUnlink(path: string): Promise<void> {
  try {
    await unlink(path);
  } catch {
    /* temp may not exist; nothing to clean */
  }
}

async function ensureOriginalIntact(path: string, original: string): Promise<void> {
  try {
    const current = await readFile(path, 'utf8');
    if (current !== original) await writeFile(path, original, 'utf8');
  } catch {
    try {
      await writeFile(path, original, 'utf8');
    } catch {
      /* last-resort restore; surfaced error is the original IoError */
    }
  }
}
