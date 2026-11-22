import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

// Security Headers + Content-Security-Policy (no inline secrets, HTTPS PWA enforcement)
app.use((req: Request, res: Response, next: NextFunction) => {
  const supabaseOrigin = process.env.VITE_SUPABASE_URL
    ? (() => {
        try {
          return new URL(process.env.VITE_SUPABASE_URL).origin;
        } catch {
          return 'https://*.supabase.co';
        }
      })()
    : 'https://*.supabase.co';

  const supabaseWs = supabaseOrigin.replace(/^https:/, 'wss:');

  const scriptSrc = IS_PROD
    ? "'self'"
    : "'self' 'unsafe-inline' 'unsafe-eval'";

  const devConnect = IS_PROD ? '' : ' ws://localhost:* http://localhost:*';

  const cspDirectives = [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https://*.supabase.co https://i.ytimg.com",
    "media-src 'self' blob: https://*.supabase.co",
    "frame-src https://www.youtube-nocookie.com https://www.youtube.com",
    `connect-src 'self'${devConnect} ${supabaseOrigin} ${supabaseWs} https://0.peerjs.com wss://0.peerjs.com https://fonts.googleapis.com https://fonts.gstatic.com`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    ...(IS_PROD ? ['upgrade-insecure-requests'] : []),
  ].join('; ');

  res.setHeader('Content-Security-Policy', cspDirectives);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Camera allowed for Silent Live-Cam Grid; microphone strictly disabled at browser policy level
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()');
  if (IS_PROD) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  next();
});

app.use(express.json({ limit: '12mb' }));

// Simple per-IP rate limiter for AI endpoints
const rateBuckets = new Map<string, { count: number; resetAt: number }>();
function aiRateLimit(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || 'unknown';
  const now = Date.now();
  const bucket = rateBuckets.get(ip);
  if (!bucket || now > bucket.resetAt) {
    rateBuckets.set(ip, { count: 1, resetAt: now + 60_000 });
    return next();
  }
  if (bucket.count >= 25) {
    return res.status(429).json({ error: 'Rate limit exceeded. Please wait a minute before trying again.' });
  }
  bucket.count += 1;
  return next();
}

function getGeminiClient(overrideKey?: string): GoogleGenAI {
  const apiKey = (overrideKey && overrideKey.trim()) || process.env.GEMINI_API_KEY || '';
  if (!apiKey) {
    throw new Error('Server AI engine is not configured. Check GEMINI_API_KEY in Settings > Secrets or add a personal key in Student Free Pass (BYOK).');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function extractByok(req: Request): { provider: 'default' | 'gemini' | 'groq' | 'openrouter'; apiKey?: string; modelOverride?: string } {
  const rawProvider = String(req.headers['x-byok-provider'] || 'default').toLowerCase();
  const rawKey = typeof req.headers['x-byok-key'] === 'string' ? req.headers['x-byok-key'].trim() : '';
  const modelOverride = typeof req.headers['x-byok-model'] === 'string' ? req.headers['x-byok-model'].trim() : undefined;

  if ((rawProvider === 'gemini' || rawProvider === 'groq' || rawProvider === 'openrouter') && rawKey) {
    return { provider: rawProvider, apiKey: rawKey, modelOverride };
  }
  return { provider: 'default' };
}

/**
 * Call allowlisted OpenAI-compatible BYOK providers (Groq / OpenRouter) for text JSON generation.
 */
async function callOpenAICompatibleJson(params: {
  provider: 'groq' | 'openrouter';
  apiKey: string;
  model?: string;
  systemInstruction: string;
  userPrompt: string;
}): Promise<string> {
  const endpoint =
    params.provider === 'groq'
      ? 'https://api.groq.com/openai/v1/chat/completions'
      : 'https://openrouter.ai/api/v1/chat/completions';

  const defaultModel =
    params.provider === 'groq'
      ? 'llama-3.3-70b-versatile'
      : 'google/gemini-2.5-flash';

  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify({
      model: params.model || defaultModel,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: params.systemInstruction },
        { role: 'user', content: params.userPrompt },
      ],
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    throw new Error(`${params.provider.toUpperCase()} BYOK request failed (${resp.status}): ${errText.slice(0, 180)}`);
  }

  const data = (await resp.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error(`${params.provider.toUpperCase()} returned an empty response.`);
  }
  return content;
}

function safeJsonParse<T>(raw: string): T {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim();
  return JSON.parse(cleaned) as T;
}

function stripTagsServer(input: unknown, maxLen = 8000): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/<[^>]*>/g, '')
    .trim()
    .slice(0, maxLen);
}

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    ok: true,
    aiEngineConfigured: Boolean(process.env.GEMINI_API_KEY),
    supabaseConfigured: Boolean(process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_ANON_KEY),
  });
});

