'use client';

export function StatusCard() {
  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-lg border border-gray-200">
      <div className="flex items-start justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900">LinearVoice Status</h2>
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
          </span>
          <span className="text-xs font-semibold text-green-600">Active</span>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">WhatsApp</span>
          <span className="font-medium text-gray-900">Connected</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Linear API</span>
          <span className="font-medium text-gray-900">Ready</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Voice Engine</span>
          <span className="font-medium text-gray-900">Idle</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Event Stream</span>
          <span className="font-medium text-gray-900">Running</span>
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-500 text-center">
          Webhook: <code className="font-mono bg-gray-100 px-2 py-1 rounded text-xs">/api/whatsapp</code>
        </p>
      </div>
    </div>
  );
}
