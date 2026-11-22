import type { ConceptItem, StudyGroup, StreamCategory } from '../types';

/**
 * Exam Panic Mode rule:
 * 40 MCQ questions if total exam marks >= 50, else 20 questions.
 */
export function computeExamQuestionCount(totalMarks: number): 40 | 20 {
  if (!Number.isFinite(totalMarks) || totalMarks < 50) {
    return 20;
  }
  return 40;
}

/**
 * Client-side text chunker to reduce AI token payload before sending to Gemini.
 * Deduplicates blank lines, compacts whitespace, and splits into bounded chunks.
 */
export function chunkStudyText(rawText: string, maxChunkChars = 2400, maxChunks = 6): string[] {
  const cleaned = rawText
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!cleaned) return [];

  const paragraphs = cleaned.split(/\n\n+/);
  const chunks: string[] = [];
  let current = '';

  for (const para of paragraphs) {
    const piece = para.length > maxChunkChars ? para.slice(0, maxChunkChars) : para;
    if (!current) {
      current = piece;
    } else if (current.length + piece.length + 2 <= maxChunkChars) {
      current += '\n\n' + piece;
    } else {
      chunks.push(current);
      if (chunks.length >= maxChunks) return chunks;
      current = piece;
    }
  }

  if (current && chunks.length < maxChunks) {
    chunks.push(current);
  }
  return chunks;
}

/**
 * Calculate concept mastery summary from covered/uncovered checklist.
 */
export function calculateConceptMastery(concepts: ConceptItem[]): {
  coveredCount: number;
  uncoveredCount: number;
  totalCount: number;
  percentage: number;
} {
  const totalCount = concepts.length;
  if (totalCount === 0) {
    return { coveredCount: 0, uncoveredCount: 0, totalCount: 0, percentage: 0 };
  }
  const coveredCount = concepts.filter((c) => c.covered).length;
  const uncoveredCount = totalCount - coveredCount;
  const percentage = Math.round((coveredCount / totalCount) * 100);
  return { coveredCount, uncoveredCount, totalCount, percentage };
}

/**
 * Focus Timer break scheduler:
 * Every 30 minutes (1800 seconds) of active focus triggers a 5-minute (300s) break.
 */
export function shouldTriggerScheduledBreak(elapsedFocusSeconds: number): boolean {
  return elapsedFocusSeconds > 0 && elapsedFocusSeconds % 1800 === 0;
}

export function formatTimerDisplay(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(clamped / 3600);
  const mins = Math.floor((clamped % 3600) / 60);
  const secs = clamped % 60;
  const mm = String(mins).padStart(2, '0');
  const ss = String(secs).padStart(2, '0');
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
}

/**
 * Study Buddy 3-hour cooldown & Ultra Block suppression rule.
 * Returns whether a buddy start-studying alert can be dispatched right now.
 */
export const BUDDY_ALERT_COOLDOWN_MS = 3 * 60 * 60 * 1000;

export function canSendBuddyAlert(params: {
  lastAlertSentAt: number | null;
  nowMs: number;
  isUltraBlockActive: boolean;
}): { allowed: boolean; reason: 'ok' | 'ultra_block_suppressed' | 'cooldown'; remainingMs: number } {
  if (params.isUltraBlockActive) {
    return { allowed: false, reason: 'ultra_block_suppressed', remainingMs: 0 };
  }
  if (params.lastAlertSentAt === null) {
    return { allowed: true, reason: 'ok', remainingMs: 0 };
  }
  const elapsed = params.nowMs - params.lastAlertSentAt;
  if (elapsed < BUDDY_ALERT_COOLDOWN_MS) {
    return {
      allowed: false,
      reason: 'cooldown',
      remainingMs: BUDDY_ALERT_COOLDOWN_MS - elapsed,
    };
  }
  return { allowed: true, reason: 'ok', remainingMs: 0 };
}

/**
 * Extract safe 11-character YouTube video ID from standard watch, short, or embed URLs.
 * Blocks non-YouTube domains and javascript:/data: schemes.
 */
export function extractSafeYouTubeId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Direct 11-char ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return null;
  }

  const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
  let candidate: string | null = null;

  if (host === 'youtu.be') {
    candidate = parsed.pathname.split('/').filter(Boolean)[0] ?? null;
  } else if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
    if (parsed.pathname === '/watch') {
      candidate = parsed.searchParams.get('v');
    } else if (parsed.pathname.startsWith('/embed/') || parsed.pathname.startsWith('/shorts/') || parsed.pathname.startsWith('/live/')) {
      candidate = parsed.pathname.split('/')[2] ?? null;
    }
  }

  if (candidate && /^[a-zA-Z0-9_-]{11}$/.test(candidate)) {
    return candidate;
  }
  return null;
}

/**
 * Dynamic Onboarding Group Matchmaker:
 * Generates the user's primary University+Branch Group and Global Common Branch Group.
 */
export function buildMatchedGroups(params: {
  institution: string;
  branch: string;
  country: string;
  streamCategory: StreamCategory;
}): { universityBranchGroup: StudyGroup; globalBranchGroup: StudyGroup } {
  const cleanInst = params.institution.trim() || 'Independent Cohort';
  const cleanBranch = params.branch.trim() || params.streamCategory;
  const slugify = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48);

  const uniGroupId = `uni-${slugify(cleanInst)}-${slugify(cleanBranch)}`;
  const globalGroupId = `global-${slugify(cleanBranch)}`;

  const universityBranchGroup: StudyGroup = {
    id: uniGroupId,
    name: `${cleanInst} · ${cleanBranch}`,
    type: 'university_branch',
    institution: cleanInst,
    branch: cleanBranch,
    country: params.country,
    memberCount: 142,
    activeCams: 18,
    description: `Matched cohort for ${cleanBranch} students at ${cleanInst}. Share campus PYQs, lecture PDFs, and silent cam focus blocks.`,
  };

  const globalBranchGroup: StudyGroup = {
    id: globalGroupId,
    name: `Global ${cleanBranch} Commons`,
    type: 'global_branch',
    branch: cleanBranch,
    memberCount: 2840,
    activeCams: 94,
    description: `Worldwide ${cleanBranch} study network across universities and time zones. 24/7 silent camera rooms and curated formula vaults.`,
  };

  return { universityBranchGroup, globalBranchGroup };
}

/**
 * Score MCQ submission deterministically.
 */
export function scoreMcqAttempt(
  answers: Record<string, number>,
  questions: { id: string; correctIndex: number }[]
): { correct: number; total: number; accuracyPct: number } {
  const total = questions.length;
  if (total === 0) return { correct: 0, total: 0, accuracyPct: 0 };
  let correct = 0;
  for (const q of questions) {
    if (answers[q.id] === q.correctIndex) {
      correct += 1;
    }
  }
  return {
    correct,
    total,
    accuracyPct: Math.round((correct / total) * 100),
  };
}