// 1. AI Smart Study Folder Subfolder Generator
app.post('/api/ai/study-folder', aiRateLimit, async (req: Request, res: Response) => {
  try {
    const folderName = stripTagsServer(req.body?.folderName, 140);
    const subjectTag = stripTagsServer(req.body?.subjectTag, 80);
    const rawChunks = Array.isArray(req.body?.chunks) ? req.body.chunks : [];
    const chunks = rawChunks.slice(0, 6).map((c: unknown) => stripTagsServer(c, 2600)).filter(Boolean);
    const rawTitles = Array.isArray(req.body?.resourceTitles) ? req.body.resourceTitles : [];
    const resourceTitles = rawTitles.slice(0, 15).map((t: unknown) => stripTagsServer(t, 120)).filter(Boolean);

    if (!folderName) {
      return res.status(400).json({ error: 'Folder name is required.' });
    }

    const byok = extractByok(req);
    const contextText =
      chunks.length > 0
        ? chunks.join('\n\n---\n\n')
        : `Topic: ${folderName} (${subjectTag || 'General Studies'}). Resources: ${resourceTitles.join(', ') || 'Core syllabus overview'}.`;

    const systemInstruction =
      'You are NEXLIVE, a rigorous university study architect. Return strictly valid JSON matching the requested schema. Keep explanations crisp, high-yield, and exam-focused.';

    const prompt = `Build automated AI study subfolders for folder "${folderName}" (Subject: ${subjectTag || 'General'}).\n\nSource material chunks:\n${contextText}\n\nGenerate:\n1. strategyPlan: 3-4 concrete study phases with duration, objective, and 3 actions each.\n2. easyConceptPdfs: 3-4 clean study sheets (title, summary, explanation, workedExample, keyTakeaway).\n3. formulasVault: 4-6 high-yield formulas, rules, or shortcuts (label, expression, whenToUse, trapToAvoid).\n4. concepts: 6-8 trackable concepts (title, difficulty: "Core"|"High Yield"|"Advanced", estimatedMins).`;

    let jsonText = '';

    if (byok.provider === 'groq' || byok.provider === 'openrouter') {
      jsonText = await callOpenAICompatibleJson({
        provider: byok.provider,
        apiKey: byok.apiKey!,
        model: byok.modelOverride,
        systemInstruction,
        userPrompt: `${prompt}\n\nReturn JSON with exact keys: { "strategyPlan": [...], "easyConceptPdfs": [...], "formulasVault": [...], "concepts": [...] }.`,
      });
    } else {
      const ai = getGeminiClient(byok.provider === 'gemini' ? byok.apiKey : undefined);
      const response = await ai.models.generateContent({
        model: byok.modelOverride || 'gemini-2.5-flash',
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              strategyPlan: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    phase: { type: Type.STRING },
                    duration: { type: Type.STRING },
                    objective: { type: Type.STRING },
                    actions: { type: Type.ARRAY, items: { type: Type.STRING } },
                  },
                  required: ['phase', 'duration', 'objective', 'actions'],
                },
              },
              easyConceptPdfs: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    summary: { type: Type.STRING },
                    explanation: { type: Type.STRING },
                    workedExample: { type: Type.STRING },
                    keyTakeaway: { type: Type.STRING },
                  },
                  required: ['title', 'summary', 'explanation', 'workedExample', 'keyTakeaway'],
                },
              },
              formulasVault: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    label: { type: Type.STRING },
                    expression: { type: Type.STRING },
                    whenToUse: { type: Type.STRING },
                    trapToAvoid: { type: Type.STRING },
                  },
                  required: ['label', 'expression', 'whenToUse', 'trapToAvoid'],
                },
              },
              concepts: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    difficulty: { type: Type.STRING },
                    estimatedMins: { type: Type.INTEGER },
                  },
                  required: ['title', 'difficulty', 'estimatedMins'],
                },
              },
            },
            required: ['strategyPlan', 'easyConceptPdfs', 'formulasVault', 'concepts'],
          },
        },
      });
      jsonText = response.text || '';
    }

    const parsed = safeJsonParse<{
      strategyPlan: unknown[];
      easyConceptPdfs: unknown[];
      formulasVault: unknown[];
      concepts: { title: string; difficulty: string; estimatedMins: number }[];
    }>(jsonText);

    res.json({
      subfolders: {
        generatedAt: new Date().toISOString(),
        strategyPlan: parsed.strategyPlan || [],
        easyConceptPdfs: parsed.easyConceptPdfs || [],
        formulasVault: parsed.formulasVault || [],
      },
      concepts: (parsed.concepts || []).map((c) => ({
        title: c.title,
        difficulty:
          c.difficulty === 'High Yield' || c.difficulty === 'Advanced' ? c.difficulty : 'Core',
        estimatedMins: Math.max(5, Math.min(180, Number(c.estimatedMins) || 20)),
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate AI study subfolders.';
    res.status(502).json({ error: message });
  }
});

// 2. YouTube Synced AI Study Notes
app.post('/api/ai/youtube-notes', aiRateLimit, async (req: Request, res: Response) => {
  try {
    const title = stripTagsServer(req.body?.title, 180);
    const videoId = stripTagsServer(req.body?.videoId, 20);
    const topicHint = stripTagsServer(req.body?.topicHint, 300);

    if (!title || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
      return res.status(400).json({ error: 'Valid YouTube video title and video ID are required.' });
    }

    const byok = extractByok(req);
    const systemInstruction = 'You are NEXLIVE, generating structured timestamped study notes for a distraction-free lecture player. Return valid JSON.';
    const prompt = `Create 6 concise timestamped study checkpoints for the lecture "${title}" (Topic context: ${topicHint || title}). Each item must have "timestamp" (like "00:00", "04:15", "09:40", etc.) and "note" (actionable exam-focused summary).`;

    let jsonText = '';
    if (byok.provider === 'groq' || byok.provider === 'openrouter') {
      jsonText = await callOpenAICompatibleJson({
        provider: byok.provider,
        apiKey: byok.apiKey!,
        model: byok.modelOverride,
        systemInstruction,
        userPrompt: `${prompt}\nReturn JSON: { "syncedNotes": [{ "timestamp": "00:00", "note": "..." }] }`,
      });
    } else {
      const ai = getGeminiClient(byok.provider === 'gemini' ? byok.apiKey : undefined);
      const response = await ai.models.generateContent({
        model: byok.modelOverride || 'gemini-2.5-flash',
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              syncedNotes: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    timestamp: { type: Type.STRING },
                    note: { type: Type.STRING },
                  },
                  required: ['timestamp', 'note'],
                },
              },
            },
            required: ['syncedNotes'],
          },
        },
      });
      jsonText = response.text || '';
    }

    const parsed = safeJsonParse<{ syncedNotes: { timestamp: string; note: string }[] }>(jsonText);
    res.json({ syncedNotes: parsed.syncedNotes || [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate synced video notes.';
    res.status(502).json({ error: message });
  }
});

