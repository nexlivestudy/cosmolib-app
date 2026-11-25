import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Clock,
  FileCheck2,
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
import { EmptyStateCard } from './ui/CosmolibPrimitives';

interface DashboardHomeProps {
  profile: UserProfile;
  folders: StudyFolder[];
  allGroups: StudyGroup[];
  packsGeneratedCount: number;
  onJoinGroup: (groupId: string) => void;
  onOpenGroup: (groupId: string) => void;
  onNavigate: (module: ActiveModule) => void;
}

export const DashboardHome: React.FC<DashboardHomeProps> = ({
  profile,
  folders,
  allGroups,
  packsGeneratedCount,
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

  const totalActiveCams = useMemo(
    () => allGroups.reduce((acc, g) => acc + g.activeCams, 0),
    [allGroups]
  );

  const targetMinutes = Math.max(60, profile.dailyTargetHours * 60);
  const focusProgressPct = Math.min(100, Math.round((profile.minutesStudiedToday / targetMinutes) * 100));
  const panicReadinessPct = Math.min(100, Math.max(packsGeneratedCount > 0 ? 100 : 25, conceptStats.percentage));
  const liveHubParticipationPct = Math.min(
    100,
    Math.round((profile.joinedGroupIds.length / Math.max(1, Math.min(4, allGroups.length))) * 100)
  );

  const heroModules = [
    {
      id: 'folders' as ActiveModule,
      title: 'AI Study Folders',
      subtitle: 'Organize PDFs, YouTube lectures, formulas & concept mastery trees.',
      metricLabel: `${conceptStats.coveredCount}/${conceptStats.totalCount} concepts · ${folders.length} ${folders.length === 1 ? 'folder' : 'folders'}`,
      progressPct: conceptStats.percentage,
      progressLabel: `${conceptStats.percentage}% mastered`,
      cta: 'Open AI Folders',
      icon: FolderKanban,
      gradient: 'from-indigo-500 to-violet-600',
      barColor: 'bg-indigo-500',
      testId: 'hero-card-folders',
    },
    {
      id: 'panic' as ActiveModule,
      title: 'Exam Panic Mode',
      subtitle: 'Upload syllabus + PYQs for Master Rescue PDF, 20/40 Qs & AI grading.',
      metricLabel: `${packsGeneratedCount} rescue ${packsGeneratedCount === 1 ? 'pack' : 'packs'} built · Gemini 2.5 Flash`,
      progressPct: panicReadinessPct,
      progressLabel: packsGeneratedCount > 0 ? 'Active rescue ready' : 'Ready to generate',
      cta: 'Launch Exam Panic',
      icon: Siren,
      gradient: 'from-amber-500 to-rose-600',
      barColor: 'bg-amber-500',
      testId: 'hero-card-panic',
    },
    {
      id: 'focus' as ActiveModule,
      title: 'Schedule',
      subtitle: 'Regain-style study alarms, calls-only filter & Meditation Strict Mode.',
      metricLabel: `${profile.minutesStudiedToday}m / ${targetMinutes}m daily focus target`,
      progressPct: focusProgressPct,
      progressLabel: `${focusProgressPct}% of daily goal`,
      cta: 'Schedule',
      icon: Clock,
      gradient: 'from-cyan-500 to-blue-600',
      barColor: 'bg-cyan-500',
      testId: 'hero-card-schedule',
    },
    {
      id: 'groups' as ActiveModule,
      title: 'Live Hub',
      subtitle: 'Silent live-cam study rooms, shared vault & 1-to-1 accountability.',
      metricLabel: `${totalActiveCams} cams live · ${profile.joinedGroupIds.length} joined ${profile.joinedGroupIds.length === 1 ? 'room' : 'rooms'}`,
      progressPct: liveHubParticipationPct,
      progressLabel: `${profile.joinedGroupIds.length} active ${profile.joinedGroupIds.length === 1 ? 'cohort' : 'cohorts'}`,
      cta: 'Enter Live Hub',
      icon: Users,
      gradient: 'from-emerald-500 to-teal-600',
      barColor: 'bg-emerald-500',
      testId: 'hero-card-live-hub',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Top Greeting Header */}
      <section className="flex flex-col justify-between gap-4 border-b border-slate-200/90 pb-6 lg:flex-row lg:items-end dark:border-white/[0.08]">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-slate-500 dark:text-slate-400">
            {profile.country} · {profile.institution} · {profile.branch}
          </p>
          <h1 className="mt-1.5 font-display text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Ready to lock in, {profile.displayName}.
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {profile.vibe === 'night_cook'
              ? 'Late-night deep work workspace synced across folders, alarms, and live study cohorts.'
              : 'Early-bird study workspace ready. Launch a scheduled block or jump straight into your cohort.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('panic')}
            className="cosmo-btn-primary inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 whitespace-nowrap"
          >
            <Siren className="h-4 w-4 shrink-0" />
            Launch Exam Panic Mode
          </button>
          <button
            type="button"
            onClick={() => onNavigate('focus')}
            className="cosmo-btn-secondary inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white/90 px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-100 whitespace-nowrap dark:border-slate-700/80 dark:bg-[#111827] dark:text-slate-100 dark:hover:bg-slate-800"
          >
            <Clock className="h-4 w-4 shrink-0 text-cyan-600 dark:text-cyan-400" />
            Schedule
          </button>
        </div>
      </section>

      {/* Stats Row: Streak · Focus Minutes · Packs Generated */}
      <section
        data-testid="dashboard-stats-row"
        className="grid grid-cols-1 gap-4 sm:grid-cols-3"
      >
        <div className="cosmo-card p-6">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Study Streak</span>
            <Flame className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
            {profile.streakDays} {profile.streakDays === 1 ? 'Day' : 'Days'}
          </div>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            Daily target · {profile.dailyTargetHours}h / day
          </p>
        </div>

        <div className="cosmo-card p-6">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Focus Minutes Today</span>
            <Clock className="h-4 w-4 text-cyan-500" />
          </div>
          <div className="mt-2 font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
            {profile.minutesStudiedToday}m{' '}
            <span className="text-sm font-medium text-slate-400">/ {targetMinutes}m</span>
          </div>
          <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-indigo-500 transition-all duration-300"
              style={{ width: `${focusProgressPct}%` }}
            />
          </div>
        </div>

        <div className="cosmo-card p-6">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Packs Generated</span>
            <FileCheck2 className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="mt-2 font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
            {packsGeneratedCount}
          </div>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            Concept mastery · {conceptStats.percentage}% ({conceptStats.coveredCount}/{conceptStats.totalCount})
          </p>
        </div>
      </section>

      {/* 4 Hero Module Cards: AI Folders · Exam Panic · Schedule · Live Hub */}
      <section aria-label="COSMOLIB Core Modules" className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
            Workspace Command Deck
          </h2>
          <span className="shrink-0 whitespace-nowrap text-xs text-slate-500 dark:text-slate-400">
            4 core modules · 100% free
          </span>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {heroModules.map((mod) => {
            const Icon = mod.icon;
            return (
              <div
                key={mod.id}
                data-testid={mod.testId}
                className="cosmo-card cosmo-card-interactive flex flex-col justify-between p-6"
              >
                <div>
                  <div className="flex items-start justify-between gap-4">
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${mod.gradient} text-white shadow-md`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="font-mono text-xs font-medium tabular-nums text-slate-500 dark:text-slate-400">
                      {mod.progressLabel}
                    </span>
                  </div>

                  <h3 className="mt-4 font-display text-xl font-bold text-slate-900 dark:text-white">
                    {mod.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                    {mod.subtitle}
                  </p>
                </div>

                <div className="mt-6 space-y-4">
                  <div>
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                      <span className="truncate font-mono tabular-nums">{mod.metricLabel}</span>
                      <span className="ml-2 shrink-0 font-mono font-semibold tabular-nums text-slate-700 dark:text-slate-300">
                        {mod.progressPct}%
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                      <div
                        className={`h-full rounded-full ${mod.barColor} transition-all duration-300`}
                        style={{ width: `${mod.progressPct}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end border-t border-slate-200/80 pt-4 dark:border-white/[0.06]">
                    <button
                      type="button"
                      onClick={() => onNavigate(mod.id)}
                      className="cosmo-btn-primary inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 whitespace-nowrap"
                    >
                      <span>{mod.cta}</span>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Matched University + Branch Group & Global Common Branch */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {primaryGroup && (
          <div className="cosmo-card cosmo-card-interactive flex flex-col justify-between p-6">
            <div>
              <div className="flex items-center justify-between gap-3 text-xs font-medium text-cyan-700 dark:text-cyan-400">
                <span className="truncate">Primary University + Branch Group</span>
                <span className="shrink-0 font-mono tabular-nums">{primaryGroup.activeCams} cams live</span>
              </div>
              <h2 className="mt-2 font-display text-xl font-bold text-slate-900 dark:text-white">
                {primaryGroup.name}
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                {primaryGroup.description}
              </p>
            </div>
            <div className="mt-6 flex items-center justify-between gap-4 border-t border-slate-200/80 pt-4 dark:border-white/[0.06]">
              <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                {primaryGroup.memberCount.toLocaleString()} peers matched
              </span>
              <button
                type="button"
                onClick={() => onOpenGroup(primaryGroup.id)}
                className="cosmo-btn-primary inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 whitespace-nowrap"
              >
                <Video className="h-3.5 w-3.5 shrink-0" />
                Enter Study Hub
              </button>
            </div>
          </div>
        )}

        {globalBranchGroup && (
          <div className="cosmo-card cosmo-card-interactive flex flex-col justify-between p-6">
            <div>
              <div className="flex items-center justify-between gap-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                <span className="inline-flex min-w-0 items-center gap-1.5 truncate">
                  <Globe className="h-3.5 w-3.5 shrink-0 text-indigo-500" />
                  <span className="truncate">Global Common Branch Group</span>
                </span>
                <span className="shrink-0 font-mono tabular-nums">{globalBranchGroup.activeCams} cams live</span>
              </div>
              <h2 className="mt-2 font-display text-xl font-bold text-slate-900 dark:text-white">
                {globalBranchGroup.name}
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                {globalBranchGroup.description}
              </p>
            </div>
            <div className="mt-6 flex items-center justify-between gap-4 border-t border-slate-200/80 pt-4 dark:border-white/[0.06]">
              <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                {globalBranchGroup.memberCount.toLocaleString()} global scholars
              </span>
              {profile.joinedGroupIds.includes(globalBranchGroup.id) ? (
                <button
                  type="button"
                  onClick={() => onOpenGroup(globalBranchGroup.id)}
                  className="cosmo-btn-secondary inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100 whitespace-nowrap dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                >
                  Open Global Room
                  <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    onJoinGroup(globalBranchGroup.id);
                    onOpenGroup(globalBranchGroup.id);
                  }}
                  className="cosmo-btn-primary inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 whitespace-nowrap"
                >
                  1-Click Join &amp; Open
                  <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Explore & Join More Groups Directory */}
      <section className="cosmo-card p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              Explore &amp; Join More Groups
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
              className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-[#0B0F19] dark:text-white"
            />
          </div>
        </div>

        <div className="mt-5 divide-y divide-slate-200/80 dark:divide-white/[0.06]">
          {exploreGroups.map((group) => {
            const joined = profile.joinedGroupIds.includes(group.id);
            return (
              <div
                key={group.id}
                className="flex flex-col justify-between gap-4 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                    {group.name}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
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
                      className="cosmo-btn-secondary inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100 whitespace-nowrap dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      <Users className="h-3.5 w-3.5 shrink-0" />
                      Open Room
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onJoinGroup(group.id)}
                      className="cosmo-btn-primary rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-500 whitespace-nowrap"
                    >
                      Join Group
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {exploreGroups.length === 0 && (
            <div className="pt-4">
              <EmptyStateCard
                illustration="search"
                title={`No groups match "${groupQuery}"`}
                description="Try searching a broader subject, degree level, or clear your filter to browse all global cohorts."
                actionLabel="Clear Filter"
                onAction={() => setGroupQuery('')}
              />
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
