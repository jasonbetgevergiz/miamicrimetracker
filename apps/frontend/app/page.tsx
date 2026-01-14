import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Miami Crime & Incident Monitor
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
            Real-time monitoring dashboard for Miami crime incidents and public transit
          </p>

          <div className="grid md:grid-cols-2 gap-6 mt-12">
            <Link
              href="/docs"
              className="block p-8 bg-white dark:bg-slate-800 rounded-lg shadow-lg hover:shadow-xl transition-shadow"
            >
              <h2 className="text-2xl font-bold mb-3 text-blue-600 dark:text-blue-400">
                📚 API Documentation
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                Comprehensive documentation for all REST and WebSocket APIs
              </p>
            </Link>

            <Link
              href="/dashboard"
              className="block p-8 bg-white dark:bg-slate-800 rounded-lg shadow-lg hover:shadow-xl transition-shadow"
            >
              <h2 className="text-2xl font-bold mb-3 text-purple-600 dark:text-purple-400">
                📊 Dashboard
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                View real-time incident data and transit locations
              </p>
            </Link>
          </div>

          <div className="mt-12 p-6 bg-blue-50 dark:bg-slate-700 rounded-lg">
            <h3 className="text-lg font-semibold mb-2 text-blue-900 dark:text-blue-100">
              Features
            </h3>
            <ul className="text-left inline-block text-gray-700 dark:text-gray-200 space-y-2">
              <li>✓ Real-time incident tracking (auto-refresh every 30s)</li>
              <li>✓ Status indicators (GREEN/YELLOW/RED)</li>
              <li>✓ Keyword search and filtering</li>
              <li>✓ Timeline view (24h, 7d)</li>
              <li>✓ Dashboard statistics and analytics</li>
              <li>✓ Live Miami public transit tracking</li>
              <li>✓ WebSocket for real-time updates</li>
            </ul>
          </div>
        </div>
      </div>
    </main>
  );
}
