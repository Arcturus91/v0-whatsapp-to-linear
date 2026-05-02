'use client';

import { useState, useEffect } from 'react';

interface Metric {
  name: string;
  value: number | string;
}

interface DashboardMetrics {
  totalEvents: number;
  eventTypes: Record<string, number>;
}

export function Dashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadMetrics() {
      try {
        const res = await fetch('/api/metrics');
        if (res.ok) {
          const data = await res.json();
          setMetrics(data);
        }
      } catch (error) {
        console.error('[v0] Failed to load metrics:', error);
      } finally {
        setLoading(false);
      }
    }

    loadMetrics();
    const interval = setInterval(loadMetrics, 5000);
    return () => clearInterval(interval);
  }, []);

  const eventMetrics: Metric[] = metrics
    ? Object.entries(metrics.eventTypes).map(([type, count]) => ({
        name: type,
        value: count,
      }))
    : [];

  return (
    <div className="w-full max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">LinearVoice Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Total Events Card */}
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">
            Total Events
          </h2>
          <p className="text-4xl font-bold text-gray-900">
            {loading ? '—' : metrics?.totalEvents || 0}
          </p>
          <p className="text-xs text-gray-500 mt-2">Last 24 hours</p>
        </div>

        {/* Event Types Card */}
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-4">
            Event Types
          </h2>
          <div className="space-y-2">
            {loading ? (
              <p className="text-gray-500 text-sm">Loading...</p>
            ) : eventMetrics.length > 0 ? (
              eventMetrics.map(metric => (
                <div key={metric.name} className="flex items-center justify-between">
                  <span className="text-sm text-gray-700 capitalize">
                    {(metric.name as string).replace(/\./g, ' ')}
                  </span>
                  <span className="text-sm font-semibold text-gray-900">{metric.value}</span>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-sm">No events yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Status Indicator */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <span className="font-semibold">Webhook Ready:</span> Messages sent to{' '}
          <code className="font-mono bg-blue-100 px-2 py-1 rounded text-xs">/api/whatsapp</code>{' '}
          will be processed by LinearVoice agent.
        </p>
      </div>
    </div>
  );
}
