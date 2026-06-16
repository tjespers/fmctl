// A pending exit code set by command handlers and collected by `run()`. Keeping
// it out of the global `process.exitCode` lets the CLI run in-process (tests)
// without leaking an exit code into the host process.
let pending = 0;

export function setExit(code: number): void {
  pending = code;
}

export function takeExit(): number {
  const code = pending;
  pending = 0;
  return code;
}
