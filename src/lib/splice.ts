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

import type { FrontmatterDocument } from './document.js';
import { serializeValue } from './values.js';
import type { JsonValue } from './types.js';

/** A whole-value replacement (or creation) of one top-level field. */
export interface FieldChange {
  name: string;
  value: JsonValue;
}

export interface SpliceResult {
  /** New full file content. */
  raw: string;
  /** New frontmatter text (between the delimiters). */
  frontmatterText: string;
  /** Names appended as new fields, in application order. */
  created: string[];
}

interface RangeEdit {
  start: number;
  end: number;
  text: string;
}

/**
 * Produce new file content by splicing serialized values into the original
 * frontmatter text (constitution Principle I). Existing fields are replaced at
 * their value byte-range; new fields are appended as fresh lines at the end of
 * the block. The body and every untouched byte are carried through verbatim.
 */
export function spliceFields(doc: FrontmatterDocument, changes: FieldChange[]): SpliceResult {
  const text = doc.frontmatter.text;
  const eol = detectEol(doc);

  const edits: RangeEdit[] = [];
  const created: string[] = [];
  let appended = '';

  for (const change of changes) {
    const serialized = serializeValue(change.value);
    const field = doc.field(change.name);
    if (field) {
      const [start, rawEnd] = field.valueRange;
      edits.push({ start, end: trimTrailingEol(text, start, rawEnd), text: serialized });
    } else {
      created.push(change.name);
      appended += `${change.name}: ${serialized}${eol}`;
    }
  }

  let edited = applyEdits(text, edits);
  if (appended) {
    if (edited.length > 0 && !endsWithEol(edited)) edited += eol;
    edited += appended;
  }

  const [fmStart, fmEnd] = doc.frontmatter.range;
  const raw = doc.raw.slice(0, fmStart) + edited + doc.raw.slice(fmEnd);
  return { raw, frontmatterText: edited, created };
}

/** Apply non-overlapping range replacements right-to-left so offsets stay valid. */
function applyEdits(text: string, edits: RangeEdit[]): string {
  let out = text;
  for (const edit of [...edits].sort((a, b) => b.start - a.start)) {
    out = out.slice(0, edit.start) + edit.text + out.slice(edit.end);
  }
  return out;
}

/**
 * Block-style values (sequences, block scalars, block maps) carry a trailing
 * line terminator inside their node range. Replacing that with a flow value
 * would merge the next line up, so trim a single trailing EOL from the range.
 */
function trimTrailingEol(text: string, start: number, end: number): number {
  const slice = text.slice(start, end);
  if (slice.endsWith('\r\n')) return end - 2;
  if (slice.endsWith('\n')) return end - 1;
  return end;
}

function detectEol(doc: FrontmatterDocument): string {
  if (doc.frontmatter.text.includes('\r\n')) return '\r\n';
  return doc.raw.includes('\r\n') ? '\r\n' : '\n';
}

function endsWithEol(text: string): boolean {
  return text.endsWith('\n');
}
