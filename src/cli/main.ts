#!/usr/bin/env node
import { Command, CommanderError } from 'commander';
import { registerSet } from './commands/set.js';
import { registerLint } from './commands/lint.js';

const program = new Command();
program
  .name('fmctl')
  .description('Schema-governed frontmatter management for Markdown files')
  .version('0.1.0')
  .exitOverride();

registerSet(program);
registerLint(program);

try {
  await program.parseAsync(process.argv);
} catch (err) {
  // Command handlers set process.exitCode themselves; reaching here means a
  // commander-level usage problem (or help/version output).
  if (err instanceof CommanderError) {
    if (err.code === 'commander.helpDisplayed' || err.code === 'commander.version' || err.code === 'commander.help') {
      process.exitCode = 0;
    } else {
      process.exitCode = 2; // usage error
    }
  } else {
    process.stderr.write(`error: ${(err as Error).message}\n`);
    process.exitCode = 1;
  }
}
