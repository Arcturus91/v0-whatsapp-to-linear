#!/usr/bin/env node
// /api/test/send auth+rate-limit smoke. Two parts:
//
//   A. Pure-function tests for the prod auth gate. Compiles
//      lib/safety/test-endpoint-auth.ts standalone (no Redis / Next /
//      bot deps) and exercises `gateProdAuth` for three cases:
//        - prod + no secret           → deny / 404
//        - prod + wrong bearer        → deny / 401
//        - prod + correct bearer      → allow
//
//   B. Dev rate-limit live test. Probes localhost:3000 and fires 6
//      POSTs at /api/test/send with a synthetic X-Forwarded-For IP so
//      we have a fresh rate-limit bucket. Asserts the 6th returns 429.
//      Skips with non-zero exit if the dev server isn't reachable.
//
// Coverage parity with the spec for #12: 3 prod + 1 dev = 4 cases.
// These graduate into vitest tests when we hit Phase 3 #C.

import { execFileSync } from 'node:child_process'
import { existsSync, rmSync, writeFileSync } from 'node:fs'
import { pathToFileURL, fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const tmpDir = path.join(repoRoot, '.smoke-tmp-auth')

const SECRET = 'correct-horse-battery-staple'
const SYNTH_IP = '203.0.113.42' // RFC 5737 TEST-NET-3, won't collide with real traffic
const DEV_BASE = 'http://localhost:3000'

let failed = false

// ── Part A: pure-function tests ───────────────────────────────────────

if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true })

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
      'lib/safety/test-endpoint-auth.ts',
    ],
    { cwd: repoRoot, stdio: 'inherit' },
  )
  writeFileSync(path.join(tmpDir, 'package.json'), '{"type":"module"}\n')

  const modPath = path.join(tmpDir, 'safety', 'test-endpoint-auth.js')
  const { gateProdAuth } = await import(pathToFileURL(modPath).href)

  const cases = [
    {
      name: 'prod + no secret → 404',
      input: { authHeader: null, secret: undefined },
      expect: { kind: 'deny', status: 404 },
    },
    {
      name: 'prod + wrong bearer → 401',
      input: { authHeader: 'Bearer nope', secret: SECRET },
      expect: { kind: 'deny', status: 401 },
    },
    {
      name: 'prod + missing bearer (secret set) → 401',
      input: { authHeader: null, secret: SECRET },
      expect: { kind: 'deny', status: 401 },
    },
    {
      name: 'prod + correct bearer → allow',
      input: { authHeader: `Bearer ${SECRET}`, secret: SECRET },
      expect: { kind: 'allow' },
    },
  ]

  for (const c of cases) {
    const got = gateProdAuth(c.input)
    const ok =
      got.kind === c.expect.kind &&
      (c.expect.kind === 'deny' ? got.status === c.expect.status : true)
    if (ok) {
      console.log(`OK  prod  | ${c.name}`)
    } else {
      console.error(`FAIL prod  | ${c.name}`)
      console.error('  expected:', JSON.stringify(c.expect))
      console.error('  got     :', JSON.stringify(got))
      failed = true
    }
  }
} finally {
  if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true })
}

// ── Part B: live dev rate-limit ───────────────────────────────────────

let serverUp = false
try {
  const probe = await fetch(`${DEV_BASE}/api/health`, {
    signal: AbortSignal.timeout(2000),
  })
  serverUp = probe.ok || probe.status === 500 // env-fail counts as "up"
} catch {
  serverUp = false
}

if (!serverUp) {
  console.error(
    `SKIP dev   | dev server not reachable at ${DEV_BASE}. Start \`pnpm dev\` and re-run.`,
  )
  failed = true
} else {
  // Use ?probe=1 so each request exercises the gate + rate-limit but
  // SKIPS the bot dispatch — no AI Gateway tokens, no Linear MCP calls,
  // no ElevenLabs chars, no Chat SDK lock contention. We're only
  // testing the rate-limit branch here; the dispatch path is exercised
  // manually via `curl /api/test/send` without the probe param.
  const statuses = []
  for (let i = 1; i <= 6; i++) {
    const res = await fetch(`${DEV_BASE}/api/test/send?probe=1`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': SYNTH_IP,
      },
      body: JSON.stringify({}),
    })
    statuses.push(res.status)
    await res.text().catch(() => '')
  }
  const sixth = statuses[5]
  if (sixth === 429) {
    console.log(`OK  dev   | 6th probe from ${SYNTH_IP} got 429 (sequence: ${statuses.join(',')})`)
  } else {
    console.error(
      `FAIL dev  | expected 6th probe to be 429, got ${sixth} (sequence: ${statuses.join(',')})`,
    )
    failed = true
  }
}

if (failed) process.exit(1)
console.log('OK: all 4 cases pass')
