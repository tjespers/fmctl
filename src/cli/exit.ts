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
