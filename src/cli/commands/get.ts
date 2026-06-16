import type { Command } from 'commander';
import { getField, getFrontmatter } from '../../lib/index.js';
import { printGetResult, printFrontmatter, fail } from '../output.js';
import { setExit } from '../exit.js';

export function registerGet(program: Command): void {
  program
    .command('get')
    .description('Read one top-level frontmatter field, or the whole block')
    .argument('<file>', 'Markdown file to read')
    .argument('[field]', 'top-level field name; omit to read the whole frontmatter')
    .option('--json', 'machine-readable output')
    .option('--schema <path>', 'accepted for symmetry; reads never validate')
    .action(async (file: string, field: string | undefined, opts: GetCliOptions) => {
      const json = opts.json === true;
      try {
        if (field === undefined) {
          printFrontmatter(await getFrontmatter(file), json);
        } else {
          printGetResult(await getField(file, field), json);
        }
        setExit(0);
      } catch (err) {
        setExit(fail(err, json));
      }
    });
}

interface GetCliOptions {
  json?: boolean;
  schema?: string;
}
