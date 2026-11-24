import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Clock,
  Flame,
  FolderKanban,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Search,
  Siren,
  Sun,
  Users,
  X,
} from 'lucide-react';
import { AuthScreen } from './components/AuthScreen';
import { BYOKModal } from './components/BYOKModal';
import { DashboardHome } from './components/DashboardHome';
import { ExamPanicModule } from './components/ExamPanicModule';
import { FocusTimerModule } from './components/FocusTimerModule';
import { GroupHubModule } from './components/GroupHubModule';
import { OnboardingWizard } from './components/OnboardingWizard';
import { OfflineIndicator, PWAInstallButton } from './components/PWAInstallButton';
import { LanguageSelector } from './components/LanguageSelector';
import { StudyFoldersModule } from './components/StudyFoldersModule';
import { CosmolibLogoMark, WorkspaceSkeletonLoader } from './components/ui/CosmolibPrimitives';
import { EXPLORE_STUDY_GROUPS, INITIAL_STUDY_FOLDERS } from './data/catalog';
import { useTheme } from './hooks/useTheme';
import { AnimatedBackground } from './components/AnimatedBackground';
import { loadBYOKConfig, saveBYOKConfig } from './lib/aiClient';
import { supabase } from './lib/supabase';
import type { ActiveModule, BYOKConfig, StudyFolder, StudyGroup, UserProfile } from './types';

