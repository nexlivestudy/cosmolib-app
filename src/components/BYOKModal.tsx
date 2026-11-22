import React, { useState } from 'react';
import { KeyRound, ShieldCheck, X } from 'lucide-react';
import type { BYOKConfig, BYOKProvider } from '../types';

interface BYOKModalProps {
  open: boolean;
  config: BYOKConfig;
  onSave: (next: BYOKConfig) => void;
  onClose: () => void;
}

const PROVIDERS: { id: BYOKProvider; label: string; subtitle: string; defaultModel: string }[] = [
  {
    id: 'default',
    label: 'NEXLIVE Built-in Engine',
    subtitle: 'Zero-config server-side Gemini 2.5 Flash (recommended)',
    defaultModel: 'gemini-2.5-flash',
  },
  {
    id: 'gemini',
    label: 'Google AI Studio (BYOK)',
    subtitle: 'Use your own personal Google AI Studio key for unlimited usage',
    defaultModel: 'gemini-2.5-flash',
  },
  {
    id: 'groq',
    label: 'Groq (BYOK)',
    subtitle: 'Fast open-model inference via Groq Cloud free tier',
    defaultModel: 'llama-3.3-70b-versatile',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter (BYOK)',
    subtitle: 'Route to any OpenRouter free or custom study model',
    defaultModel: 'google/gemini-2.5-flash',
  },
];

export const BYOKModal: React.FC<BYOKModalProps> = ({ open, config, onSave, onClose }) => {
  const [provider, setProvider] = useState<BYOKProvider>(config.provider);
  const [apiKey, setApiKey] = useState(config.apiKey);
  const [modelOverride, setModelOverride] = useState(config.modelOverride || '');

  if (!open) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      provider,
      apiKey: provider === 'default' ? '' : apiKey.trim(),
      modelOverride: provider === 'default' ? '' : modelOverride.trim(),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="byok-modal-title"
        className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-[#111827]"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="byok-modal-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Student Free Pass (BYOK)
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              NEXLIVE runs on the built-in server AI engine by default. Optionally plug in your own free personal key for unlimited usage.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Student Free Pass settings"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="mt-5 space-y-4">
          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              AI Inference Provider
            </legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {PROVIDERS.map((p) => {
                const active = provider === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setProvider(p.id)}
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      active
                        ? 'border-cyan-500 bg-cyan-500/10 text-slate-900 dark:text-slate-100'
                        : 'border-slate-200 bg-slate-50/70 text-slate-700 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="text-sm font-semibold">{p.label}</div>
                    <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{p.subtitle}</div>
                  </button>
                );
              })}
            </div>
          </fieldset>

          {provider !== 'default' && (
            <div className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
              <div>
                <label
                  htmlFor="byok-key-input"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Personal API Key ({provider.toUpperCase()})
                </label>
                <div className="relative mt-1.5">
                  <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="byok-key-input"
                    type="password"
                    autoComplete="off"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Paste your personal provider key"
                    className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="byok-model-input"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Model Override (Optional)
                </label>
                <input
                  id="byok-model-input"
                  type="text"
                  value={modelOverride}
                  onChange={(e) => setModelOverride(e.target.value)}
                  placeholder={PROVIDERS.find((p) => p.id === provider)?.defaultModel}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>

              <div className="flex items-start gap-2 rounded-lg bg-slate-100 p-3 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-400">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-cyan-600 dark:text-cyan-400" />
                <span>
                  Your optional key stays in your browser and is proxied directly to the selected provider endpoint without ever being logged or stored on our server.
                </span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              Save Engine Settings
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
