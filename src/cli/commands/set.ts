import type { Command } from 'commander';
import { setFields, parseValue, UsageError } from '../../lib/index.js';
import type { JsonValue } from '../../lib/index.js';
import { printSetResult, unvalidatedNotice, fail } from '../output.js';

export function registerSet(program: Command): void {
  program
    .command('set')
    .description('Surgically update or create frontmatter fields (validated by default)')
    .argument('<file>', 'Markdown file to edit')
    .argument('<assignments...>', 'one or more field=value pairs')
    .option('--json', 'machine-readable output')
    .option('--schema <path>', 'schema override (absolute or cwd-relative path)')
    .option('--no-validate', 'bypass schema validation only (integrity guarantees still apply)')
    .action(async (file: string, assignments: string[], opts: SetCliOptions) => {
      const json = opts.json === true;
      try {
        const changes = parseAssignments(assignments);
        const result = await setFields(file, changes, {
          schema: opts.schema,
          bypassValidation: opts.validate === false,
        });
        printSetResult(result, json);
        if (!result.validated && !result.bypassed) unvalidatedNotice(result.file);
        process.exitCode = 0;
      } catch (err) {
        process.exitCode = fail(err, json);
      }
    });
}

interface SetCliOptions {
  json?: boolean;
  schema?: string;
  validate?: boolean; // false when --no-validate is passed
}

function parseAssignments(assignments: string[]): Record<string, JsonValue> {
  const changes: Record<string, JsonValue> = {};
  for (const assignment of assignments) {
    const eq = assignment.indexOf('=');
    if (eq <= 0) {
      throw new UsageError(`invalid assignment "${assignment}" (expected field=value)`);
    }
    const field = assignment.slice(0, eq);
    changes[field] = parseValue(assignment.slice(eq + 1));
  }
  return changes;
}
