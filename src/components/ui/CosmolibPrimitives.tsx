import React from 'react';

export const CosmolibLogoMark: React.FC<{ className?: string }> = ({ className = 'h-7 w-7' }) => (
  <svg
    viewBox="0 0 40 40"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <defs>
      <linearGradient id="cosmolibMarkGrad" x1="6" y1="6" x2="34" y2="34" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#6366F1" />
        <stop offset="55%" stopColor="#3B82F6" />
        <stop offset="100%" stopColor="#06B6D4" />
      </linearGradient>
    </defs>
    <rect width="40" height="40" rx="10" className="fill-slate-900 dark:fill-[#111827]" />
    <rect
      x="0.75"
      y="0.75"
      width="38.5"
      height="38.5"
      rx="9.25"
      className="stroke-indigo-500/35"
      strokeWidth="1.5"
    />
    <path
      d="M27.5 13.6C25.6 11.3 22.8 10 19.7 10C14.1 10 9.6 14.5 9.6 20C9.6 25.5 14.1 30 19.7 30C23 30 25.8 28.5 27.7 26.2"
      stroke="url(#cosmolibMarkGrad)"
      strokeWidth="3.6"
      strokeLinecap="round"
    />
    <circle cx="28" cy="20" r="2.2" fill="#06B6D4" />
    <circle cx="19.7" cy="20" r="2.4" fill="#F8FAFC" />
  </svg>
);

export const SkeletonBlock: React.FC<{ className?: string }> = ({ className = 'h-4 w-full' }) => (
  <div className={`cosmo-skeleton rounded-lg ${className}`} aria-hidden="true" />
);

export const WorkspaceSkeletonLoader: React.FC<{ label?: string }> = ({
  label = 'Loading workspace...',
}) => (
  <div
    role="status"
    aria-live="polite"
    className="cosmo-card space-y-4 p-6"
  >
    <div className="flex items-center justify-between gap-4">
      <div className="space-y-2 w-2/3">
        <SkeletonBlock className="h-3 w-28" />
        <SkeletonBlock className="h-6 w-3/4" />
      </div>
      <SkeletonBlock className="h-9 w-28 shrink-0" />
    </div>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <SkeletonBlock className="h-24 w-full" />
      <SkeletonBlock className="h-24 w-full" />
      <SkeletonBlock className="h-24 w-full" />
    </div>
    <p className="font-mono text-xs text-slate-500 dark:text-slate-400">{label}</p>
  </div>
);

interface EmptyStateCardProps {
  illustration: 'schedule' | 'panic' | 'folders' | 'search';
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyStateCard: React.FC<EmptyStateCardProps> = ({
  illustration,
  title,
  description,
  actionLabel,
  onAction,
}) => {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300/90 bg-slate-50/60 px-6 py-8 text-center dark:border-slate-700/80 dark:bg-[#0B0F19]/60">
      <svg
        viewBox="0 0 96 72"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-16 w-20"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={`emptyGrad-${illustration}`} x1="16" y1="8" x2="80" y2="64" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#6366F1" />
            <stop offset="100%" stopColor="#06B6D4" />
          </linearGradient>
        </defs>
        <ellipse cx="48" cy="60" rx="30" ry="6" className="fill-indigo-500/10" />
        {illustration === 'schedule' && (
          <>
            <circle cx="48" cy="34" r="21" stroke={`url(#emptyGrad-${illustration})`} strokeWidth="2.5" />
            <path d="M48 22V34L56 39" stroke="#06B6D4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M29 15L23 19M67 15L73 19" stroke="#818CF8" strokeWidth="2.5" strokeLinecap="round" />
          </>
        )}
        {illustration === 'panic' && (
          <>
            <rect x="24" y="12" width="48" height="44" rx="8" stroke={`url(#emptyGrad-${illustration})`} strokeWidth="2.5" />
            <path d="M34 25H62M34 34H54M34 43H46" stroke="#94A3B8" strokeWidth="2.2" strokeLinecap="round" />
            <circle cx="64" cy="44" r="8" fill="#0B0F19" stroke="#06B6D4" strokeWidth="2.2" />
            <path d="M64 40V44L67 46" stroke="#06B6D4" strokeWidth="2" strokeLinecap="round" />
          </>
        )}
        {illustration === 'folders' && (
          <>
            <path d="M20 22C20 18.6863 22.6863 16 26 16H40L45 22H70C73.3137 22 76 24.6863 76 28V50C76 53.3137 73.3137 56 70 56H26C22.6863 56 20 53.3137 20 50V22Z" stroke={`url(#emptyGrad-${illustration})`} strokeWidth="2.5" />
            <path d="M38 38H58M48 30V46" stroke="#06B6D4" strokeWidth="2.4" strokeLinecap="round" />
          </>
        )}
        {illustration === 'search' && (
          <>
            <circle cx="43" cy="33" r="16" stroke={`url(#emptyGrad-${illustration})`} strokeWidth="2.5" />
            <path d="M55 45L67 56" stroke="#06B6D4" strokeWidth="3" strokeLinecap="round" />
          </>
        )}
      </svg>

      <h3 className="mt-3 font-display text-base font-bold text-slate-900 dark:text-white">
        {title}
      </h3>
      <p className="mt-1 max-w-md text-xs leading-relaxed text-slate-600 dark:text-slate-400">
        {description}
      </p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="cosmo-btn-primary mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 whitespace-nowrap"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};
