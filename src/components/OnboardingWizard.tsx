import React, { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Globe, Moon, Search, Sun, Users } from 'lucide-react';
import {
  detectUserCountry,
  EXPLORE_STUDY_GROUPS,
  getBranchesForDegree,
  getDegreeLevelsForStream,
  getInstitutionsForDegree,
  GLOBAL_COUNTRIES,
} from '../data/catalog';
import type {
  DailyTargetHours,
  StreamCategory,
  StudyGroup,
  StudyVibe,
  ThemeMode,
  UserProfile,
} from '../types';
import { AnimatedBackground } from './AnimatedBackground';
import { sanitizeUserText } from '../utils/security';
import { useTheme } from '../hooks/useTheme';
import { buildMatchedGroups } from '../utils/studyLogic';

interface OnboardingWizardProps {
  userId: string;
  email: string;
  theme: ThemeMode;
  onToggleTheme: () => void;
  onComplete: (profile: UserProfile, createdGroups: StudyGroup[]) => void;
}

const STREAM_LIST: StreamCategory[] = [
  'School / Entrance Boards',
  'Higher Education / Engineering',
  'Government Exams',
  'IT Languages',
  'Custom Self-Study',
];

const TARGET_OPTIONS: { hours: DailyTargetHours; title: string; subtitle: string }[] = [
  { hours: 2, title: '2 Hours', subtitle: 'Steady daily consistency & concept revision' },
  { hours: 4, title: '4 Hours', subtitle: 'Balanced deep work for semester mastery' },
  { hours: 6, title: '6 Hours', subtitle: 'High-intensity exam & competitive prep' },
  { hours: 8, title: '8+ Hours · Beast Mode', subtitle: 'Full-day lock-in sprint with structured breaks' },
];

