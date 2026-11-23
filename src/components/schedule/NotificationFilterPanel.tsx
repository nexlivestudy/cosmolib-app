import React, { useMemo, useState } from 'react';
import {
  Bell,
  BellOff,
  PhoneCall,
  RotateCcw,
  Search,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import {
  DEFAULT_FILTER_APPS,
  filterAppsByQuery,
  isCapacitorNativeRuntime,
  type AllowMap,
  type BlockedAttemptLog,
} from '../../utils/scheduleEngine';

interface NotificationFilterPanelProps {
  enabled: boolean;
  onToggleEnabled: (next: boolean) => void;
  allowMap: AllowMap;
  onToggleApp: (appId: string) => void;
  onResetDefault: () => void;
  notificationPermission: NotificationPermission | 'unsupported';
  onRequestNotificationPermission: () => void;
  attemptLogs: BlockedAttemptLog[];
  onSimulateIncoming: (appId: string) => void;
  onClearLogs: () => void;
}

export const NotificationFilterPanel: React.FC<NotificationFilterPanelProps> = ({
  enabled,
  onToggleEnabled,
  allowMap,
  onToggleApp,
  onResetDefault,
  notificationPermission,
  onRequestNotificationPermission,
  attemptLogs,
  onSimulateIncoming,
  onClearLogs,
}) => {
  const [search, setSearch] = useState('');

  const filteredApps = useMemo(
    () => filterAppsByQuery(DEFAULT_FILTER_APPS, search),
    [search]
  );

  const allowedApps = useMemo(
    () => filteredApps.filter((app) => Boolean(allowMap[app.id])),
    [filteredApps, allowMap]
  );
  const blockedApps = useMemo(
    () => filteredApps.filter((app) => !allowMap[app.id]),
    [filteredApps, allowMap]
  );

  const totalAllowed = Object.values(allowMap).filter(Boolean).length;
  const totalBlocked = DEFAULT_FILTER_APPS.length - totalAllowed;
  const nativeCap = isCapacitorNativeRuntime();

  return (
    <section
      data-testid="notification-filter"
      className="cosmo-card p-5 sm:p-6"
    >
      {/* Header Row */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
        <div>
          <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
            Notification &amp; Call Filter
          </h2>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            Default strict calls-only policy: ONLY WhatsApp Calls and Normal Phone Calls stay ON; all other apps are strictly blocked during scheduled sessions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label="Enable Notification and Call Filter"
            onClick={() => onToggleEnabled(!enabled)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500 ${
              enabled ? 'bg-cyan-500' : 'bg-slate-300 dark:bg-slate-700'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                enabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
            {enabled ? 'Filter Active' : 'Filter Paused'}
          </span>
        </div>
      </div>

      {/* Toolbar: Search + Reset Calls-Only + Web Notification Permission */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search apps or call channels..."
            aria-label="Search apps to allow or block"
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-[#0B0F19] dark:text-white"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onResetDefault}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 whitespace-nowrap dark:border-slate-700 dark:bg-[#0B0F19] dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset to Calls-Only
          </button>

          {notificationPermission !== 'unsupported' && notificationPermission !== 'granted' && (
            <button
              type="button"
              onClick={onRequestNotificationPermission}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-500 whitespace-nowrap"
            >
              <Bell className="h-3.5 w-3.5" />
              Allow Browser Notifications
            </button>
          )}
        </div>
      </div>

      {/* 2-Column Allowed vs Blocked Checklist */}
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Column 1: Allowed */}
        <div
          data-testid="filter-allowed-column"
          className="flex flex-col rounded-xl border border-emerald-500/35 bg-emerald-500/[0.04] p-3.5"
        >
          <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              <PhoneCall className="h-4 w-4" />
              <span>Allowed Through</span>
            </div>
            <span className="font-mono text-xs tabular-nums text-emerald-700 dark:text-emerald-300">
              {totalAllowed} ON
            </span>
          </div>

          <div className="mt-3 max-h-72 flex-1 space-y-2 overflow-y-auto pr-1">
            {allowedApps.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">
                No allowed apps match your filter.
              </p>
            ) : (
              allowedApps.map((app) => (
                <div
                  key={app.id}
                  data-filter-app={app.id}
                  data-filter-state="allowed"
                  className="flex items-center justify-between gap-2.5 rounded-lg border border-emerald-500/25 bg-white px-3 py-2.5 dark:bg-[#0B0F19]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-semibold text-slate-900 dark:text-white">
                      {app.name}
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">
                      {app.category} · {app.description}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => onSimulateIncoming(app.id)}
                      className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      Test
                    </button>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={true}
                      aria-label={`Block ${app.name}`}
                      onClick={() => onToggleApp(app.id)}
                      className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full bg-emerald-500 transition-colors"
                    >
                      <span className="pointer-events-none inline-block h-4 w-4 translate-x-4 translate-y-0.5 rounded-full bg-white shadow-xs transition-transform" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <p className="mt-3 border-t border-emerald-500/15 pt-2.5 text-[11px] text-slate-500 dark:text-slate-400">
            Calls-only shield active by default. Toggle any blocked app on the right to move it here.
          </p>
        </div>

        {/* Column 2: Blocked */}
        <div
          data-testid="filter-blocked-column"
          className="flex flex-col rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-[#0B0F19]/60"
        >
          <div className="flex items-center justify-between border-b border-slate-200 pb-2.5 dark:border-slate-800">
            <div className="flex items-center gap-2 text-xs font-semibold text-rose-700 dark:text-rose-400">
              <BellOff className="h-4 w-4" />
              <span>Strictly Blocked</span>
            </div>
            <span className="font-mono text-xs tabular-nums text-slate-600 dark:text-slate-400">
              {totalBlocked} OFF
            </span>
          </div>

          <div className="mt-3 max-h-72 flex-1 space-y-2 overflow-y-auto pr-1">
            {blockedApps.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">
                No blocked apps match your filter.
              </p>
            ) : (
              blockedApps.map((app) => (
                <div
                  key={app.id}
                  data-filter-app={app.id}
                  data-filter-state="blocked"
                  className="flex items-center justify-between gap-2.5 rounded-lg border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-800 dark:bg-[#111827]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-semibold text-slate-800 dark:text-slate-200">
                      {app.name}
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">
                      {app.category} · {app.description}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => onSimulateIncoming(app.id)}
                      className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      Test
                    </button>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={false}
                      aria-label={`Allow ${app.name}`}
                      onClick={() => onToggleApp(app.id)}
                      className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full bg-slate-300 transition-colors dark:bg-slate-700"
                    >
                      <span className="pointer-events-none inline-block h-4 w-4 translate-x-0.5 translate-y-0.5 rounded-full bg-white shadow-xs transition-transform" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Live Guard Activity Log */}
      <div className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-800">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
            <ShieldCheck className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
            <span>Schedule Notification Guard Log</span>
            <span className="font-mono font-normal text-slate-500 tabular-nums">
              · {attemptLogs.length} events
            </span>
          </div>
          {attemptLogs.length > 0 && (
            <button
              type="button"
              onClick={onClearLogs}
              className="text-xs font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white"
            >
              Clear Log
            </button>
          )}
        </div>

        {attemptLogs.length === 0 ? (
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Click &ldquo;Test&rdquo; next to any app above to verify web guard suppression (&ldquo;Blocked by Schedule&rdquo;) vs allowed call alerts.
          </p>
        ) : (
          <div
            data-testid="blocked-attempt-log"
            className="mt-2.5 max-h-36 space-y-1.5 overflow-y-auto pr-1"
          >
            {attemptLogs.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-800 dark:bg-[#0B0F19]"
              >
                <div className="min-w-0 truncate">
                  <span
                    className={`font-semibold ${
                      entry.outcome === 'blocked'
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    {entry.outcome === 'blocked' ? 'Blocked by Schedule' : 'Allowed Call/Alert'}
                  </span>
                  <span className="mx-1.5 text-slate-400">·</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {entry.appName}
                  </span>
                  <span className="ml-1.5 text-slate-500 dark:text-slate-400">
                    ({entry.message})
                  </span>
                </div>
                <span className="shrink-0 font-mono text-[11px] text-slate-500 tabular-nums">
                  {new Date(entry.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Honest Web + Capacitor Native Disclosure */}
      <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-600 dark:border-slate-800 dark:bg-[#0B0F19] dark:text-slate-400">
        <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-cyan-600 dark:text-cyan-400" />
        <p>
          <strong className="text-slate-900 dark:text-slate-200">
            {nativeCap ? 'Native Capacitor Guard Connected:' : 'Web Browser + Native Bridge Ready:'}
          </strong>{' '}
          In web browsers, COSMOLIB actively suppresses in-app toasts, filters Web Notification API dispatches strictly to your Allowed list, and logs every blocked event. Capacitor native hooks (<code className="font-mono">CosmolibFocusGuard</code>) are pre-wired so packaging as an Android/iOS app automatically activates OS-level Do-Not-Disturb and per-app blocking.
        </p>
      </div>
    </section>
  );
};