// 3. One-Shot Exam Panic Mode — Master Rescue Pack + 40/20 Questions
app.post('/api/ai/exam-panic', aiRateLimit, async (req: Request, res: Response) => {
  try {
    const subject = stripTagsServer(req.body?.subject, 140);
    const totalMarks = Number(req.body?.totalMarks);
    const syllabus = stripTagsServer(req.body?.syllabus, 5000);
    const notes = stripTagsServer(req.body?.notes, 5000);
    const pyqs = stripTagsServer(req.body?.pyqs, 5000);

    if (!subject || !Number.isFinite(totalMarks) || totalMarks <= 0) {
      return res.status(400).json({ error: 'Subject name and positive total exam marks are required.' });
    }

    const targetMcqCount = totalMarks >= 50 ? 40 : 20;
    const byok = extractByok(req);

    const systemInstruction =
      'You are NEXLIVE Exam Rescue Engine. Build a comprehensive, exam-ready Master Rescue Pack as strict JSON. Every Q&A MUST include a crisp lockInBox memory anchor. Every MCQ MUST have exactly 4 options (A-D) and a valid correctIndex (0-3).';

    const prompt = `Subject: ${subject}
Total Exam Marks: ${totalMarks}
Required MCQ Count: EXACTLY ${targetMcqCount} questions (${totalMarks >= 50 ? 'marks >= 50 rule' : 'marks < 50 rule'}).
Syllabus:
${syllabus || 'Standard university/board core syllabus for ' + subject}

Notes:
${notes || 'Focus on core definitions, theorems, derivations, and high-frequency exam applications.'}

Previous Year Questions (PYQs):
${pyqs || 'Prioritize classic high-frequency board/university exam questions.'}

Generate strictly valid JSON containing:
1. crashPlan: 4 time-boxed crash slots (slot, focus, deliverable)
2. highYieldTopics: 6 topics. For EACH topic include:
   - topic: concise single concept title
   - repeatTag: e.g. "Repeated 5x", "Asked 4x", "High Yield"
   - priority: "Critical" | "High" | "Medium"
   - fullExplanation: thorough, easy-to-follow exam explanation covering ONLY this single concept (120-200 words)
   - keyPoints: 3-4 crisp bullet points for exam scoring covering ONLY this concept
   - workedExample: 1 concrete short worked example, formula walkthrough, or exam illustration for this concept
   - youtubeQuery: a focused YouTube search query targeting a short, easy tutorial that explains ONLY this specific concept (e.g. "${subject} <exact concept> explained easy example" — never a full-course or one-shot playlist query)
3. qaPairs: 8 high-yield exam Q&A pairs. Each has id, question, repeatTag, marksWeight, answer (concise step-by-step), and lockInBox ({ memoryAnchor, keyFormulaOrRule, examCheck })
4. mcqQuestions: EXACTLY ${targetMcqCount} concise, distinct MCQ questions (id, question, options [4 strings], correctIndex 0-3, explanation, topic, repeatTag)
5. writtenPrompts: 4 subjective exam questions (id, question, maxMarks, rubric [3-4 marking points])`;

    let jsonText = '';
    if (byok.provider === 'groq' || byok.provider === 'openrouter') {
      jsonText = await callOpenAICompatibleJson({
        provider: byok.provider,
        apiKey: byok.apiKey!,
        model: byok.modelOverride,
        systemInstruction,
        userPrompt: prompt,
      });
    } else {
      const ai = getGeminiClient(byok.provider === 'gemini' ? byok.apiKey : undefined);
      const response = await ai.models.generateContent({
        model: byok.modelOverride || 'gemini-2.5-flash',
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              crashPlan: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    slot: { type: Type.STRING },
                    focus: { type: Type.STRING },
                    deliverable: { type: Type.STRING },
                  },
                  required: ['slot', 'focus', 'deliverable'],
                },
              },
              highYieldTopics: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    topic: { type: Type.STRING },
                    repeatTag: { type: Type.STRING },
                    priority: { type: Type.STRING },
                    fullExplanation: { type: Type.STRING },
                    keyPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
                    workedExample: { type: Type.STRING },
                    youtubeQuery: { type: Type.STRING },
                  },
                  required: [
                    'topic',
                    'repeatTag',
                    'priority',
                    'fullExplanation',
                    'keyPoints',
                    'workedExample',
                    'youtubeQuery',
                  ],
                },
              },
              qaPairs: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    question: { type: Type.STRING },
                    repeatTag: { type: Type.STRING },
                    marksWeight: { type: Type.STRING },
                    answer: { type: Type.STRING },
                    lockInBox: {
                      type: Type.OBJECT,
                      properties: {
                        memoryAnchor: { type: Type.STRING },
                        keyFormulaOrRule: { type: Type.STRING },
                        examCheck: { type: Type.STRING },
                      },
                      required: ['memoryAnchor', 'keyFormulaOrRule', 'examCheck'],
                    },
                  },
                  required: ['id', 'question', 'repeatTag', 'marksWeight', 'answer', 'lockInBox'],
                },
              },
              mcqQuestions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    question: { type: Type.STRING },
                    options: { type: Type.ARRAY, items: { type: Type.STRING } },
                    correctIndex: { type: Type.INTEGER },
                    explanation: { type: Type.STRING },
                    topic: { type: Type.STRING },
                    repeatTag: { type: Type.STRING },
                  },
                  required: ['id', 'question', 'options', 'correctIndex', 'explanation', 'topic', 'repeatTag'],
                },
              },
              writtenPrompts: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    question: { type: Type.STRING },
                    maxMarks: { type: Type.INTEGER },
                    rubric: { type: Type.ARRAY, items: { type: Type.STRING } },
                  },
                  required: ['id', 'question', 'maxMarks', 'rubric'],
                },
              },
            },
            required: ['crashPlan', 'highYieldTopics', 'qaPairs', 'mcqQuestions', 'writtenPrompts'],
          },
        },
      });
      jsonText = response.text || '';
    }

    const parsed = safeJsonParse<{
      crashPlan: unknown[];
      highYieldTopics: {
        topic: string;
        repeatTag: string;
        priority: string;
        fullExplanation?: string;
        keyPoints?: string[];
        workedExample?: string;
        youtubeQuery?: string;
      }[];
      qaPairs: unknown[];
      mcqQuestions: {
        id: string;
        question: string;
        options: string[];
        correctIndex: number;
        explanation: string;
        topic: string;
        repeatTag: string;
      }[];
      writtenPrompts: unknown[];
    }>(jsonText);

    // Resolve single-concept embeddable YouTube videos in parallel for each high-yield topic
    const normalizedHighYieldTopics = await Promise.all(
      (parsed.highYieldTopics || []).slice(0, 8).map(async (t) => {
        const cleanTopic = stripTagsServer(t.topic, 160) || subject;
        const cleanQuery =
          stripTagsServer(t.youtubeQuery, 160) || `${cleanTopic} ${subject} easy explanation`;
        const priority =
          t.priority === 'Critical' || t.priority === 'High' || t.priority === 'Medium'
            ? t.priority
            : 'High';
        const resolvedVideo = await resolveConceptYouTubeVideo(cleanQuery);
        return {
          topic: cleanTopic,
          repeatTag: stripTagsServer(t.repeatTag, 40) || 'High Yield',
          priority,
          fullExplanation:
            stripTagsServer(t.fullExplanation, 2000) ||
            `Core exam concept in ${subject}: review definitions, rules, and worked applications of ${cleanTopic}.`,
          keyPoints: Array.isArray(t.keyPoints)
            ? t.keyPoints.slice(0, 5).map((kp) => stripTagsServer(kp, 240)).filter(Boolean)
            : [],
          workedExample: stripTagsServer(t.workedExample, 1000) || undefined,
          youtubeQuery: cleanQuery,
          youtubeVideoId: resolvedVideo?.videoId,
          videoTitle: resolvedVideo?.title,
        };
      })
    );

    // Ensure MCQ list normalizes 4 options and strict indexing
    const normalizedMcqs = (parsed.mcqQuestions || []).slice(0, targetMcqCount).map((q, idx) => {
      const opts = Array.isArray(q.options) ? q.options.slice(0, 4) : ['Option A', 'Option B', 'Option C', 'Option D'];
      while (opts.length < 4) opts.push(`Option ${String.fromCharCode(65 + opts.length)}`);
      const ci = Math.max(0, Math.min(3, Number(q.correctIndex) || 0));
      return {
        id: q.id || `mcq-${idx + 1}`,
        question: q.question,
        options: opts as [string, string, string, string],
        correctIndex: ci,
        explanation: q.explanation,
        topic: q.topic || subject,
        repeatTag: q.repeatTag || 'Exam Pattern',
      };
    });

    res.json({
      id: `rescue-${Date.now()}`,
      subject,
      totalMarks,
      createdAt: new Date().toISOString(),
      crashPlan: parsed.crashPlan || [],
      highYieldTopics: normalizedHighYieldTopics,
      qaPairs: parsed.qaPairs || [],
      mcqQuestions: normalizedMcqs,
      writtenPrompts: parsed.writtenPrompts || [],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate Master Rescue Pack.';
    res.status(502).json({ error: message });
  }
});

