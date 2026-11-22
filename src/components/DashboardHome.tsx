import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  BookOpenCheck,
  Clock,
  Flame,
  FolderKanban,
  Globe,
  Search,
  Siren,
  Users,
  Video,
} from 'lucide-react';
import type { ActiveModule, StudyFolder, StudyGroup, UserProfile } from '../types';
import { calculateConceptMastery } from '../utils/studyLogic';

interface DashboardHomeProps {
  profile: UserProfile;
  folders: StudyFolder[];
  allGroups: StudyGroup[];
  onJoinGroup: (groupId: string) => void;
  onOpenGroup: (groupId: string) => void;
  onNavigate: (module: ActiveModule) => void;
}

export const DashboardHome: React.FC<DashboardHomeProps> = ({
  profile,
  folders,
  allGroups,
  onJoinGroup,
  onOpenGroup,
  onNavigate,
}) => {
  const [groupQuery, setGroupQuery] = useState('');

  const primaryGroup =
    allGroups.find((g) => g.id === profile.primaryGroupId) || allGroups[0];
  const globalBranchGroup =
    allGroups.find((g) => g.type === 'global_branch' && g.branch === profile.branch) ||
    allGroups.find((g) => g.type === 'global_branch');

  const exploreGroups = useMemo(() => {
    const q = groupQuery.trim().toLowerCase();
    return allGroups
      .filter((g) => g.id !== primaryGroup?.id && g.id !== globalBranchGroup?.id)
      .filter(
        (g) =>
          !q ||
          g.name.toLowerCase().includes(q) ||
          g.branch.toLowerCase().includes(q) ||
          g.description.toLowerCase().includes(q)
      );
  }, [allGroups, primaryGroup?.id, globalBranchGroup?.id, groupQuery]);

  const conceptStats = useMemo(() => {
    const allConcepts = folders.flatMap((f) => f.concepts);
    return calculateConceptMastery(allConcepts);
  }, [folders]);

  const targetMinutes = profile.dailyTargetHours * 60;
  const progressPct = Math.min(100, Math.round((profile.minutesStudiedToday / targetMinutes) * 100));

  return (
    <div className="space-y-8">
      {/* Top Greeting + Daily Target Strip */}
      <section className="flex flex-col justify-between gap-6 border-b border-slate-200 pb-6 lg:flex-row lg:items-end dark:border-slate-800">
        <div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {profile.country} · {profile.institution} · {profile.branch}
          </p>
          <h1 className="mt-1.5 font-display text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Ready to lock in, {profile.displayName}.
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {profile.vibe === 'night_cook'
              ? 'Late-night deep work mode active. Your matched cohort and AI study desk are synced.'
              : 'Early bird study sprint ready. Pick a folder or launch a silent live-cam focus block.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => onNavigate('panic')}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 whitespace-nowrap"
          >
            <Siren className="h-4 w-4" />
            Launch Exam Panic Mode
          </button>
          <button
            type="button"
            onClick={() => onNavigate('focus')}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-100 whitespace-nowrap dark:border-slate-700 dark:bg-[#111827] dark:text-slate-100 dark:hover:bg-slate-800"
          >
            <Clock className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
            Start Focus Timer
          </button>
        </div>
      </section>

      {/* Clean 4-Metric KPI Strip */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#111827]">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Daily Target</span>
            <Clock className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold tabular-nums text-slate-900 dark:text-white">
            {profile.minutesStudiedToday}m / {targetMinutes}m
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
            <div className="h-full bg-cyan-500" style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#111827]">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Study Streak</span>
            <Flame className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold tabular-nums text-slate-900 dark:text-white">
            {profile.streakDays} Days
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Target: {profile.dailyTargetHours}h / day
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#111827]">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Concept Mastery</span>
            <BookOpenCheck className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold tabular-nums text-slate-900 dark:text-white">
            {conceptStats.percentage}%
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {conceptStats.coveredCount} covered · {conceptStats.uncoveredCount} remaining
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#111827]">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Active Study Folders</span>
            <FolderKanban className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold tabular-nums text-slate-900 dark:text-white">
            {folders.length}
          </div>
          <button
            type="button"
            onClick={() => onNavigate('folders')}
            className="mt-1 text-xs font-semibold text-cyan-700 hover:underline dark:text-cyan-400"
          >
            Open AI Folders →
          </button>
        </div>
      </section>

      {/* Primary Matched University+Branch Group + Global Common Branch 1-Click Card */}
      <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {primaryGroup && (
          <div className="flex flex-col justify-between rounded-xl border border-cyan-500/40 bg-white p-6 dark:border-cyan-500/30 dark:bg-[#111827]">
            <div>
              <div className="flex items-center justify-between text-xs font-medium text-cyan-700 dark:text-cyan-400">
                <span>Primary University + Branch Group</span>
                <span className="font-mono tabular-nums">{primaryGroup.activeCams} cams live</span>
              </div>
              <h2 className="mt-2 font-display text-xl font-bold text-slate-900 dark:text-white">
                {primaryGroup.name}
              </h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                {primaryGroup.description}
              </p>
            </div>
            <div className="mt-6 flex items-center justify-between border-t border-slate-200 pt-4 dark:border-slate-800">
              <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                {primaryGroup.memberCount.toLocaleString()} peers matched
              </span>
              <button
                type="button"
                onClick={() => onOpenGroup(primaryGroup.id)}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
              >
                <Video className="h-3.5 w-3.5" />
                Enter Study Hub
              </button>
            </div>
          </div>
        )}

        {globalBranchGroup && (
          <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-[#111827]">
            <div>
              <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
                <span className="inline-flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5 text-indigo-500" />
                  Global Common Branch Group
                </span>
                <span className="font-mono tabular-nums">{globalBranchGroup.activeCams} cams live</span>
              </div>
              <h2 className="mt-2 font-display text-xl font-bold text-slate-900 dark:text-white">
                {globalBranchGroup.name}
              </h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                {globalBranchGroup.description}
              </p>
            </div>
            <div className="mt-6 flex items-center justify-between border-t border-slate-200 pt-4 dark:border-slate-800">
              <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                {globalBranchGroup.memberCount.toLocaleString()} global scholars
              </span>
              {profile.joinedGroupIds.includes(globalBranchGroup.id) ? (
                <button
                  type="button"
                  onClick={() => onOpenGroup(globalBranchGroup.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                >
                  Open Global Room
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    onJoinGroup(globalBranchGroup.id);
                    onOpenGroup(globalBranchGroup.id);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 px-4 py-2 text-xs font-semibold text-white hover:bg-cyan-500"
                >
                  1-Click Join & Open
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Explore & Join More Groups Directory */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-[#111827]">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              Explore & Join More Groups
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Connect across exam boards, branches, and international silent-cam study cohorts.
            </p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={groupQuery}
              onChange={(e) => setGroupQuery(e.target.value)}
              placeholder="Filter study groups..."
              aria-label="Filter study groups"
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-[#0B0F19] dark:text-white"
            />
          </div>
        </div>

        <div className="mt-5 divide-y divide-slate-200 dark:divide-slate-800">
          {exploreGroups.map((group) => {
            const joined = profile.joinedGroupIds.includes(group.id);
            return (
              <div
                key={group.id}
                className="flex flex-col justify-between gap-4 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
              >
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">
                    {group.name}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {group.branch} · {group.memberCount.toLocaleString()} members · {group.activeCams} active cams
                  </div>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                    {group.description}
                  </p>
                </div>
                <div className="shrink-0">
                  {joined ? (
                    <button
                      type="button"
                      onClick={() => onOpenGroup(group.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      <Users className="h-3.5 w-3.5" />
                      Open Room
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onJoinGroup(group.id)}
                      className="rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
                    >
                      Join Group
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {exploreGroups.length === 0 && (
            <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
              No study groups match &ldquo;{groupQuery}&rdquo;.
            </p>
          )}
        </div>
      </section>
    </div>
  );
};
