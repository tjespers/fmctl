import { readFile, readdir, stat } from 'node:fs/promises';
import { join, relative, resolve as resolvePath, sep } from 'node:path';
import ignore from 'ignore';
import type { Ignore } from 'ignore';
import { FrontmatterDocument } from './document.js';
import { resolveSchema } from './resolve.js';
import { compileSchema } from './validate.js';
import type { CompiledSchema } from './validate.js';
import { FileNotFoundError, FmctlError, IoError, NoFrontmatterError } from './errors.js';
import type { FileLintResult, LintResult, LintSummary } from './types.js';

export interface LintOptions {
  /** Override applied to every file (absolute or cwd-relative path). */
  schema?: string;
}

/**
 * Walk Markdown files under the given paths and validate each against its
 * resolved schema (FR-011–FR-013). Directory walking honors `.gitignore` files
 * within the tree and always skips `.git`; explicitly named files are linted
 * directly (ignore rules never apply to them). Per-file faults are isolated —
 * this function only throws for setup-level failures (bad root path, unusable
 * override schema).
 */
export async function lintPaths(paths: string[], options: LintOptions = {}): Promise<LintResult> {
  const roots = paths.length > 0 ? paths : ['.'];
  const files = await discover(roots);

  const cache = new Map<string, CompiledSchema>();
  if (options.schema !== undefined) {
    // Fail fast: an unusable override is a setup error, not a per-file one.
    const override = await resolveSchema('', { schema: options.schema });
    cache.set(override!.location, await compileSchema(override!.location));
  }

  const results: FileLintResult[] = [];
  for (const file of files) {
    results.push(await lintFile(file, options, cache));
  }
  return { files: results, summary: summarize(results) };
}

async function lintFile(
  file: string,
  options: LintOptions,
  cache: Map<string, CompiledSchema>,
): Promise<FileLintResult> {
  const governedBy = await resolveSchema(
    file,
    options.schema !== undefined ? { schema: options.schema } : {},
  );

  let doc: FrontmatterDocument;
  try {
    doc = await FrontmatterDocument.load(file);
  } catch (err) {
    if (err instanceof NoFrontmatterError) {
      return { file, status: 'skipped-no-frontmatter', governedBy, violations: [], error: null };
    }
    if (err instanceof FmctlError) {
      return { file, status: 'error', governedBy, violations: [], error: { code: err.code, message: err.message } };
    }
    throw err;
  }

  if (!governedBy) {
    return { file, status: 'ungoverned', governedBy: null, violations: [], error: null };
  }

  let schema = cache.get(governedBy.location);
  if (!schema) {
    try {
      schema = await compileSchema(governedBy.location);
      cache.set(governedBy.location, schema);
    } catch (err) {
      const e = err as FmctlError;
      return { file, status: 'error', governedBy, violations: [], error: { code: e.code, message: e.message } };
    }
  }

  const violations = schema.validate(doc.data);
  return {
    file,
    status: violations.length > 0 ? 'invalid' : 'valid',
    governedBy,
    violations,
    error: null,
  };
}

/** Resolve roots to a deduped, ordered list of Markdown files to lint. */
async function discover(roots: string[]): Promise<string[]> {
  const found = new Set<string>();
  for (const root of roots) {
    const abs = resolvePath(process.cwd(), root);
    let info;
    try {
      info = await stat(abs);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') throw new FileNotFoundError(`path not found: ${root}`, { file: abs, cause: err });
      throw new IoError(`cannot stat ${root}: ${(err as Error).message}`, { file: abs, cause: err });
    }
    if (info.isDirectory()) {
      await walk(abs, [], found);
    } else {
      // explicit file argument: linted directly, ignore rules never apply
      found.add(abs);
    }
  }
  return [...found].sort();
}

interface Matcher {
  base: string;
  ig: Ignore;
}

async function walk(dir: string, matchers: Matcher[], out: Set<string>): Promise<void> {
  const local = [...matchers];
  const gitignore = await readGitignore(join(dir, '.gitignore'));
  if (gitignore) local.push({ base: dir, ig: ignore().add(gitignore) });

  const entries = (await readdir(dir, { withFileTypes: true })).sort((a, b) => (a.name < b.name ? -1 : 1));
  for (const entry of entries) {
    if (entry.name === '.git') continue; // always skipped; no other built-in ignores
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!isIgnored(full, true, local)) await walk(full, local, out);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      if (!isIgnored(full, false, local)) out.add(full);
    }
  }
}

function isIgnored(path: string, isDir: boolean, matchers: Matcher[]): boolean {
  let ignored = false;
  for (const matcher of matchers) {
    const rel = relative(matcher.base, path);
    if (rel === '' || rel.startsWith('..')) continue;
    const candidate = rel.split(sep).join('/') + (isDir ? '/' : '');
    const verdict = matcher.ig.test(candidate);
    if (verdict.ignored) ignored = true;
    if (verdict.unignored) ignored = false; // deeper negation re-includes
  }
  return ignored;
}

async function readGitignore(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return null;
  }
}

function summarize(files: FileLintResult[]): LintSummary {
  const summary: LintSummary = { checked: 0, valid: 0, invalid: 0, ungoverned: 0, skipped: 0, errored: 0 };
  for (const file of files) {
    switch (file.status) {
      case 'valid':
        summary.valid++;
        summary.checked++;
        break;
      case 'invalid':
        summary.invalid++;
        summary.checked++;
        break;
      case 'ungoverned':
        summary.ungoverned++;
        break;
      case 'skipped-no-frontmatter':
        summary.skipped++;
        break;
      case 'error':
        summary.errored++;
        break;
    }
  }
  return summary;
}