/**
 * Resolve a single, concept-focused public YouTube video ID for embedding in Exam Panic Mode.
 * Validates strict 11-char ID format and times out quickly so it never blocks requests.
 */
async function resolveConceptYouTubeVideo(
  query: string
): Promise<{ videoId: string; title: string } | null> {
  const cleanQuery = stripTagsServer(query, 160);
  if (!cleanQuery) return null;
  try {
    const res = await fetch(
      `https://www.youtube.com/results?search_query=${encodeURIComponent(cleanQuery)}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: AbortSignal.timeout(3500),
      }
    );
    if (!res.ok) return null;
    const html = await res.text();
    const idx = html.indexOf('"videoRenderer":{"videoId":"');
    if (idx < 0) return null;
    const slice = html.slice(idx, idx + 1800);
    const idMatch = slice.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
    if (!idMatch?.[1]) return null;
    const titleMatch = slice.match(/"title":\{"runs":\[\{"text":"([^"]{3,140})"/);
    const decodedTitle = (titleMatch?.[1] || cleanQuery)
      .replace(/\\u0026/g, '&')
      .replace(/\\"/g, '"');
    return {
      videoId: idMatch[1],
      title: stripTagsServer(decodedTitle, 140),
    };
  } catch {
    return null;
  }
}

// On-demand single-concept YouTube resolver for Exam Panic Easy Video tab
app.get('/api/youtube/concept', aiRateLimit, async (req: Request, res: Response) => {
  const q = stripTagsServer(typeof req.query.q === 'string' ? req.query.q : '', 160);
  if (!q) {
    return res.status(400).json({ error: 'Concept query is required.' });
  }
  const resolved = await resolveConceptYouTubeVideo(q);
  if (!resolved) {
    return res.json({ videoId: null, title: q });
  }
  return res.json(resolved);
});

// 4. Gemini Vision Written Answer Sheet Grader
app.post('/api/ai/grade-written', aiRateLimit, async (req: Request, res: Response) => {
  try {
    const subject = stripTagsServer(req.body?.subject, 120);
    const question = stripTagsServer(req.body?.question, 800);
    const maxMarks = Math.max(1, Math.min(100, Number(req.body?.maxMarks) || 10));
    const rubric: string[] = Array.isArray(req.body?.rubric)
      ? req.body.rubric.slice(0, 10).map((r: unknown) => stripTagsServer(r, 200))
      : [];
    const imageBase64 = typeof req.body?.imageBase64 === 'string' ? req.body.imageBase64.trim() : '';
    const mimeType = typeof req.body?.mimeType === 'string' ? req.body.mimeType.trim() : 'image/jpeg';

    if (!imageBase64 || !/^image\/(jpeg|png|webp)$/.test(mimeType)) {
      return res.status(400).json({ error: 'A scanned handwritten answer image (JPG/PNG/WebP) is required.' });
    }

    const byok = extractByok(req);
    const ai = getGeminiClient(byok.provider === 'gemini' ? byok.apiKey : undefined);

    const prompt = `You are a supportive, sharp university examiner grading a student's handwritten answer sheet for ${subject || 'the exam'}.
Question: ${question || 'Written Exam Question'}
Maximum Marks: ${maxMarks}
Marking Rubric:
${rubric.map((r: string, i: number) => `${i + 1}. ${r}`).join('\n') || '1. Core definition\n2. Method & working steps\n3. Final conclusion/units'}

Examine the attached scanned handwritten answer image carefully.
CRITICAL GRADING FORMAT:
1. appreciation: ALWAYS start with genuine, specific appreciation of the student's effort, structure, or handwriting before critique.
2. score: Numeric score out of ${maxMarks}.
3. maxScore: ${maxMarks}
4. strongPoints: 2-4 concrete things the student got right.
5. missedSteps: 2-4 exact steps, keywords, or equations missing for full marks.
6. modelImprovement: 1 concise actionable tip to score full marks next time.`;

    const response = await ai.models.generateContent({
      model: byok.provider === 'gemini' && byok.modelOverride ? byok.modelOverride : 'gemini-2.5-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType,
              data: imageBase64,
            },
          },
          { text: prompt },
        ],
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            appreciation: { type: Type.STRING },
            score: { type: Type.NUMBER },
            maxScore: { type: Type.NUMBER },
            strongPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
            missedSteps: { type: Type.ARRAY, items: { type: Type.STRING } },
            modelImprovement: { type: Type.STRING },
          },
          required: ['appreciation', 'score', 'maxScore', 'strongPoints', 'missedSteps', 'modelImprovement'],
        },
      },
    });

    const parsed = safeJsonParse<{
      appreciation: string;
      score: number;
      maxScore: number;
      strongPoints: string[];
      missedSteps: string[];
      modelImprovement: string;
    }>(response.text || '{}');

    res.json({
      appreciation: parsed.appreciation,
      score: Math.max(0, Math.min(maxMarks, Number(parsed.score) || 0)),
      maxScore: maxMarks,
      strongPoints: parsed.strongPoints || [],
      missedSteps: parsed.missedSteps || [],
      modelImprovement: parsed.modelImprovement || '',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to grade handwritten answer sheet.';
    res.status(502).json({ error: message });
  }
});

async function startServer() {
  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`NEXLIVE server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
