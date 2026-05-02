import { StatusCard } from '@/components/status-card';

export const metadata = {
  title: 'LinearVoice',
  description: 'WhatsApp to Linear AI agent with voice support',
};

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-6xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">LinearVoice</h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            An intelligent WhatsApp agent powered by AI and Linear integration. Create issues, manage your project, and interact using voice — all from WhatsApp.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Features</h2>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <span className="text-blue-500 font-bold">✓</span>
                <span className="text-gray-700">Chat with Linear issues directly from WhatsApp</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-blue-500 font-bold">✓</span>
                <span className="text-gray-700">Create and manage issues with natural language</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-blue-500 font-bold">✓</span>
                <span className="text-gray-700">Voice support with transcription and synthesis</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-blue-500 font-bold">✓</span>
                <span className="text-gray-700">Real-time event streaming with Redis</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-blue-500 font-bold">✓</span>
                <span className="text-gray-700">Context-aware conversations with state management</span>
              </li>
            </ul>
          </div>

          <div>
            <StatusCard />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Start</h2>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">1. Configure Environment</h3>
              <p className="text-gray-600 text-sm mb-2">
                Copy <code className="font-mono bg-gray-100 px-2 py-1 rounded">.env.example</code> to{' '}
                <code className="font-mono bg-gray-100 px-2 py-1 rounded">.env.local</code> and fill in your keys:
              </p>
              <ul className="text-gray-600 text-sm space-y-1 ml-4">
                <li>• Kapso WhatsApp API credentials</li>
                <li>• Linear API key and workspace ID</li>
                <li>• Upstash Redis URL and token</li>
                <li>• ElevenLabs API key (optional)</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 mb-2">2. Set Up Webhook</h3>
              <p className="text-gray-600 text-sm">
                Configure your Kapso WhatsApp integration to send messages to:{' '}
                <code className="font-mono bg-gray-100 px-2 py-1 rounded">
                  {typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com'}/api/whatsapp
                </code>
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 mb-2">3. Start Chatting</h3>
              <p className="text-gray-600 text-sm">
                Send a message to your WhatsApp bot number and start managing Linear issues!
              </p>
            </div>
          </div>
        </div>

        <div className="mt-12 text-center text-gray-600 text-sm">
          <p>
            LinearVoice is built with Next.js, AI SDK 6, Upstash Redis, and Linear MCP integration.
          </p>
        </div>
      </div>
    </main>
  );
}
