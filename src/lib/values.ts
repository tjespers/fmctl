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

import { parseDocument, stringify } from 'yaml';
import { UsageError } from './errors.js';
import type { JsonValue } from './types.js';

/**
 * Parse a `field=value` value string into a JsonValue using YAML's own rules
 * (R6): a leading `[` is a flow sequence, a leading `{` a flow mapping (JSON
 * arrays/objects are valid YAML flow), anything else a single scalar. The
 * schema — not this function — enforces expected types.
 */
export function parseValue(input: string): JsonValue {
  const doc = parseDocument(input);
  if (doc.errors.length > 0) {
    throw new UsageError(`unparseable value ${JSON.stringify(input)}: ${doc.errors[0]!.message}`);
  }
  const value = doc.toJS() as unknown;
  assertJsonValue(value, input);
  return value as JsonValue;
}

/**
 * Serialize a JsonValue to YAML text for splicing — flow style for collections,
 * minimal/quoted scalars chosen to round-trip exactly. No trailing newline (the
 * splice replaces a value range, not a whole line).
 */
export function serializeValue(value: JsonValue): string {
  return stringify(value, { collectionStyle: 'flow', lineWidth: 0 }).replace(/\n+$/, '');
}

function assertJsonValue(value: unknown, input: string): void {
  if (value === null) return;
  const t = typeof value;
  if (t === 'string' || t === 'number' || t === 'boolean') return;
  if (Array.isArray(value)) {
    for (const item of value) assertJsonValue(item, input);
    return;
  }
  if (t === 'object' && !(value instanceof Date)) {
    for (const item of Object.values(value as Record<string, unknown>)) assertJsonValue(item, input);
    return;
  }
  throw new UsageError(`value ${JSON.stringify(input)} is not representable as JSON`);
}
