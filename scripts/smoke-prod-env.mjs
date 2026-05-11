#!/usr/bin/env node
// Production env-schema regression check.
//
// Asserts that the zod schema in `lib/env.ts` rejects a production
// environment without `REDIS_URL`, with an error message that names
// `REDIS_URL`. This is the load-bearing behavior of #5: without it,
// a missing REDIS_URL silently degrades the bot to per-instance memory
// state in production.
//
// The script compiles `lib/env.ts` standalone to a temp dir (this repo
// has no TS-aware Node runner installed), then imports the schema and
// runs `safeParse` against a synthesized prod env.

import { execFileSync } from 'node:child_process'
import { existsSync, rmSync, writeFileSync } from 'node:fs'
import { pathToFileURL, fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const tmpDir = path.join(repoRoot, '.smoke-tmp')

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
      'lib/env.ts',
    ],
    { cwd: repoRoot, stdio: 'inherit' },
  )

  // Mark the temp dir as ESM so dynamic import treats env.js as a module.
  writeFileSync(path.join(tmpDir, 'package.json'), '{"type":"module"}\n')

  const envJsPath = path.join(tmpDir, 'env.js')
  const { envSchema } = await import(pathToFileURL(envJsPath).href)

  const prodEnvSansRedis = {
    NODE_ENV: 'production',
    KV_REST_API_URL: 'https://example.upstash.io',
    KV_REST_API_TOKEN: 'token',
    KAPSO_API_KEY: 'test',
    KAPSO_WEBHOOK_SECRET: 'test',
    KAPSO_PHONE_NUMBER_ID: 'test',
    // REDIS_URL intentionally absent.
  }

  const result = envSchema.safeParse(prodEnvSansRedis)
  if (result.success) {
    console.error('FAIL: schema should have rejected prod env without REDIS_URL')
    process.exit(1)
  }
  const issue = result.error.issues.find(
    (i) => i.path?.includes('REDIS_URL') && i.message?.includes('REDIS_URL'),
  )
  if (!issue) {
    console.error(
      'FAIL: refinement did not produce an issue naming REDIS_URL. Issues:',
    )
    console.error(JSON.stringify(result.error.issues, null, 2))
    process.exit(1)
  }
  console.log('OK: prod env without REDIS_URL rejected with REDIS_URL message')
} finally {
  if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true })
}
