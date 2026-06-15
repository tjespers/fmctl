import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CLI_DIR = join(ROOT, 'src', 'cli');

function tsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...tsFiles(full));
    else if (entry.endsWith('.ts')) out.push(full);
  }
  return out;
}

const IMPORT_RE = /(?:import|export)\b[^'"]*?\bfrom\s*['"]([^'"]+)['"]/g;

describe('architecture guard: CLI consumes the library only via its public barrel', () => {
  const files = tsFiles(CLI_DIR);

  it('discovers CLI sources', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    it(`${relative(ROOT, file)} imports lib only through lib/index`, () => {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(IMPORT_RE)) {
        const spec = match[1]!;
        if (spec.includes('/lib/') || spec.endsWith('/lib')) {
          // Any reference into the library must be the public barrel (Principle VII).
          expect(spec).toMatch(/(^|\/)lib\/index\.js$/);
        }
      }
    });
  }
});
