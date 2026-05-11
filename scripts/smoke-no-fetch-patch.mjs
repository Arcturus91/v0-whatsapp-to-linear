#!/usr/bin/env node
// Static smoke check: ensure no source file under lib/ or app/ mutates
// globalThis.fetch or references the deleted patchFetchForKapso helper.
//
// Rationale: a runtime "import the module twice and check fetch" check
// would need a TS-aware runner (tsx / --experimental-strip-types) or to
// load Next.js's bundled build output — both flaky to wire up without
// adding a dependency. Static grep is sufficient for the regression we
// care about: there is exactly one way to globally rewrite fetch, and
// it's lexically detectable.

import { execFileSync } from 'node:child_process'

const FORBIDDEN_PATTERNS = [
  // Direct assignment to globalThis.fetch / global.fetch.
  String.raw`globalThis\.fetch\s*=`,
  String.raw`global\.fetch\s*=`,
  // Lingering references to the deleted helper.
  String.raw`patchFetchForKapso`,
  String.raw`fetchPatched`,
]

const SEARCH_PATHS = ['lib', 'app']

let failed = false
for (const pattern of FORBIDDEN_PATTERNS) {
  let stdout = ''
  try {
    stdout = execFileSync(
      'git',
      ['grep', '-nE', pattern, '--', ...SEARCH_PATHS],
      { encoding: 'utf8' },
    )
  } catch (err) {
    // `git grep` exits 1 when there are no matches — that's success.
    if (err && typeof err === 'object' && 'status' in err && err.status === 1) continue
    console.error(`smoke check error for /${pattern}/:`, err)
    failed = true
    continue
  }
  if (stdout.trim()) {
    console.error(`FAIL: forbidden pattern /${pattern}/ found:\n${stdout}`)
    failed = true
  }
}

if (failed) process.exit(1)
console.log('OK: no globalThis.fetch mutation or patchFetchForKapso reference in lib/ or app/')
