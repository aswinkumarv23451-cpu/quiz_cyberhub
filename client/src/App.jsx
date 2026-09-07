import { useState, useEffect } from 'react';
import { checkHealth } from './services/healthService';

function App() {
  const [healthStatus, setHealthStatus] = useState({
    loading: true,
    data: null,
    error: null,
  });

  useEffect(() => {
    checkHealth()
      .then((data) => {
        setHealthStatus({ loading: false, data, error: null });
      })
      .catch((error) => {
        setHealthStatus({ loading: false, data: null, error: error.message });
      });
  }, []);

  return (
    <main class="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-950 text-slate-100 font-sans">
      <div class="max-w-md w-full text-center space-y-6 bg-slate-900/60 p-8 rounded-xl border border-slate-800 shadow-xl">
        <div class="space-y-2">
          <h1 class="text-4xl font-extrabold tracking-tight text-indigo-400">
            Round 1
          </h1>
          <h2 class="text-xl font-medium text-slate-300">
            Technology Competition
          </h2>
        </div>

        <div class="py-2 border-t border-b border-slate-800/80">
          <p class="text-sm font-semibold text-emerald-400">
            System foundation ready.
          </p>
        </div>

        <div class="text-xs text-slate-400 bg-slate-950/50 p-3 rounded border border-slate-800/50">
          <p class="font-medium mb-1">Backend API Status:</p>
          {healthStatus.loading && (
            <span class="text-amber-400">Checking API status...</span>
          )}
          {healthStatus.error && (
            <span class="text-rose-400">Error connecting to server: {healthStatus.error}</span>
          )}
          {healthStatus.data && (
            <span class="text-emerald-400 font-mono">
              {healthStatus.data.message || JSON.stringify(healthStatus.data)}
            </span>
          )}
        </div>
      </div>
    </main>
  );
}

export default App;
