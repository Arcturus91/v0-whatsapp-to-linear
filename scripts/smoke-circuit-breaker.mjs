#!/usr/bin/env node
// Circuit-breaker unit smoke. Compiles lib/safety/circuit-breaker.ts
// standalone and exercises the trip/cooldown state machine via the
// injected clock. No Redis, no Next, no rate-limit module — keeps the
// scope tight to the breaker's pure logic.
//
// Will migrate to vitest in Phase 3 #C. The cases here are the
// proto-test names: same boundaries, same assertions.

import { execFileSync } from 'node:child_process'
import { existsSync, rmSync, writeFileSync } from 'node:fs'
import { pathToFileURL, fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const tmpDir = path.join(repoRoot, '.smoke-tmp-breaker')

if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true })

let failed = false
const cases = []
function assert(name, cond, detail) {
  cases.push({ name, ok: !!cond, detail })
  if (!cond) failed = true
}

try {
  execFileSync(
    'pnpm',
    [
      'exec',
      'tsc',
      '--outDir',
      tmpDir,
      '--module',
      'esnext',
      '--moduleResolution',
      'node',
      '--target',
      'es2022',
      '--esModuleInterop',
      '--skipLibCheck',
      '--noEmit',
      'false',
      '--rootDir',
      'lib',
      'lib/safety/circuit-breaker.ts',
    ],
    { cwd: repoRoot, stdio: 'inherit' },
  )
  writeFileSync(path.join(tmpDir, 'package.json'), '{"type":"module"}\n')

  const modPath = path.join(tmpDir, 'safety', 'circuit-breaker.js')
  const breaker = await import(pathToFileURL(modPath).href)

  let now = 1_000_000
  breaker.setClockForTesting(() => now)

  // Case 1: 10 failures in window → still closed.
  breaker.resetBreakerForTesting()
  for (let i = 0; i < 10; i++) breaker.recordRedisFailure()
  assert('10 failures → breaker stays closed', !breaker.isBreakerOpen())

  // Case 2: 11th failure → trip + onTrip fires once.
  breaker.resetBreakerForTesting()
  let tripCount = 0
  for (let i = 0; i < 11; i++) breaker.recordRedisFailure(() => tripCount++)
  assert('11th failure → breaker opens', breaker.isBreakerOpen())
  assert('onTrip fires exactly once on open', tripCount === 1, `got ${tripCount}`)

  // Case 3: additional failures while open → onTrip stays at 1.
  breaker.recordRedisFailure(() => tripCount++)
  breaker.recordRedisFailure(() => tripCount++)
  assert('onTrip stays at 1 across extra failures in open window', tripCount === 1, `got ${tripCount}`)

  // Case 4: advance clock past cooldown → closed again.
  now += 61_000
  assert('after 61s cooldown → breaker reports closed', !breaker.isBreakerOpen())

  // Case 5: one failure after cooldown → does NOT immediately re-trip
  // (sliding window drops stale entries).
  breaker.recordRedisFailure(() => tripCount++)
  assert('one failure post-cooldown → stays closed', !breaker.isBreakerOpen())
  assert('onTrip not refired by single late failure', tripCount === 1)

  // Case 6: 11 failures spread evenly over 61s → never trips (window correctness).
  breaker.resetBreakerForTesting()
  now = 2_000_000
  let tripCount2 = 0
  for (let i = 0; i < 11; i++) {
    breaker.recordRedisFailure(() => tripCount2++)
    now += 6_500 // 11 * 6.5s = 71.5s, never 11-in-60s
  }
  assert('11 failures over 71s → does NOT trip (sliding window)', !breaker.isBreakerOpen())
  assert('onTrip not fired across spread-out failures', tripCount2 === 0)

  // Case 7: snapshot reports failuresInWindow + openForSeconds.
  breaker.resetBreakerForTesting()
  now = 3_000_000
  for (let i = 0; i < 11; i++) breaker.recordRedisFailure()
  const snap = breaker.getBreakerSnapshot()
  assert('snapshot: open after 11 failures', snap.open)
  assert('snapshot: failuresInWindow >= 11', snap.failuresInWindow >= 11, `got ${snap.failuresInWindow}`)
  assert('snapshot: openForSeconds ~ 60', snap.openForSeconds > 0 && snap.openForSeconds <= 60, `got ${snap.openForSeconds}`)
} finally {
  if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true })
}

for (const c of cases) {
  const tag = c.ok ? 'OK  ' : 'FAIL'
  const detail = c.detail ? `  (${c.detail})` : ''
  console.log(`${tag}  ${c.name}${detail}`)
}
if (failed) process.exit(1)
console.log(`\nOK: all ${cases.length} cases pass`)
