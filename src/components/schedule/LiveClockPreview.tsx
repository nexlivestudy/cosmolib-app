import React from 'react';
import {
  computeNextTriggerTimestamp,
  computeScheduleDurationSeconds,
  formatClockFromDate,
  formatDurationHms,
  parseHms,
} from '../../utils/scheduleEngine';

interface LiveClockPreviewProps {
  now: Date;
  startTime: string;
  endTime: string;
}

export const LiveClockPreview: React.FC<LiveClockPreviewProps> = ({
  now,
  startTime,
  endTime,
}) => {
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();

  const secondAngle = seconds * 6;
  const minuteAngle = minutes * 6 + seconds * 0.1;
  const hourAngle = ((hours % 12) + minutes / 60) * 30;

  // Target start-time & end-time hand angles on the 12-hour dial
  const parsedStart = parseHms(startTime);
  const parsedEnd = parseHms(endTime);
  const startAngle = ((parsedStart.hours % 12) + parsedStart.minutes / 60 + parsedStart.seconds / 3600) * 30;
  const endAngle = ((parsedEnd.hours % 12) + parsedEnd.minutes / 60 + parsedEnd.seconds / 3600) * 30;

  const nextTriggerMs = computeNextTriggerTimestamp(startTime, now.getTime());
  const secsUntilStart = Math.max(0, Math.floor((nextTriggerMs - now.getTime()) / 1000));
  const sessionDurationSecs = computeScheduleDurationSeconds(startTime, endTime);

  // Subtle dial arc showing scheduled window on 12-hour clock face (clamped to <= 350 deg)
  const rawSweep = (endAngle - startAngle + 360) % 360;
  const sweepAngle = rawSweep > 0 ? Math.min(350, rawSweep) : 30;
  const arcR = 72;
  const startRad = ((startAngle - 90) * Math.PI) / 180;
  const endRad = ((startAngle + sweepAngle - 90) * Math.PI) / 180;
  const arcPath = `M ${100 + arcR * Math.cos(startRad)} ${100 + arcR * Math.sin(startRad)} A ${arcR} ${arcR} 0 ${sweepAngle > 180 ? 1 : 0} 1 ${100 + arcR * Math.cos(endRad)} ${100 + arcR * Math.sin(endRad)}`;

  return (
    <div
      data-testid="live-clock-preview"
      className="flex h-full flex-col items-center justify-between gap-5 rounded-xl border border-slate-200 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-[#0B0F19]"
    >
      <div className="flex w-full items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <span className="font-medium text-slate-700 dark:text-slate-300">Live Local Clock</span>
        <span className="truncate font-mono tabular-nums">
          {Intl.DateTimeFormat().resolvedOptions().timeZone}
        </span>
      </div>

      {/* Precision SVG Analog Dial */}
      <div className="relative flex items-center justify-center">
        <svg
          viewBox="0 0 200 200"
          className="h-48 w-48"
          role="img"
          aria-label={`Analog clock showing ${formatClockFromDate(now)}`}
        >
          <circle
            cx="100"
            cy="100"
            r="92"
            className="fill-white stroke-slate-200 dark:fill-[#111827] dark:stroke-slate-700"
            strokeWidth="2.5"
          />
          <circle
            cx="100"
            cy="100"
            r="84"
            fill="none"
            className="stroke-slate-100 dark:stroke-slate-800"
            strokeWidth="1"
          />

          {/* Scheduled From -> To Arc */}
          <path
            d={arcPath}
            fill="none"
            className="stroke-cyan-500/35"
            strokeWidth="8"
            strokeLinecap="round"
          />

          {/* 60 minute/hour ticks */}
          {Array.from({ length: 60 }).map((_, idx) => {
            const isMajor = idx % 5 === 0;
            const angleRad = ((idx * 6 - 90) * Math.PI) / 180;
            const innerR = isMajor ? 74 : 80;
            const outerR = 85;
            return (
              <line
                key={idx}
                x1={100 + innerR * Math.cos(angleRad)}
                y1={100 + innerR * Math.sin(angleRad)}
                x2={100 + outerR * Math.cos(angleRad)}
                y2={100 + outerR * Math.sin(angleRad)}
                className={
                  isMajor
                    ? 'stroke-slate-700 dark:stroke-slate-300'
                    : 'stroke-slate-300 dark:stroke-slate-700'
                }
                strokeWidth={isMajor ? 2 : 1}
                strokeLinecap="round"
              />
            );
          })}

          {/* Scheduled Start Alarm Marker Triangle on Rim */}
          <g transform={`rotate(${startAngle} 100 100)`}>
            <polygon points="100,13 95,22 105,22" className="fill-amber-500" />
          </g>

          {/* Hour Hand */}
          <line
            x1="100"
            y1="100"
            x2="100"
            y2="52"
            transform={`rotate(${hourAngle} 100 100)`}
            className="stroke-slate-900 dark:stroke-white"
            strokeWidth="4.5"
            strokeLinecap="round"
          />

          {/* Minute Hand */}
          <line
            x1="100"
            y1="100"
            x2="100"
            y2="34"
            transform={`rotate(${minuteAngle} 100 100)`}
            className="stroke-indigo-600 dark:stroke-indigo-400"
            strokeWidth="3"
            strokeLinecap="round"
          />

          {/* Second Hand */}
          <line
            x1="100"
            y1="114"
            x2="100"
            y2="26"
            transform={`rotate(${secondAngle} 100 100)`}
            className="stroke-cyan-500"
            strokeWidth="1.6"
            strokeLinecap="round"
          />

          <circle cx="100" cy="100" r="4.5" className="fill-cyan-500" />
          <circle cx="100" cy="100" r="2" className="fill-white dark:fill-[#0B0F19]" />
        </svg>
      </div>

      {/* Live Digital HH:MM:SS Readout + Scheduled Start/End Preview */}
      <div className="w-full space-y-3 text-center">
        <div>
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Current Time (HH:MM:SS)
          </div>
          <div
            data-testid="live-digital-clock"
            className="mt-0.5 font-mono text-3xl font-bold tracking-tight tabular-nums text-slate-900 dark:text-white"
          >
            {formatClockFromDate(now)}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 border-t border-slate-200 pt-3 text-left dark:border-slate-800">
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-[#111827]">
            <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
              Scheduled Start
            </div>
            <div className="mt-0.5 font-mono text-sm font-bold tabular-nums text-amber-600 dark:text-amber-300">
              {startTime}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-[#111827]">
            <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
              Scheduled End
            </div>
            <div className="mt-0.5 font-mono text-sm font-bold tabular-nums text-cyan-700 dark:text-cyan-300">
              {endTime}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 font-mono text-xs tabular-nums text-slate-600 dark:text-slate-400">
          <span>Length {formatDurationHms(sessionDurationSecs)}</span>
          <span aria-hidden="true">·</span>
          <span className="text-amber-700 dark:text-amber-300">
            Starts in {formatDurationHms(secsUntilStart)}
          </span>
        </div>
      </div>
    </div>
  );
};
