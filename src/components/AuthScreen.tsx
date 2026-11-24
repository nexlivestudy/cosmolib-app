import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Mail, Moon, ShieldCheck, Sun } from 'lucide-react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import type { ThemeMode } from '../types';
import { AnimatedBackground } from './AnimatedBackground';
import { COSMO_THEMES } from '../themes';
import { ThemeGallery } from './ThemeGallery';
import { useTheme } from '../hooks/useTheme';
import { PWAInstallButton } from './PWAInstallButton';

interface AuthScreenProps {
  theme: ThemeMode;
  onToggleTheme: () => void;
  onVerifiedSession: (user: { id: string; email: string }) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  theme,
  onToggleTheme,
  onVerifiedSession,
}) => {
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '', '', '']);
  const [cooldown, setCooldown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const supabaseReady = isSupabaseConfigured();
  const { cosmoThemeId, setCosmoTheme } = useTheme();

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => {
      setCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setNotice(null);

    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError('Enter a valid email address to receive your 8-digit verification code.');
      return;
    }

    if (!supabase) {
      setError(
        'Supabase environment variables (VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY) are not configured yet. Add them in Settings > Secrets to enable Email OTP login.'
      );
      return;
    }

    setLoading(true);
    try {
      // Strictly send 8-digit OTP without emailRedirectTo
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          shouldCreateUser: true,
        },
      });
      if (otpError) throw otpError;

      setEmail(normalizedEmail);
      setStep('otp');
      setDigits(['', '', '', '', '', '', '', '']);
      setCooldown(30);
      setNotice(`Verification code sent to ${normalizedEmail}. Check your inbox and spam folder.`);
      window.setTimeout(() => inputRefs.current[0]?.focus(), 80);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send OTP right now.');
    } finally {
      setLoading(false);
    }
  };

  const handleDigitChange = (index: number, value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (!cleaned) {
      const next = [...digits];
      next[index] = '';
      setDigits(next);
      return;
    }

    if (cleaned.length > 1) {
      // Handle pasting full 8-digit OTP
      const next = [...digits];
      for (let i = 0; i < 8; i++) {
        next[i] = cleaned[i] || '';
      }
      setDigits(next);
      const focusIdx = Math.min(7, cleaned.length - 1);
      inputRefs.current[focusIdx]?.focus();
      return;
    }

    const next = [...digits];
    next[index] = cleaned;
    setDigits(next);
    if (index < 7) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleDigitPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 8);
    if (!pasted) return;
    e.preventDefault();
    const next = ['', '', '', '', '', '', '', ''];
    for (let i = 0; i < 8; i++) {
      next[i] = pasted[i] || '';
    }
    setDigits(next);
    const focusIdx = Math.min(7, pasted.length - 1);
    inputRefs.current[focusIdx]?.focus();
  };

  const handleDigitKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 7) {
      e.preventDefault();
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const token = digits.join('');
    if (token.length !== 8) {
      setError('Enter all 8 digits from your verification email.');
      return;
    }
    if (!supabase) {
      setError('Supabase is not configured in environment variables.');
      return;
    }

    setLoading(true);
    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'email',
      });
      if (verifyError) throw verifyError;
      if (!data.user) {
        throw new Error('Verification succeeded but no user session was returned.');
      }
      onVerifiedSession({
        id: data.user.id,
        email: data.user.email || email,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid or expired 8-digit OTP code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-transparent text-slate-900 transition-colors dark:text-slate-100">
      <AnimatedBackground themeId={cosmoThemeId} />
      {/* Top Bar */}
      <header className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-6 py-5">
        <span className="font-display text-xl font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 dark:text-white">
          COSMOLIB
        </span>

        <div className="flex items-center gap-3 shrink-0">
          <PWAInstallButton />
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 whitespace-nowrap shrink-0 dark:border-slate-800 dark:bg-[#111827] dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {theme === 'dark' ? <Sun className="h-3.5 w-3.5 text-amber-400" /> : <Moon className="h-3.5 w-3.5 text-indigo-600" />}
            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </button>
        </div>
      </header>

      {/* Main Split Grid */}
      <main className="mx-auto grid max-w-7xl grid-cols-1 items-stretch gap-8 px-6 pb-12 pt-4 lg:grid-cols-12">
        <div className="col-span-full flex flex-wrap items-center gap-2.5 rounded-2xl border border-slate-200 bg-white/70 px-4 py-3 backdrop-blur-xl dark:border-slate-800 dark:bg-[#111827]/70">
          <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Theme</span>
          {COSMO_THEMES.map((th) => {
            const on = th.id === cosmoThemeId;
            return (
              <button
                key={th.id}
                type="button"
                title={th.name}
                aria-label={'Use ' + th.name + ' theme'}
                aria-pressed={on}
                onClick={() => setCosmoTheme(th.id)}
                className={'h-8 w-8 rounded-full transition-transform hover:scale-110' + (on ? ' ring-2 ring-offset-2 ring-indigo-500 dark:ring-offset-slate-900' : ' ring-1 ring-black/10 dark:ring-white/20')}
                style={{ background: th.preview }}
              />
            );
          })}
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{COSMO_THEMES.find((th) => th.id === cosmoThemeId)?.name}</span>
        </div>
        {/* Left Editorial Visual */}
        <section className="relative flex min-h-[340px] flex-col justify-end overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 sm:min-h-[380px] lg:col-span-7 lg:min-h-[520px] dark:border-slate-800" style={{ borderColor: "color-mix(in srgb, var(--cosmo-accent) 45%, transparent)", boxShadow: "0 0 80px -18px var(--cosmo-glow)" }}>
          <img
            src="/src/assets/images/nexlive_auth_desk_1795318946835.jpg"
            alt="Minimalist late-night COSMOLIB study desk with notebook and lamp"
            referrerPolicy="no-referrer"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F19]/95 via-[#0B0F19]/55 to-[#0B0F19]/15" />
          <div className="relative z-10 p-6 pt-20 sm:p-10 sm:pt-28">
            <p className="text-xs font-medium text-cyan-300">
              Global AI Study Computer · Zero-Distraction Architecture
            </p>
            <h1 className="mt-2 max-w-xl font-display text-2xl font-bold leading-tight text-white sm:text-4xl">
              Lock in every exam, folder, and <span style={{ backgroundImage: "linear-gradient(90deg, var(--cosmo-accent), var(--cosmo-accent2))", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>study room</span> in one place.
            </h1>
            <div className="mt-5 grid max-w-md grid-cols-2 gap-x-6 gap-y-2 text-xs text-slate-300">
              <span>01. AI Smart Study Folders</span>
              <span>02. Exam Panic Mode</span>
              <span>03. Smart Study Schedule</span>
              <span>04. Silent Live-Cam Rooms</span>
            </div>
          </div>
        </section>

        {/* Right Strict Email OTP Panel */}
        <section className="flex flex-col justify-center rounded-2xl border bg-white p-6 sm:p-10 lg:col-span-5 dark:bg-[#111827]/85 dark:backdrop-blur-xl" style={{ borderColor: "color-mix(in srgb, var(--cosmo-accent) 40%, transparent)", boxShadow: "0 0 70px -20px var(--cosmo-glow), 0 24px 60px -24px rgba(0,0,0,.55)" }}>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
            <ShieldCheck className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
            <span>Passwordless Email Verification</span>
          </div>

          <h2 className="mt-3 font-display text-2xl font-bold text-slate-900 dark:text-white">
            {step === 'email' ? 'Sign in or create your study desk' : 'Enter 8-digit verification code'}
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            {step === 'email'
              ? 'We will email you a one-time 8-digit code via Supabase Auth. New students go straight into cohort matching.'
              : `Enter the 8-digit OTP emailed to ${email}.`}
          </p>

          {!supabaseReady && (
            <div
              role="alert"
              className="mt-5 rounded-lg border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
            >
              Supabase Auth requires <code className="font-mono">VITE_SUPABASE_URL</code> and{' '}
              <code className="font-mono">VITE_SUPABASE_ANON_KEY</code> in your environment secrets.
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="mt-5 rounded-lg border border-red-300 bg-red-50 p-3.5 text-xs font-medium text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
            >
              {error}
            </div>
          )}

          {notice && (
            <div
              role="status"
              className="mt-5 flex items-start gap-2 rounded-lg border border-cyan-300 bg-cyan-50 p-3.5 text-xs font-medium text-cyan-900 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-200"
            >
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{notice}</span>
            </div>
          )}

          {step === 'email' ? (
            <form onSubmit={handleSendOtp} className="mt-6 space-y-4">
              <div>
                <label
                  htmlFor="auth-email-input"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Student Email Address
                </label>
                <div className="relative mt-1.5">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="auth-email-input"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@university.edu"
                    className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-[#0B0F19] dark:text-slate-100"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !supabaseReady}
                className="cosmo-btn-3d inline-flex w-full items-center justify-center gap-2 px-4 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span>{loading ? 'Sending Verification OTP...' : 'Send Verification OTP'}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="mt-6 space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  8-Digit Verification Code
                </label>
                <div className="mt-2 grid grid-cols-8 gap-1.5 sm:gap-2">
                  {digits.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => {
                        inputRefs.current[idx] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      autoComplete={idx === 0 ? 'one-time-code' : 'off'}
                      maxLength={8}
                      aria-label={`OTP digit ${idx + 1}`}
                      value={digit}
                      onChange={(e) => handleDigitChange(idx, e.target.value)}
                      onPaste={handleDigitPaste}
                      onKeyDown={(e) => handleDigitKeyDown(idx, e)}
                      className="h-11 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-0 text-center font-mono text-base font-semibold tabular-nums text-slate-900 focus:border-cyan-500 focus:outline-none sm:h-12 sm:text-lg dark:border-slate-700 dark:bg-[#0B0F19] dark:text-white"
                    />
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || digits.join('').length !== 8}
                className="cosmo-btn-3d inline-flex w-full items-center justify-center gap-2 px-4 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span>{loading ? 'Verifying Code...' : 'Verify & Enter COSMOLIB'}</span>
                <ArrowRight className="h-4 w-4" />
              </button>

              <div className="flex items-center justify-between border-t border-slate-200 pt-4 text-xs dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setStep('email');
                    setError(null);
                    setNotice(null);
                  }}
                  className="inline-flex items-center gap-1.5 font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Change Email
                </button>

                <button
                  type="button"
                  disabled={cooldown > 0 || loading}
                  onClick={() => handleSendOtp()}
                  className="font-semibold text-cyan-700 hover:text-cyan-600 disabled:cursor-not-allowed disabled:text-slate-400 dark:text-cyan-400 dark:hover:text-cyan-300 dark:disabled:text-slate-600 tabular-nums"
                >
                  {cooldown > 0 ? `Resend OTP in ${cooldown}s` : 'Resend OTP'}
                </button>
              </div>
            </form>
          )}

          <div className="mt-8 border-t border-slate-200 pt-5 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
            Row-Level Security active · Verified sessions only · Encrypted via Supabase Auth
          </div>
        </section>
      <section className="col-span-full w-full pb-4">
        <ThemeGallery activeId={cosmoThemeId} onSelect={setCosmoTheme} />
      </section>
      </main>
    </div>
  );
};
