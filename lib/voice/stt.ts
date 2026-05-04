import { Buffer } from 'node:buffer'
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js'
import { getEnv } from '@/lib/env'

let cached: ElevenLabsClient | null = null

function client(): ElevenLabsClient {
  if (cached) return cached
  const env = getEnv()
  if (!env.ELEVENLABS_API_KEY) {
    throw new Error('ELEVENLABS_API_KEY is required for speech-to-text')
  }
  cached = new ElevenLabsClient({ apiKey: env.ELEVENLABS_API_KEY })
  return cached
}

/**
 * Transcribe an audio buffer using ElevenLabs Scribe.
 */
export async function transcribe(buffer: Buffer, mimeType: string): Promise<string> {
  const blob = new Blob([new Uint8Array(buffer)], { type: mimeType || 'audio/ogg' })
  const res = await client().speechToText.convert({
    file: blob,
    modelId: 'scribe_v1',
  })
  return (res as { text?: string }).text ?? ''
}