const PROFILE_CACHE_PREFIX = 'cosmolib_profile_';
const FOLDERS_CACHE_PREFIX = 'cosmolib_folders_';
const PACKS_COUNT_PREFIX = 'cosmolib_packs_count_';

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'CS';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export default function App() {
  const { theme, toggleTheme, cosmoThemeId } = useTheme();
  const [authChecking, setAuthChecking] = useState(true);
  const [authUser, setAuthUser] = useState<{ id: string; email: string } | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [customGroups, setCustomGroups] = useState<StudyGroup[]>([]);
  const [folders, setFolders] = useState<StudyFolder[]>(INITIAL_STUDY_FOLDERS);
  const [packsGeneratedCount, setPacksGeneratedCount] = useState<number>(0);
  const [activeModule, setActiveModule] = useState<ActiveModule>('dashboard');
  const [activeGroupId, setActiveGroupId] = useState<string>('');
  const [isUltraBlockActive, setIsUltraBlockActive] = useState(false);
  const [byok, setByok] = useState<BYOKConfig>(() => loadBYOKConfig());
  const [byokOpen, setByokOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);

  const searchRef = useRef<HTMLDivElement | null>(null);
  const avatarRef = useRef<HTMLDivElement | null>(null);

  const allGroups = useMemo(() => {
    const map = new Map<string, StudyGroup>();
    [...customGroups, ...EXPLORE_STUDY_GROUPS].forEach((g) => map.set(g.id, g));
    return Array.from(map.values());
  }, [customGroups]);

  // Close topbar popovers on outside click
  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (searchRef.current && !searchRef.current.contains(target)) {
        setSearchOpen(false);
      }
      if (avatarRef.current && !avatarRef.current.contains(target)) {
        setAvatarMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  // Load verified Supabase session ONLY — no auto-login or backdoor
  useEffect(() => {
    let mounted = true;
    if (!supabase) {
      setAuthChecking(false);
      return;
    }

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return;
        const user = data.session?.user;
        if (user) {
          setAuthUser({ id: user.id, email: user.email || '' });
        }
        setAuthChecking(false);
      })
      .catch(() => {
        if (mounted) setAuthChecking(false);
      });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      if (session?.user) {
        setAuthUser({ id: session.user.id, email: session.user.email || '' });
      } else {
        setAuthUser(null);
        setProfile(null);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Load own profile (RLS: .eq('id', authUser.id)) + local folder & packs cache when authenticated
  useEffect(() => {
    if (!authUser) return;
    let cancelled = false;

    const loadUserProfile = async () => {
      try {
        const cachedFolders = localStorage.getItem(`${FOLDERS_CACHE_PREFIX}${authUser.id}`);
        if (cachedFolders) {
          setFolders(JSON.parse(cachedFolders) as StudyFolder[]);
        }
        const savedPacks = Number(localStorage.getItem(`${PACKS_COUNT_PREFIX}${authUser.id}`) || '0');
        if (Number.isFinite(savedPacks) && savedPacks >= 0) {
          setPacksGeneratedCount(savedPacks);
        }
      } catch {
        // ignore cache parse errors
      }

      if (supabase) {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authUser.id)
          .maybeSingle();

        if (!cancelled && !error && data && data.onboarding_complete) {
          const loaded: UserProfile = {
            id: authUser.id,
            email: authUser.email,
            displayName: data.display_name || authUser.email.split('@')[0],
            country: data.country || 'India',
            countryCode: data.country_code || 'IN',
            dailyTargetHours: data.daily_target_hours || 4,
            vibe: data.vibe || 'night_cook',
            streamCategory: data.stream_category || 'Higher Education / Engineering',
            degreeLevel: data.degree_level || 'B.Tech / B.E.',
            branch: data.branch || 'Computer Science & Engineering',
            institution: data.institution || 'Independent Cohort',
            primaryGroupId: data.primary_group_id || EXPLORE_STUDY_GROUPS[0].id,
            joinedGroupIds: Array.isArray(data.joined_group_ids)
              ? data.joined_group_ids
              : [EXPLORE_STUDY_GROUPS[0].id],
            streakDays: data.streak_days || 1,
            minutesStudiedToday: data.minutes_studied_today || 0,
            onboardingComplete: true,
          };
          setProfile(loaded);
          setActiveGroupId(loaded.primaryGroupId);
          return;
        }
      }

      // Check local profile cache for this verified authUser.id
      try {
        const cached = localStorage.getItem(`${PROFILE_CACHE_PREFIX}${authUser.id}`);
        if (cached && !cancelled) {
          const parsed = JSON.parse(cached) as {
            profile: UserProfile;
            customGroups?: StudyGroup[];
          };
          if (parsed.profile?.onboardingComplete) {
            setProfile(parsed.profile);
            setCustomGroups(parsed.customGroups || []);
            setActiveGroupId(parsed.profile.primaryGroupId);
          }
        }
      } catch {
        // ignore
      }
    };

    void loadUserProfile();
    return () => {
      cancelled = true;
    };
  }, [authUser]);

  // Persist folders per authenticated user
  useEffect(() => {
    if (!authUser) return;
    try {
      localStorage.setItem(`${FOLDERS_CACHE_PREFIX}${authUser.id}`, JSON.stringify(folders));
    } catch {
      // ignore
    }
  }, [authUser, folders]);

  const handlePackGenerated = () => {
    setPacksGeneratedCount((prev) => {
      const next = prev + 1;
      if (authUser) {
        try {
          localStorage.setItem(`${PACKS_COUNT_PREFIX}${authUser.id}`, String(next));
        } catch {
          // ignore
        }
      }
      return next;
    });
  };

  const persistProfile = async (nextProfile: UserProfile, nextCustomGroups?: StudyGroup[]) => {
    setProfile(nextProfile);
    if (nextCustomGroups) setCustomGroups(nextCustomGroups);

    try {
      localStorage.setItem(
        `${PROFILE_CACHE_PREFIX}${nextProfile.id}`,
        JSON.stringify({
          profile: nextProfile,
          customGroups: nextCustomGroups ?? customGroups,
        })
      );
    } catch {
      // ignore
    }

    // Respect RLS: update/upsert own profile (id === authUser.id) only
    if (supabase && authUser && nextProfile.id === authUser.id) {
      await supabase.from('profiles').upsert(
        {
          id: authUser.id,
          email: nextProfile.email,
          display_name: nextProfile.displayName,
          country: nextProfile.country,
          country_code: nextProfile.countryCode,
          daily_target_hours: nextProfile.dailyTargetHours,
          vibe: nextProfile.vibe,
          stream_category: nextProfile.streamCategory,
          degree_level: nextProfile.degreeLevel,
          branch: nextProfile.branch,
          institution: nextProfile.institution,
          primary_group_id: nextProfile.primaryGroupId,
          joined_group_ids: nextProfile.joinedGroupIds,
          streak_days: nextProfile.streakDays,
          minutes_studied_today: nextProfile.minutesStudiedToday,
          onboarding_complete: true,
        },
        { onConflict: 'id' }
      );
    }
  };

  const handleOnboardingComplete = (newProfile: UserProfile, createdGroups: StudyGroup[]) => {
    setActiveGroupId(newProfile.primaryGroupId);
    void persistProfile(newProfile, createdGroups);
  };

  const handleJoinGroup = (groupId: string) => {
    if (!profile) return;
    if (profile.joinedGroupIds.includes(groupId)) return;
    const next: UserProfile = {
      ...profile,
      joinedGroupIds: [...profile.joinedGroupIds, groupId],
    };
    void persistProfile(next);
  };

  const handleOpenGroup = (groupId: string) => {
    if (profile && !profile.joinedGroupIds.includes(groupId)) {
      handleJoinGroup(groupId);
    }
    setActiveGroupId(groupId);
    setActiveModule('groups');
  };

  const handleLogStudyMinute = () => {
    if (!profile) return;
    const next: UserProfile = {
      ...profile,
      minutesStudiedToday: profile.minutesStudiedToday + 1,
    };
    void persistProfile(next);
  };

  const handleSignOut = async () => {
    setAvatarMenuOpen(false);
    setMobileNavOpen(false);
    if (supabase) {
      await supabase.auth.signOut();
    }
    setAuthUser(null);
    setProfile(null);
    setActiveModule('dashboard');
  };

  const handleSaveByok = (next: BYOKConfig) => {
    setByok(next);
    saveBYOKConfig(next);
  };

  const navItems: { id: ActiveModule; label: string; shortDesc: string; icon: React.ComponentType<{ className?: string }> }[] = useMemo(
    () => [
      { id: 'dashboard', label: 'Home Desk', shortDesc: 'Overview, progress & hero launchpad', icon: LayoutDashboard },
      { id: 'folders', label: 'AI Study Folders', shortDesc: 'Notes, PDFs, YouTube & concept mastery', icon: FolderKanban },
      { id: 'panic', label: 'Exam Panic Mode', shortDesc: 'Master Rescue PDF, 20/40 Qs & grader', icon: Siren },
      { id: 'focus', label: 'Schedule', shortDesc: 'Regain alarms, calls-only & Strict Mode', icon: Clock },
      { id: 'groups', label: 'Hybrid Group Hub', shortDesc: 'Silent live-cam rooms & study vault', icon: Users },
    ],
    []
  );

  // Live topbar search results across modules, folders, and groups
  const searchResults = useMemo(() => {
    const q = globalSearch.trim().toLowerCase();
    if (!q) return [];
    const results: { id: string; kind: string; label: string; sub: string; onSelect: () => void }[] = [];

    for (const item of navItems) {
      if (item.label.toLowerCase().includes(q) || item.shortDesc.toLowerCase().includes(q)) {
        results.push({
          id: `nav-${item.id}`,
          kind: 'Module',
          label: item.label,
          sub: item.shortDesc,
          onSelect: () => {
            setActiveModule(item.id);
            setGlobalSearch('');
            setSearchOpen(false);
          },
        });
      }
    }

    for (const folder of folders) {
      if (folder.name.toLowerCase().includes(q) || folder.subjectTag.toLowerCase().includes(q)) {
        results.push({
          id: `folder-${folder.id}`,
          kind: 'Folder',
          label: folder.name,
          sub: `${folder.subjectTag} · ${folder.resources.length} sources`,
          onSelect: () => {
            setActiveModule('folders');
            setGlobalSearch('');
            setSearchOpen(false);
          },
        });
      }
    }

    for (const grp of allGroups) {
      if (grp.name.toLowerCase().includes(q) || grp.branch.toLowerCase().includes(q)) {
        results.push({
          id: `grp-${grp.id}`,
          kind: 'Group',
          label: grp.name,
          sub: `${grp.branch} · ${grp.activeCams} cams live`,
          onSelect: () => {
            handleOpenGroup(grp.id);
            setGlobalSearch('');
            setSearchOpen(false);
          },
        });
      }
    }

    return results.slice(0, 7);
  }, [globalSearch, navItems, folders, allGroups]);

  if (authChecking) {
    return (
      <div className="cosmo-canvas relative flex min-h-screen items-center justify-center p-6">
      <AnimatedBackground themeId={cosmoThemeId} />
        <div className="w-full max-w-xl">
          <WorkspaceSkeletonLoader label="Verifying COSMOLIB session..." />
        </div>
      </div>
    );
  }

  // Gate 1: Strict Supabase Email OTP Authentication
  if (!authUser) {
    return (
      <>
        <AuthScreen
          theme={theme}
          onToggleTheme={toggleTheme}
          onVerifiedSession={(u) => setAuthUser(u)}
        />
        <OfflineIndicator />
      </>
    );
  }

  // Gate 2: Country-First Dynamic Onboarding Wizard for new users
  if (!profile || !profile.onboardingComplete) {
    return (
      <>
        <OnboardingWizard
          userId={authUser.id}
          email={authUser.email}
          theme={theme}
          onToggleTheme={toggleTheme}
          onComplete={handleOnboardingComplete}
        />
        <OfflineIndicator />
      </>
    );
  }

  const userInitials = getInitials(profile.displayName);

  return (
    <div className="cosmo-canvas relative flex min-h-screen text-slate-900 dark:text-slate-100">
      <AnimatedBackground themeId={cosmoThemeId} />
      {/* Desktop Sidebar (256px, glass surface, active indigo glow) */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200/90 bg-white/90 backdrop-blur-md lg:flex dark:border-white/[0.08] dark:bg-[#0E1422]/90">
        <div className="flex h-16 items-center gap-3 border-b border-slate-200/90 px-5 dark:border-white/[0.08]">
          <CosmolibLogoMark className="h-8 w-8 shrink-0" />
          <span className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 dark:text-white">
            COSMOLIB
          </span>
        </div>

        <nav className="flex-1 space-y-1.5 p-4" aria-label="Primary Workspace Navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeModule === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveModule(item.id)}
                className={`group flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-150 whitespace-nowrap ${
                  active
                    ? 'cosmo-nav-active bg-indigo-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100/90 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/[0.05] dark:hover:text-white'
                }`}
              >
                <Icon
                  className={`h-4 w-4 shrink-0 transition-transform duration-150 ${
                    active ? 'text-white' : 'text-slate-400 group-hover:text-indigo-500 dark:text-slate-400 dark:group-hover:text-cyan-400'
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="border-t border-slate-200/90 p-4 dark:border-white/[0.08]">
          <div className="flex items-center gap-3">
            <div
              aria-hidden="true"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 font-display text-xs font-bold text-white shadow-xs"
            >
              {userInitials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-semibold text-slate-900 dark:text-white">
                {profile.displayName}
              </div>
              <div className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                {profile.institution} · {profile.countryCode}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="cosmo-btn-secondary mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800/80"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Collapsible Nav Drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="relative z-10 flex w-72 max-w-[85vw] flex-col border-r border-slate-200 bg-white p-4 shadow-2xl dark:border-white/[0.08] dark:bg-[#0E1422]">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4 dark:border-white/[0.08]">
              <div className="flex items-center gap-2.5">
                <CosmolibLogoMark className="h-7 w-7 shrink-0" />
                <span className="font-display text-lg font-bold text-slate-900 dark:text-white">
                  COSMOLIB
                </span>
              </div>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                aria-label="Close navigation menu"
                className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav className="mt-4 flex-1 space-y-1.5" aria-label="Mobile Workspace Navigation">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = activeModule === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveModule(item.id);
                      setMobileNavOpen(false);
                    }}
                    className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all ${
                      active
                        ? 'cosmo-nav-active bg-indigo-600 text-white'
                        : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/[0.05]'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </nav>
            <div className="mt-auto border-t border-slate-200 pt-4 dark:border-white/[0.08]">
              <div className="mb-3 flex items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 font-display text-xs font-bold text-white">
                  {userInitials}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-xs font-semibold text-slate-900 dark:text-white">
                    {profile.displayName}
                  </div>
                  <div className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                    {profile.streakDays}d streak · {profile.countryCode}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 py-2 text-xs font-semibold text-slate-700 dark:border-slate-800 dark:text-slate-300"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar: Mobile Menu + Active Title + Global Search + Streak + Theme/BYOK + Avatar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-slate-200/90 bg-white/85 px-4 backdrop-blur-md sm:px-6 dark:border-white/[0.08] dark:bg-[#0B0F19]/85">
          {/* Left Zone: Mobile drawer toggle + Active section title */}
          <div className="flex min-w-0 items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation menu"
              className="rounded-xl p-2 text-slate-600 hover:bg-slate-100 lg:hidden dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="truncate font-display text-sm font-bold tracking-tight text-slate-900 whitespace-nowrap dark:text-white">
              {navItems.find((n) => n.id === activeModule)?.label}
            </span>
          </div>

          {/* Center Zone: Interactive Global Quick Search */}
          <div ref={searchRef} className="relative hidden max-w-md flex-1 md:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={globalSearch}
              onFocus={() => setSearchOpen(true)}
              onChange={(e) => {
                setGlobalSearch(e.target.value);
                setSearchOpen(true);
              }}
              placeholder="Jump to folders, Schedule, Exam Panic, or groups..."
              aria-label="Search COSMOLIB modules, folders, and groups"
              data-testid="topbar-global-search"
              className="w-full rounded-xl border border-slate-200 bg-slate-100/75 py-2 pl-9 pr-3 text-xs text-slate-900 transition-colors placeholder:text-slate-500 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-white/[0.08] dark:bg-[#111827]/90 dark:text-white dark:placeholder:text-slate-400 dark:focus:border-indigo-400 dark:focus:bg-[#111827]"
            />
            {searchOpen && globalSearch.trim().length > 0 && (
              <div
                data-testid="topbar-search-results"
                className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-white/[0.1] dark:bg-[#111827]"
              >
                {searchResults.length === 0 ? (
                  <p className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                    No matches for &ldquo;{globalSearch}&rdquo;.
                  </p>
                ) : (
                  <ul className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {searchResults.map((res) => (
                      <li key={res.id}>
                        <button
                          type="button"
                          onClick={res.onSelect}
                          className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-white/[0.04]"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-xs font-semibold text-slate-900 dark:text-white">
                              {res.label}
                            </div>
                            <div className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                              {res.sub}
                            </div>
                          </div>
                          <span className="shrink-0 font-mono text-[10px] font-semibold text-indigo-600 dark:text-cyan-400">
                            {res.kind}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Right Zone: Streak + PWA + BYOK + Theme + Avatar */}
          <div className="flex items-center gap-2 shrink-0">
            <LanguageSelector compact />
            <div
              data-testid="topbar-streak"
              title={`${profile.streakDays} day study streak`}
              className="hidden items-center gap-1.5 rounded-xl border border-amber-500/25 bg-amber-500/[0.08] px-2.5 py-1.5 font-mono text-xs font-semibold tabular-nums text-amber-700 sm:inline-flex whitespace-nowrap dark:text-amber-300"
            >
              <Flame className="h-3.5 w-3.5 text-amber-500" />
              <span>{profile.streakDays}d</span>
            </div>

            <PWAInstallButton />

            <button
              type="button"
              onClick={() => setByokOpen(true)}
              aria-label="Open Student Free Pass BYOK settings"
              className="cosmo-btn-secondary inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white/90 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 whitespace-nowrap sm:px-3 dark:border-white/[0.08] dark:bg-[#111827] dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <KeyRound className="h-3.5 w-3.5 text-indigo-500" />
              <span className="hidden sm:inline">
                {byok.provider === 'default' ? 'Free Pass' : `BYOK: ${byok.provider.toUpperCase()}`}
              </span>
            </button>

            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              className="cosmo-btn-secondary inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white/90 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 whitespace-nowrap sm:px-3 dark:border-white/[0.08] dark:bg-[#111827] dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {theme === 'dark' ? (
                <Sun className="h-3.5 w-3.5 text-amber-400" />
              ) : (
                <Moon className="h-3.5 w-3.5 text-indigo-600" />
              )}
              <span className="hidden sm:inline">{theme === 'dark' ? 'Light' : 'Dark'}</span>
            </button>

            {/* User Avatar + Quick Profile Popover */}
            <div ref={avatarRef} className="relative">
              <button
                type="button"
                data-testid="topbar-avatar-btn"
                aria-label={`Account menu for ${profile.displayName}`}
                aria-expanded={avatarMenuOpen}
                onClick={() => setAvatarMenuOpen((o) => !o)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-blue-500 to-cyan-500 font-display text-xs font-bold text-white shadow-sm ring-1 ring-white/20 transition-transform hover:scale-105"
              >
                {userInitials}
              </button>
              {avatarMenuOpen && (
                <div className="absolute right-0 top-full z-50 mt-2 w-60 rounded-xl border border-slate-200 bg-white p-4 shadow-xl dark:border-white/[0.1] dark:bg-[#111827]">
                  <div className="truncate text-sm font-bold text-slate-900 dark:text-white">
                    {profile.displayName}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                    {profile.institution}
                  </div>
                  <div className="mt-1 truncate text-[11px] text-slate-500 dark:text-slate-400">
                    {profile.branch} · {profile.countryCode}
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3 font-mono text-xs tabular-nums dark:border-slate-800">
                    <span className="text-amber-600 dark:text-amber-300">{profile.streakDays}d streak</span>
                    <span className="text-cyan-700 dark:text-cyan-400">{profile.minutesStudiedToday}m today</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Active Module Viewport (8pt spacing grid, max-w-7xl, bottom clearance for toasts) */}
        <main className="mx-auto w-full max-w-7xl flex-1 p-4 pb-20 sm:p-6 sm:pb-24 lg:p-8 lg:pb-24">
          {activeModule === 'dashboard' && (
            <DashboardHome
              profile={profile}
              folders={folders}
              allGroups={allGroups}
              packsGeneratedCount={packsGeneratedCount}
              onJoinGroup={handleJoinGroup}
              onOpenGroup={handleOpenGroup}
              onNavigate={setActiveModule}
            />
          )}

          {activeModule === 'folders' && (
            <StudyFoldersModule
              folders={folders}
              byok={byok}
              onUpdateFolders={setFolders}
            />
          )}

          {activeModule === 'panic' && (
            <ExamPanicModule byok={byok} onPackGenerated={handlePackGenerated} />
          )}

          <div className={activeModule === 'focus' ? '' : 'hidden'}>
            <FocusTimerModule
              userId={profile.id}
              streakDays={profile.streakDays}
              minutesStudiedToday={profile.minutesStudiedToday}
              isUltraBlockActive={isUltraBlockActive}
              onUltraBlockChange={setIsUltraBlockActive}
              onLogStudyMinute={handleLogStudyMinute}
            />
          </div>

          {activeModule === 'groups' && (
            <GroupHubModule
              profile={profile}
              allGroups={allGroups}
              activeGroupId={activeGroupId || profile.primaryGroupId}
              isUltraBlockActive={isUltraBlockActive}
              onSelectGroup={setActiveGroupId}
            />
          )}
        </main>
      </div>

      <BYOKModal
        open={byokOpen}
        config={byok}
        onSave={handleSaveByok}
        onClose={() => setByokOpen(false)}
      />

      <OfflineIndicator />
    </div>
  );
}