const CUSTOM_OPTION = '__other__';

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
  userId,
  email,
  theme,
  onToggleTheme,
  onComplete,
}) => {
  const detected = useMemo(() => detectUserCountry(), []);
  const [step, setStep] = useState(1);

  const initialStream: StreamCategory = 'Higher Education / Engineering';
  const initialDegree = getDegreeLevelsForStream(initialStream)[0] ?? '';
  const initialBranches = getBranchesForDegree(initialStream, initialDegree);
  const initialInstitutions = getInstitutionsForDegree(initialStream, initialDegree);

  const [displayName, setDisplayName] = useState(() => email.split('@')[0] || 'Scholar');
  const [countrySearch, setCountrySearch] = useState('');
  const [selectedCountry, setSelectedCountry] = useState(detected);
  const [dailyTarget, setDailyTarget] = useState<DailyTargetHours>(4);
  const [vibe, setVibe] = useState<StudyVibe>('night_cook');
  const [streamCategory, setStreamCategory] = useState<StreamCategory>(initialStream);
  const { cosmoThemeId } = useTheme();
  const [degreeLevel, setDegreeLevel] = useState(initialDegree);
  const [branch, setBranch] = useState(initialBranches[0] ?? CUSTOM_OPTION);
  const [customBranch, setCustomBranch] = useState('');
  const [institution, setInstitution] = useState(initialInstitutions[0] ?? CUSTOM_OPTION);
  const [customInstitution, setCustomInstitution] = useState('');
  const [joinGlobal, setJoinGlobal] = useState(true);
  const [extraGroupIds, setExtraGroupIds] = useState<string[]>([]);

  const filteredCountries = useMemo(() => {
    const q = countrySearch.trim().toLowerCase();
    if (!q) return GLOBAL_COUNTRIES;
    return GLOBAL_COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.region.toLowerCase().includes(q)
    );
  }, [countrySearch]);

  const availableDegrees = useMemo(
    () => getDegreeLevelsForStream(streamCategory),
    [streamCategory]
  );
  const availableBranches = useMemo(
    () => getBranchesForDegree(streamCategory, degreeLevel),
    [streamCategory, degreeLevel]
  );
  const availableInstitutions = useMemo(
    () => getInstitutionsForDegree(streamCategory, degreeLevel),
    [streamCategory, degreeLevel]
  );

  const isCustomBranchActive = branch === CUSTOM_OPTION || availableBranches.length === 0;
  const isCustomInstitutionActive =
    institution === CUSTOM_OPTION || availableInstitutions.length === 0;

  const resolvedBranch = isCustomBranchActive
    ? sanitizeUserText(customBranch, 100)
    : sanitizeUserText(branch, 100);

  const resolvedInstitution =
    sanitizeUserText(customInstitution, 100) ||
    (institution !== CUSTOM_OPTION ? sanitizeUserText(institution, 100) : '');

  const isStep4Valid = Boolean(degreeLevel && resolvedBranch && resolvedInstitution);

  const { universityBranchGroup, globalBranchGroup } = useMemo(
    () =>
      buildMatchedGroups({
        institution: resolvedInstitution || 'Independent Cohort',
        branch: resolvedBranch || degreeLevel || 'General Studies',
        country: selectedCountry.name,
        streamCategory,
      }),
    [resolvedInstitution, resolvedBranch, degreeLevel, selectedCountry.name, streamCategory]
  );

  const handleSelectStream = (cat: StreamCategory) => {
    const nextDegrees = getDegreeLevelsForStream(cat);
    const nextDegree = nextDegrees[0] ?? '';
    const nextBranches = getBranchesForDegree(cat, nextDegree);
    const nextInstitutions = getInstitutionsForDegree(cat, nextDegree);

    setStreamCategory(cat);
    setDegreeLevel(nextDegree);
    setBranch(nextBranches[0] ?? CUSTOM_OPTION);
    setCustomBranch('');
    setInstitution(nextInstitutions[0] ?? CUSTOM_OPTION);
    setCustomInstitution('');
  };

  const handleSelectDegree = (nextDegree: string) => {
    const nextBranches = getBranchesForDegree(streamCategory, nextDegree);
    const nextInstitutions = getInstitutionsForDegree(streamCategory, nextDegree);

    setDegreeLevel(nextDegree);
    setBranch(nextBranches[0] ?? CUSTOM_OPTION);
    setCustomBranch('');
    setInstitution(nextInstitutions[0] ?? CUSTOM_OPTION);
    setCustomInstitution('');
  };

  const toggleExtraGroup = (groupId: string) => {
    setExtraGroupIds((prev) =>
      prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]
    );
  };

  const handleFinish = () => {
    const joined = [
      universityBranchGroup.id,
      ...(joinGlobal ? [globalBranchGroup.id] : []),
      ...extraGroupIds,
    ];
    const uniqueJoined = Array.from(new Set(joined));
    const safeName = sanitizeUserText(displayName, 60) || 'Scholar';

    const profile: UserProfile = {
      id: userId,
      email,
      displayName: safeName,
      country: selectedCountry.name,
      countryCode: selectedCountry.code,
      dailyTargetHours: dailyTarget,
      vibe,
      streamCategory,
      degreeLevel,
      branch: resolvedBranch,
      institution: resolvedInstitution,
      primaryGroupId: universityBranchGroup.id,
      joinedGroupIds: uniqueJoined,
      streakDays: 1,
      minutesStudiedToday: 0,
      onboardingComplete: true,
    };

    onComplete(profile, [universityBranchGroup, globalBranchGroup]);
  };

  return (
    <div className="relative min-h-screen bg-transparent text-slate-900 transition-colors dark:text-slate-100">
      <AnimatedBackground themeId={cosmoThemeId} />
      <header className="mx-auto flex max-w-4xl items-center justify-between gap-6 px-6 py-5">
        <span className="font-display text-xl font-bold tracking-tight text-slate-900 dark:text-white">
          COSMOLIB
        </span>
        <div className="flex items-center gap-4">
          <span className="font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
            Step {step} of 5
          </span>
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-[#111827] dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {theme === 'dark' ? <Sun className="h-3.5 w-3.5 text-amber-400" /> : <Moon className="h-3.5 w-3.5 text-indigo-600" />}
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 pb-16 pt-2">
        {/* Progress Bar */}
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
          <div
            className="h-full bg-cyan-500 transition-all duration-300"
            style={{ width: `${(step / 5) * 100}%` }}
          />
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 dark:border-slate-800 dark:bg-[#111827]">
          {/* Step 1: Auto-Detect Country + Searchable Global Selector */}
          {step === 1 && (
            <div>
              <div className="flex items-center gap-2 text-xs font-medium text-cyan-700 dark:text-cyan-400">
                <Globe className="h-4 w-4" />
                <span>Step 1 · Country & Identity</span>
              </div>
              <h1 className="mt-2 font-display text-2xl font-bold sm:text-3xl">
                Where are you studying from?
              </h1>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Auto-detected <strong className="text-slate-900 dark:text-white">{detected.name}</strong> from your local timezone. Adjust your display name or pick any country below.
              </p>

              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="onboard-name" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Display Name
                  </label>
                  <input
                    id="onboard-name"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your study handle"
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-[#0B0F19] dark:text-white"
                  />
                </div>
                <div>
                  <label htmlFor="country-search" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Search Global Countries
                  </label>
                  <div className="relative mt-1.5">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      id="country-search"
                      type="text"
                      value={countrySearch}
                      onChange={(e) => setCountrySearch(e.target.value)}
                      placeholder="India, United States, Germany..."
                      className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-[#0B0F19] dark:text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-4 grid max-h-64 grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
                {filteredCountries.map((c) => {
                  const active = selectedCountry.code === c.code;
                  return (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => setSelectedCountry(c)}
                      className={`flex items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                        active
                          ? 'border-cyan-500 bg-cyan-500/10 font-semibold text-slate-900 dark:text-white'
                          : 'border-slate-200 bg-slate-50/70 text-slate-700 hover:border-slate-300 dark:border-slate-800 dark:bg-[#0B0F19]/60 dark:text-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <span className="truncate">{c.name}</span>
                      <span className="font-mono text-xs text-slate-400">{c.code}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 2: Question 1 (Daily Target) */}
          {step === 2 && (
            <div>
              <p className="text-xs font-medium text-cyan-700 dark:text-cyan-400">
                Step 2 · Daily Commitment
              </p>
              <h1 className="mt-2 font-display text-2xl font-bold sm:text-3xl">
                How many hours of practice are you locking in today?
              </h1>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                COSMOLIB calibrates your focus blocks, break cycles, and daily streak goal around this target.
              </p>

              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {TARGET_OPTIONS.map((opt) => {
                  const active = dailyTarget === opt.hours;
                  return (
                    <button
                      key={opt.hours}
                      type="button"
                      onClick={() => setDailyTarget(opt.hours)}
                      className={`rounded-xl border p-5 text-left transition-colors ${
                        active
                          ? 'border-cyan-500 bg-cyan-500/10 text-slate-900 dark:text-white'
                          : 'border-slate-200 bg-slate-50/70 text-slate-700 hover:border-slate-300 dark:border-slate-800 dark:bg-[#0B0F19]/60 dark:text-slate-300'
                      }`}
                    >
                      <div className="font-display text-xl font-bold tabular-nums">{opt.title}</div>
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{opt.subtitle}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 3: Question 2 (Vibe Check) */}
          {step === 3 && (
            <div>
              <p className="text-xs font-medium text-cyan-700 dark:text-cyan-400">
                Step 3 · Study Rhythm
              </p>
              <h1 className="mt-2 font-display text-2xl font-bold sm:text-3xl">
                Are you ready to cook your night?
              </h1>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Choose your primary focus rhythm so COSMOLIB surfaces matching live-cam peers and themes.
              </p>

              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setVibe('night_cook')}
                  className={`rounded-xl border p-6 text-left transition-colors ${
                    vibe === 'night_cook'
                      ? 'border-cyan-500 bg-cyan-500/10'
                      : 'border-slate-200 bg-slate-50/70 hover:border-slate-300 dark:border-slate-800 dark:bg-[#0B0F19]/60'
                  }`}
                >
                  <div className="font-display text-xl font-bold text-slate-900 dark:text-white">
                    Yes, let&apos;s lock in
                  </div>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                    Late-night obsidian focus blocks, Lo-Fi & 40Hz binaural audio, and overnight global study rooms.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setVibe('early_bird')}
                  className={`rounded-xl border p-6 text-left transition-colors ${
                    vibe === 'early_bird'
                      ? 'border-cyan-500 bg-cyan-500/10'
                      : 'border-slate-200 bg-slate-50/70 hover:border-slate-300 dark:border-slate-800 dark:bg-[#0B0F19]/60'
                  }`}
                >
                  <div className="font-display text-xl font-bold text-slate-900 dark:text-white">
                    Early Bird Grind
                  </div>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                    Crisp sunrise review blocks, structured morning concept drills, and high-clarity daylight sessions.
                  </p>
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Question 3 (Dynamic Stream, Degree & Institution Matchmaker) */}
          {step === 4 && (
            <div>
              <p className="text-xs font-medium text-cyan-700 dark:text-cyan-400">
                Step 4 · Academic & Cohort Matchmaker
              </p>
              <h1 className="mt-2 font-display text-2xl font-bold sm:text-3xl">
                Select your track, branch, and institution
              </h1>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                We automatically create or match your University + Branch cohort and your Global Common Branch hub.
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                {STREAM_LIST.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => handleSelectStream(cat)}
                    className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                      streamCategory === cat
                        ? 'border-indigo-500 bg-indigo-600 text-white'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-[#0B0F19] dark:text-slate-300'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="onboard-degree" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Degree / Exam Level
                  </label>
                  <select
                    id="onboard-degree"
                    value={degreeLevel}
                    onChange={(e) => handleSelectDegree(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-[#0B0F19] dark:text-white"
                  >
                    {availableDegrees.map((lvl) => (
                      <option key={lvl} value={lvl}>
                        {lvl}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="onboard-branch" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Branch / Specialization
                  </label>
                  <select
                    id="onboard-branch"
                    value={branch}
                    onChange={(e) => {
                      setBranch(e.target.value);
                      if (e.target.value !== CUSTOM_OPTION) setCustomBranch('');
                    }}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-[#0B0F19] dark:text-white"
                  >
                    {availableBranches.length === 0 ? (
                      <option value={CUSTOM_OPTION}>No preset branches — Enter custom below</option>
                    ) : (
                      <>
                        {availableBranches.map((b) => (
                          <option key={b} value={b}>
                            {b}
                          </option>
                        ))}
                        <option value={CUSTOM_OPTION}>Other (Custom Specialization)</option>
                      </>
                    )}
                  </select>
                  {isCustomBranchActive && (
                    <div className="mt-2">
                      {availableBranches.length === 0 && (
                        <p className="mb-1.5 text-xs text-amber-700 dark:text-amber-300">
                          No preset branches mapped for {degreeLevel}. Enter your specialization below.
                        </p>
                      )}
                      <input
                        id="onboard-custom-branch"
                        type="text"
                        value={customBranch}
                        onChange={(e) => setCustomBranch(e.target.value)}
                        placeholder={`Enter your ${degreeLevel} specialization`}
                        aria-label="Custom Branch or Specialization"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-[#0B0F19] dark:text-white"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label htmlFor="onboard-inst" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    University / Institution Directory
                  </label>
                  <select
                    id="onboard-inst"
                    value={institution}
                    onChange={(e) => {
                      setInstitution(e.target.value);
                      if (e.target.value !== CUSTOM_OPTION) setCustomInstitution('');
                    }}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-[#0B0F19] dark:text-white"
                  >
                    {availableInstitutions.length === 0 ? (
                      <option value={CUSTOM_OPTION}>No preset institutions — Enter custom below</option>
                    ) : (
                      <>
                        {availableInstitutions.map((inst) => (
                          <option key={inst} value={inst}>
                            {inst}
                          </option>
                        ))}
                        <option value={CUSTOM_OPTION}>Other (Enter Custom Institution)</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label htmlFor="onboard-custom-inst" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {isCustomInstitutionActive
                      ? 'Enter Your Exact University / Institution'
                      : 'Or Type Your Exact University / School'}
                  </label>
                  {availableInstitutions.length === 0 && (
                    <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                      No preset directory entries for {degreeLevel}. Type your institution below.
                    </p>
                  )}
                  <input
                    id="onboard-custom-inst"
                    type="text"
                    value={customInstitution}
                    onChange={(e) => setCustomInstitution(e.target.value)}
                    placeholder={
                      isCustomInstitutionActive
                        ? `Enter your ${degreeLevel} institution`
                        : 'Optional custom institution name'
                    }
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-[#0B0F19] dark:text-white"
                  />
                </div>
              </div>
              {!isStep4Valid && (
                <p className="mt-3 text-xs font-medium text-amber-700 dark:text-amber-300">
                  Enter your custom branch and institution to continue to cohort matching.
                </p>
              )}
            </div>
          )}

          {/* Step 5: Group Placement & Discovery */}
          {step === 5 && (
            <div>
              <div className="flex items-center gap-2 text-xs font-medium text-cyan-700 dark:text-cyan-400">
                <Users className="h-4 w-4" />
                <span>Step 5 · Automatic Cohort Placement</span>
              </div>
              <h1 className="mt-2 font-display text-2xl font-bold sm:text-3xl">
                Your matched study rooms are ready
              </h1>

              <div className="mt-5 space-y-4">
                <div className="rounded-xl border border-cyan-500/60 bg-cyan-500/5 p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold text-cyan-700 dark:text-cyan-400">
                        Primary Auto-Matched Cohort · University + Branch
                      </p>
                      <h2 className="mt-1 font-display text-lg font-bold text-slate-900 dark:text-white">
                        {universityBranchGroup.name}
                      </h2>
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                        {universityBranchGroup.description}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-700 whitespace-nowrap dark:text-cyan-400">
                      <Check className="h-4 w-4" /> Auto-Joined
                    </span>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-5 dark:border-slate-800 dark:bg-[#0B0F19]/60">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="max-w-xl">
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        Featured Global Commons · {globalBranchGroup.memberCount.toLocaleString()} scholars · {globalBranchGroup.activeCams} live cams
                      </p>
                      <h3 className="mt-1 font-display text-base font-bold text-slate-900 dark:text-white">
                        {globalBranchGroup.name}
                      </h3>
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                        {globalBranchGroup.description}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setJoinGlobal((prev) => !prev)}
                      className={`rounded-lg px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                        joinGlobal
                          ? 'bg-indigo-600 text-white hover:bg-indigo-500'
                          : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
                      }`}
                    >
                      {joinGlobal ? 'Joined Global Group' : 'Join Global Group'}
                    </button>
                  </div>
                </div>

                <div className="pt-2">
                  <h3 className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    Explore & Join Additional Global Groups
                  </h3>
                  <div className="mt-2 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {EXPLORE_STUDY_GROUPS.map((g) => {
                      const joined = extraGroupIds.includes(g.id);
                      return (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => toggleExtraGroup(g.id)}
                          className={`rounded-lg border p-3.5 text-left transition-colors ${
                            joined
                              ? 'border-indigo-500 bg-indigo-500/10'
                              : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-[#0B0F19]/40 dark:hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold text-slate-900 dark:text-white">
                              {g.name}
                            </span>
                            <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                              {joined ? 'Added' : '+ Join'}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                            {g.memberCount.toLocaleString()} members · {g.activeCams} active cams
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Footer Navigation */}
          <div className="mt-8 flex items-center justify-between border-t border-slate-200 pt-5 dark:border-slate-800">
            <button
              type="button"
              disabled={step === 1}
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>

            {step < 5 ? (
              <button
                type="button"
                disabled={step === 4 && !isStep4Valid}
                onClick={() => setStep((s) => Math.min(5, s + 1))}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-45"
              >
                Continue
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinish}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500"
              >
                Launch COSMOLIB Workspace
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};
