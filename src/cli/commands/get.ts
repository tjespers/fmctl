import type { Command } from 'commander';
import { getField } from '../../lib/index.js';
import { printGetResult, fail } from '../output.js';

export function registerGet(program: Command): void {
  program
    .command('get')
    .description('Read one top-level frontmatter field')
    .argument('<file>', 'Markdown file to read')
    .argument('<field>', 'top-level field name')
    .option('--json', 'machine-readable output')
    .option('--schema <path>', 'accepted for symmetry; reads never validate')
    .action(async (file: string, field: string, opts: GetCliOptions) => {
      const json = opts.json === true;
      try {
        const result = await getField(file, field);
        printGetResult(result, json);
        process.exitCode = 0;
      } catch (err) {
        process.exitCode = fail(err, json);
      }
    });
}

interface GetCliOptions {
  json?: boolean;
  schema?: string;
}
