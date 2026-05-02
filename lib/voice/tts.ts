import { Buffer } from 'node:buffer'
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js'
import { getEnv } from '@/lib/env'

let cached: ElevenLabsClient | null = null

function client(): ElevenLabsClient {
  if (cached) return cached
  const env = getEnv()
  if (!env.ELEVENLABS_API_KEY) {
    throw new Error('ELEVENLABS_API_KEY is required for text-to-speech')
  }
  cached = new ElevenLabsClient({ apiKey: env.ELEVENLABS_API_KEY })
  return cached
}

/**
 * Synthesize a short reply using the configured voice.
 * Returns an MP3 buffer (44.1kHz / 128kbps).
 */
export async function synthesize(text: string): Promise<Buffer> {
  const env = getEnv()
  const stream = await client().textToSpeech.convert(env.ELEVENLABS_VOICE_ID, {
    text,
    modelId: 'eleven_turbo_v2_5',
    outputFormat: 'mp3_44100_128',
  })
  const reader = (stream as ReadableStream<Uint8Array>).getReader()
  const chunks: Uint8Array[] = []
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    if (value) chunks.push(value)
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c)))
}
