import type { BYOKConfig, GeneratedSubfolders, MasterRescuePack, WrittenGradeResult } from '../types';

const BYOK_STORAGE_KEY = 'cosmolib_byok_config';

export function loadBYOKConfig(): BYOKConfig {
  try {
    const raw = localStorage.getItem(BYOK_STORAGE_KEY);
    if (!raw) return { provider: 'default', apiKey: '' };
    const parsed = JSON.parse(raw) as BYOKConfig;
    return {
      provider: parsed.provider || 'default',
      apiKey: parsed.apiKey || '',
      modelOverride: parsed.modelOverride || '',
    };
  } catch {
    return { provider: 'default', apiKey: '' };
  }
}

export function saveBYOKConfig(config: BYOKConfig): void {
  try {
    localStorage.setItem(BYOK_STORAGE_KEY, JSON.stringify(config));
  } catch {
    // ignore storage quota error
  }
}

function buildHeaders(byok: BYOKConfig): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (byok.provider !== 'default' && byok.apiKey.trim()) {
    headers['x-byok-provider'] = byok.provider;
    headers['x-byok-key'] = byok.apiKey.trim();
    if (byok.modelOverride?.trim()) {
      headers['x-byok-model'] = byok.modelOverride.trim();
    }
  }
  return headers;
}

async function postAI<T>(endpoint: string, payload: unknown, byok: BYOKConfig): Promise<T> {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: buildHeaders(byok),
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      typeof data?.error === 'string'
        ? data.error
        : `AI request failed (${res.status})`;
    throw new Error(message);
  }
  return data as T;
}

export async function generateFolderSubfolders(
  params: {
    folderName: string;
    subjectTag: string;
    chunks: string[];
    resourceTitles: string[];
  },
  byok: BYOKConfig
): Promise<{
  subfolders: GeneratedSubfolders;
  concepts: { title: string; difficulty: 'Core' | 'High Yield' | 'Advanced'; estimatedMins: number }[];
}> {
  return postAI('/api/ai/study-folder', params, byok);
}

export async function generateYouTubeNotes(
  params: { title: string; videoId: string; topicHint?: string },
  byok: BYOKConfig
): Promise<{ syncedNotes: { timestamp: string; note: string }[] }> {
  return postAI('/api/ai/youtube-notes', params, byok);
}

export async function generateExamPanicPack(
  params: {
    subject: string;
    totalMarks: number;
    syllabus: string;
    notes: string;
    pyqs: string;
  },
  byok: BYOKConfig
): Promise<MasterRescuePack> {
  return postAI('/api/ai/exam-panic', params, byok);
}

export async function askRoomAssistant(
  params: { question: string; roomTopic?: string; history?: string[] },
  byok: BYOKConfig
): Promise<{ answer: string }> {
  return postAI('/api/ai/room-assistant', params, byok);
}

export async function gradeWrittenAnswer(
  params: {
    subject: string;
    question: string;
    rubric: string[];
    maxMarks: number;
    imageBase64: string;
    mimeType: string;
  },
  byok: BYOKConfig
): Promise<WrittenGradeResult> {
  return postAI('/api/ai/grade-written', params, byok);
}
