import React, { useEffect, useMemo, useState } from 'react';
import {
  Clock,
  FolderKanban,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
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
import { StudyFoldersModule } from './components/StudyFoldersModule';
import { EXPLORE_STUDY_GROUPS, INITIAL_STUDY_FOLDERS } from './data/catalog';
import { useTheme } from './hooks/useTheme';
import { loadBYOKConfig, saveBYOKConfig } from './lib/aiClient';
import { supabase } from './lib/supabase';
import type { ActiveModule, BYOKConfig, StudyFolder, StudyGroup, UserProfile } from './types';

const PROFILE_CACHE_PREFIX = 'cosmolib_profile_';
const FOLDERS_CACHE_PREFIX = 'cosmolib_folders_';

export default function App() {
  const { theme, toggleTheme } = useTheme();
  const [authChecking, setAuthChecking] = useState(true);
  const [authUser, setAuthUser] = useState<{ id: string; email: string } | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [customGroups, setCustomGroups] = useState<StudyGroup[]>([]);
  const [folders, setFolders] = useState<StudyFolder[]>(INITIAL_STUDY_FOLDERS);
  const [activeModule, setActiveModule] = useState<ActiveModule>('dashboard');
  const [activeGroupId, setActiveGroupId] = useState<string>('');
  const [isUltraBlockActive, setIsUltraBlockActive] = useState(false);
  const [byok, setByok] = useState<BYOKConfig>(() => loadBYOKConfig());
  const [byokOpen, setByokOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const allGroups = useMemo(() => {
    const map = new Map<string, StudyGroup>();
    [...customGroups, ...EXPLORE_STUDY_GROUPS].forEach((g) => map.set(g.id, g));
    return Array.from(map.values());
  }, [customGroups]);

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

  // Load own profile (RLS: .eq('id', authUser.id)) + local folder cache when authenticated
  useEffect(() => {
    if (!authUser) return;
    let cancelled = false;

    const loadUserProfile = async () => {
      try {
        const cachedFolders = localStorage.getItem(`${FOLDERS_CACHE_PREFIX}${authUser.id}`);
        if (cachedFolders) {
          setFolders(JSON.parse(cachedFolders) as StudyFolder[]);
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

  if (authChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] text-slate-600 dark:bg-[#0B0F19] dark:text-slate-300">
        <span className="font-mono text-xs">Verifying session...</span>
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

  const navItems: { id: ActiveModule; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'dashboard', label: 'Home Desk', icon: LayoutDashboard },
    { id: 'folders', label: 'AI Study Folders', icon: FolderKanban },
    { id: 'panic', label: 'Exam Panic Mode', icon: Siren },
    { id: 'focus', label: 'Focus & Ultra-Block', icon: Clock },
    { id: 'groups', label: 'Hybrid Group Hub', icon: Users },
  ];

  return (
    <div className="flex min-h-screen bg-[#F8FAFC] text-slate-900 dark:bg-[#0B0F19] dark:text-slate-100">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex dark:border-slate-800 dark:bg-[#0E1422]">
        <div className="flex h-16 items-center px-6 border-b border-slate-200 dark:border-slate-800">
          <span className="font-display text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            COSMOLIB
          </span>
        </div>

        <nav className="flex-1 space-y-1 p-3" aria-label="Primary Workspace Navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeModule === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveModule(item.id)}
                className={`flex w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/70 dark:hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="border-t border-slate-200 p-4 dark:border-slate-800">
          <div className="truncate text-xs font-semibold text-slate-900 dark:text-white">
            {profile.displayName}
          </div>
          <div className="truncate text-[11px] text-slate-500 dark:text-slate-400">
            {profile.institution} · {profile.countryCode}
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Nav Drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-950/60"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="relative z-10 flex w-64 flex-col bg-white p-4 dark:bg-[#0E1422]">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <span className="font-display text-lg font-bold text-slate-900 dark:text-white">
                COSMOLIB
              </span>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                aria-label="Close navigation menu"
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav className="mt-3 flex-1 space-y-1">
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
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${
                      active
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
            <button
              type="button"
              onClick={handleSignOut}
              className="mt-auto inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 py-2 text-xs font-semibold text-slate-700 dark:border-slate-800 dark:text-slate-300"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign Out
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Header */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white/95 px-4 backdrop-blur-xs sm:px-6 dark:border-slate-800 dark:bg-[#0B0F19]/95">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation menu"
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="truncate text-sm font-semibold text-slate-900 dark:text-white">
              {navItems.find((n) => n.id === activeModule)?.label}
            </span>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <PWAInstallButton />

            <button
              type="button"
              onClick={() => setByokOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 whitespace-nowrap dark:border-slate-800 dark:bg-[#111827] dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <KeyRound className="h-3.5 w-3.5 text-indigo-500" />
              <span className="hidden sm:inline">
                {byok.provider === 'default' ? 'Free Pass (BYOK)' : `BYOK: ${byok.provider.toUpperCase()}`}
              </span>
            </button>

            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 whitespace-nowrap dark:border-slate-800 dark:bg-[#111827] dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {theme === 'dark' ? (
                <Sun className="h-3.5 w-3.5 text-amber-400" />
              ) : (
                <Moon className="h-3.5 w-3.5 text-indigo-600" />
              )}
              <span className="hidden sm:inline">{theme === 'dark' ? 'Light' : 'Dark'}</span>
            </button>
          </div>
        </header>

        {/* Active Module Viewport */}
        <main className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6 lg:p-8">
          {activeModule === 'dashboard' && (
            <DashboardHome
              profile={profile}
              folders={folders}
              allGroups={allGroups}
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

          {activeModule === 'panic' && <ExamPanicModule byok={byok} />}

          {activeModule === 'focus' && (
            <FocusTimerModule
              isUltraBlockActive={isUltraBlockActive}
              onUltraBlockChange={setIsUltraBlockActive}
              onLogStudyMinute={handleLogStudyMinute}
            />
          )}

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
