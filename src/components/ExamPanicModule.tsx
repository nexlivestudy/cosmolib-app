import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  FileCheck2,
  FileText,
  Lock,
  PlayCircle,
  Siren,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import { generateExamPanicPack, gradeWrittenAnswer } from '../lib/aiClient';
import type { BYOKConfig, HighYieldTopic, MasterRescuePack, WrittenGradeResult } from '../types';
import {
  applyDocumentScanFilter,
  downloadMasterRescuePdf,
  downloadScannedImagesAsPdf,
  extractPdfSummaryMetadata,
  extractTextFromPdfFile,
  filterSyllabusForSubject,
  type PdfSummaryMeta,
} from '../utils/pdfUtils';
import {
  MAX_VAULT_FILE_BYTES,
  sanitizeFileName,
  sanitizeUserText,
  validateVaultFile,
} from '../utils/security';
import { computeExamQuestionCount, scoreMcqAttempt } from '../utils/studyLogic';
import { EmptyStateCard, WorkspaceSkeletonLoader } from './ui/CosmolibPrimitives';

type PanicInputField = 'syllabus' | 'notes' | 'pyqs';

interface UploadedFieldFile {
  name: string;
  sizeLabel: string;
  fullText: string;
  isScanned: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function normalizeMarksInput(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  return digits.replace(/^0+(?=\d)/, '').slice(0, 3);
}

export function clampMarksOnBlur(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed)) return '60';
  return String(Math.min(300, Math.max(10, parsed)));
}

export function deriveTotalMarksNumber(raw: string): number {
  const parsed = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(parsed)) return 60;
  return Math.min(300, Math.max(10, parsed));
}

interface ExamPanicModuleProps {
  byok: BYOKConfig;
  onPackGenerated?: () => void;
}

export const ExamPanicModule: React.FC<ExamPanicModuleProps> = ({ byok, onPackGenerated }) => {
  const [subject, setSubject] = useState('');
  const [totalMarksInput, setTotalMarksInput] = useState('');
  const [syllabus, setSyllabus] = useState('');
  const [notes, setNotes] = useState('');
  const [pyqs, setPyqs] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<
    Record<PanicInputField, UploadedFieldFile | null>
  >({
    syllabus: null,
    notes: null,
    pyqs: null,
  });
  const [parsingField, setParsingField] = useState<PanicInputField | null>(null);
  const [dragTarget, setDragTarget] = useState<PanicInputField | null>(null);

  const hasMarksInput = totalMarksInput.trim().length > 0;
  const totalMarks = deriveTotalMarksNumber(totalMarksInput);

  const [pack, setPack] = useState<MasterRescuePack | null>(null);
  const [viewMode, setViewMode] = useState<'reader' | 'mcq' | 'written'>('reader');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // High-Yield interactive concept card state
  const [selectedTopicIdx, setSelectedTopicIdx] = useState<number | null>(null);
  const [topicTab, setTopicTab] = useState<'explanation' | 'video'>('explanation');
  const [resolvedConceptVideos, setResolvedConceptVideos] = useState<
    Record<string, { videoId: string | null; title: string }>
  >({});
  const [loadingVideoKey, setLoadingVideoKey] = useState<string | null>(null);

  // Mode 1: MCQ state
  const [mcqAnswers, setMcqAnswers] = useState<Record<string, number>>({});
  const [mcqSubmitted, setMcqSubmitted] = useState(false);

  // Mode 2: Written scan + Gemini Vision grading state
  const [selectedPromptIdx, setSelectedPromptIdx] = useState(0);
  const [enhanceScan, setEnhanceScan] = useState(true);
  const [scannedPages, setScannedPages] = useState<
    { dataUrl: string; base64: string; mimeType: 'image/jpeg'; name: string }[]
  >([]);
  const [grading, setGrading] = useState(false);
  const [gradeResult, setGradeResult] = useState<WrittenGradeResult | null>(null);

  const plannedQuestionCount = computeExamQuestionCount(totalMarks);

  // Prevent browser from opening dropped PDFs/files in a new tab anywhere on the page
  useEffect(() => {
    const preventWindowDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
    };
    const preventWindowDrop = (e: DragEvent) => {
      e.preventDefault();
      setDragTarget(null);
    };

    window.addEventListener('dragover', preventWindowDragOver);
    window.addEventListener('drop', preventWindowDrop);
    return () => {
      window.removeEventListener('dragover', preventWindowDragOver);
      window.removeEventListener('drop', preventWindowDrop);
    };
  }, []);

  const setFieldValue = (field: PanicInputField, value: string) => {
    if (field === 'syllabus') setSyllabus(value);
    else if (field === 'notes') setNotes(value);
    else setPyqs(value);
  };

  const handleFieldFileUpload = async (field: PanicInputField, file: File) => {
    setError(null);
    const safeName = sanitizeFileName(file.name);
    const ext = safeName.toLowerCase().split('.').pop() || '';
    const isPlainText = ext === 'txt' || ext === 'md';

    let validatedName = safeName;

    if (isPlainText) {
      const normalizedMime = (file.type || '').toLowerCase().trim();
      const allowedTextMimes = new Set(['text/plain', 'text/markdown', 'text/x-markdown']);
      if (normalizedMime && !allowedTextMimes.has(normalizedMime)) {
        setError(`Blocked MIME type "${normalizedMime}". Upload a PDF, TXT, or MD file.`);
        return;
      }
      if (!Number.isFinite(file.size) || file.size <= 0) {
        setError('File appears to be empty.');
        return;
      }
      if (file.size > MAX_VAULT_FILE_BYTES) {
        setError('File exceeds the 50 MB maximum upload limit.');
        return;
      }
    } else {
      const check = validateVaultFile({ name: file.name, size: file.size, type: file.type });
      if (!check.valid) {
        setError(check.error);
        return;
      }
      if (check.ext !== 'pdf') {
        setError('Upload a PDF, TXT, or MD document for Syllabus, Notes, or PYQs (max 50 MB).');
        return;
      }
      validatedName = check.safeName;
    }

    setParsingField(field);
    try {
      const rawText = isPlainText ? await file.text() : await extractTextFromPdfFile(file);
      // Preserve up to 24,000 chars privately so multi-subject syllabus filtering can find any subject
      const cleanedFull = sanitizeUserText(rawText, 24000);
      const isScanned = !cleanedFull;

      // Never dump full PDF text into the textarea; store privately for AI + show compact summary
      setUploadedFiles((prev) => ({
        ...prev,
        [field]: {
          name: validatedName,
          sizeLabel: formatFileSize(file.size),
          fullText: cleanedFull,
          isScanned,
        },
      }));
    } catch (err) {
      // Even if PDF parsing throws on an unusual scanned/protected PDF, keep it attached gracefully
      if (!isPlainText) {
        setUploadedFiles((prev) => ({
          ...prev,
          [field]: {
            name: validatedName,
            sizeLabel: formatFileSize(file.size),
            fullText: '',
            isScanned: true,
          },
        }));
      } else {
        setError(
          err instanceof Error ? err.message : `Failed to read "${validatedName}".`
        );
      }
    } finally {
      setParsingField(null);
    }
  };

  const handleFieldInputChange = (
    field: PanicInputField,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    void handleFieldFileUpload(field, file);
  };

  const handleFieldDragOver = (field: PanicInputField, e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
    if (dragTarget !== field) {
      setDragTarget(field);
    }
  };

  const handleFieldDragLeave = (field: PanicInputField, e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.currentTarget.contains(e.relatedTarget as Node | null) && dragTarget === field) {
      setDragTarget(null);
    }
  };

  const handleFieldDrop = (field: PanicInputField, e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragTarget(null);
    const file = e.dataTransfer?.files?.[0];
    if (file) {
      void handleFieldFileUpload(field, file);
    }
  };

  const handleRemoveFieldFile = (field: PanicInputField) => {
    setUploadedFiles((prev) => ({ ...prev, [field]: null }));
  };

  // Compute live compact summaries + Subject Name filtering for Syllabus
  const fieldSummaries = useMemo<
    Record<PanicInputField, { effectiveText: string; summary: PdfSummaryMeta | null }>
  >(() => {
    const buildSummary = (field: PanicInputField) => {
      const file = uploadedFiles[field];
      if (!file || file.isScanned || !file.fullText) {
        return { effectiveText: '', summary: null };
      }
      if (field === 'syllabus') {
        const { filteredText, matched } = filterSyllabusForSubject(file.fullText, subject);
        return {
          effectiveText: filteredText,
          summary: extractPdfSummaryMetadata(filteredText, subject, matched),
        };
      }
      return {
        effectiveText: file.fullText,
        summary: extractPdfSummaryMetadata(file.fullText, subject, false),
      };
    };

    return {
      syllabus: buildSummary('syllabus'),
      notes: buildSummary('notes'),
      pyqs: buildSummary('pyqs'),
    };
  }, [uploadedFiles, subject]);

  const mcqScore = useMemo(
    () => scoreMcqAttempt(mcqAnswers, pack?.mcqQuestions ?? []),
    [mcqAnswers, pack?.mcqQuestions]
  );

  const composeAiFieldPayload = (field: PanicInputField, manualText: string): string => {
    const parts: string[] = [];
    const safeManual = sanitizeUserText(manualText, 4500);
    if (safeManual) parts.push(safeManual);

    const file = uploadedFiles[field];
    if (file) {
      if (file.isScanned) {
        parts.push(
          `[Attached scanned PDF: ${file.name} (${file.sizeLabel}) — image-only document without embedded text]`
        );
      } else {
        const hidden = fieldSummaries[field].effectiveText;
        if (hidden) parts.push(hidden);
      }
    }

    return sanitizeUserText(parts.join('\n\n'), 4500);
  };

  const handleGeneratePack = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const safeSubject = sanitizeUserText(subject, 120);
    if (!safeSubject) {
      setError('Enter a subject name to generate your Master Rescue PDF.');
      return;
    }

    if (!totalMarksInput.trim()) {
      setError('Enter your total exam marks (10-100) so we can build the right question set.');
      return;
    }
    const clampedStr = clampMarksOnBlur(totalMarksInput);
    setTotalMarksInput(clampedStr);
    const finalMarks = deriveTotalMarksNumber(clampedStr);

    setGenerating(true);
    try {
      const generated = await generateExamPanicPack(
        {
          subject: safeSubject,
          totalMarks: finalMarks,
          syllabus: composeAiFieldPayload('syllabus', syllabus),
          notes: composeAiFieldPayload('notes', notes),
          pyqs: composeAiFieldPayload('pyqs', pyqs),
        },
        byok
      );
      setPack(generated);
      onPackGenerated?.();
      setSelectedTopicIdx(null);
      setTopicTab('explanation');
      setMcqAnswers({});
      setMcqSubmitted(false);
      setGradeResult(null);
      setViewMode('reader');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate Master Rescue Pack.');
    } finally {
      setGenerating(false);
    }
  };

  const handleScanPhotoFile = async (file: File) => {
    setError(null);

    const check = validateVaultFile({ name: file.name, size: file.size, type: file.type });
    if (!check.valid || (check.ext !== 'jpg' && check.ext !== 'jpeg' && check.ext !== 'png')) {
      setError('Upload a JPG or PNG photo of your handwritten answer sheet (max 50 MB).');
      return;
    }

    try {
      const scanned = await applyDocumentScanFilter(file, enhanceScan);
      setScannedPages((prev) => [...prev, { ...scanned, name: check.safeName }]);
      setGradeResult(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to apply scan filter to image.');
    }
  };

  const handleScanPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    await handleScanPhotoFile(file);
  };

  const handleGradeWritten = async () => {
    if (!pack) {
      setError('Generate a Master Rescue Pack first before grading written solutions.');
      return;
    }
    if (scannedPages.length === 0) {
      setError('Upload at least one scanned photo of your handwritten solution first.');
      return;
    }
    const prompt = pack.writtenPrompts[selectedPromptIdx] || {
      question: `Written Exam Solution for ${pack.subject}`,
      maxMarks: 10,
      rubric: ['Core concepts', 'Step-by-step derivation', 'Final conclusion'],
    };

    setError(null);
    setGrading(true);
    try {
      const result = await gradeWrittenAnswer(
        {
          subject: pack.subject,
          question: prompt.question,
          rubric: prompt.rubric,
          maxMarks: prompt.maxMarks,
          imageBase64: scannedPages[0].base64,
          mimeType: scannedPages[0].mimeType,
        },
        byok
      );
      setGradeResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gemini Vision grading failed.');
    } finally {
      setGrading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Input Builder */}
      <section className="cosmo-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-600 dark:text-amber-400">
              <Siren className="h-4 w-4" />
              <span>One-Shot Exam Panic Mode</span>
            </div>
            <h1 className="mt-1 font-display text-2xl font-bold text-slate-900 dark:text-white">
              Master Rescue PDF & Rapid Assessment Engine
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Feed your syllabus, rough notes, and PYQs to generate a single exam rescue pack plus{' '}
              {hasMarksInput ? (
                <>
                  <span className="font-mono font-semibold text-slate-900 tabular-nums dark:text-cyan-300">
                    {plannedQuestionCount} practice questions
                  </span>{' '}
                  ({totalMarks >= 50 ? 'marks ≥ 50 → 40 Qs' : 'marks < 50 → 20 Qs'}).
                </>
              ) : (
                <>a tailored practice set (enter total marks above to auto-pick 20 or 40 Qs).</>
              )}
            </p>
          </div>
        </div>

        <form onSubmit={handleGeneratePack} className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <label htmlFor="panic-subject" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Subject Name
            </label>
            <input
              id="panic-subject"
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g., Computer Networks, Thermodynamics, Organic Chemistry"
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-[#0B0F19] dark:text-white"
            />
          </div>

          <div className="lg:col-span-4">
            <label htmlFor="panic-marks" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Total Exam Marks ({plannedQuestionCount} Qs auto-selected)
            </label>
            <input
              id="panic-marks"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={totalMarksInput}
              onChange={(e) => setTotalMarksInput(normalizeMarksInput(e.target.value))}
              onBlur={() => setTotalMarksInput((prev) => clampMarksOnBlur(prev))}
              placeholder="60"
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 font-mono text-sm tabular-nums text-slate-900 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-[#0B0F19] dark:text-white"
            />
          </div>

          {(
            [
              {
                field: 'syllabus' as const,
                id: 'panic-syllabus',
                inputId: 'panic-syllabus-upload',
                label: 'Syllabus Units',
                placeholder: 'Paste syllabus modules or drop a PDF/TXT file here...',
                value: syllabus,
              },
              {
                field: 'notes' as const,
                id: 'panic-notes',
                inputId: 'panic-notes-upload',
                label: 'Lecture Notes / Key Points',
                placeholder: 'Paste class notes or drop a PDF/TXT file here...',
                value: notes,
              },
              {
                field: 'pyqs' as const,
                id: 'panic-pyqs',
                inputId: 'panic-pyqs-upload',
                label: 'Previous Year Questions (PYQs)',
                placeholder: 'Paste repeated exam questions or drop a PDF/TXT file here...',
                value: pyqs,
              },
            ]
          ).map((cfg) => {
            const uploaded = uploadedFiles[cfg.field];
            const isDragging = dragTarget === cfg.field;
            const isParsing = parsingField === cfg.field;

            return (
              <div
                key={cfg.field}
                data-dropzone={cfg.field}
                onDragEnter={(e) => handleFieldDragOver(cfg.field, e)}
                onDragOver={(e) => handleFieldDragOver(cfg.field, e)}
                onDragLeave={(e) => handleFieldDragLeave(cfg.field, e)}
                onDrop={(e) => handleFieldDrop(cfg.field, e)}
                className={`rounded-xl border p-3 transition-colors lg:col-span-4 ${
                  isDragging
                    ? 'border-cyan-500 bg-cyan-500/10'
                    : 'border-slate-200 bg-slate-50/60 dark:border-slate-800 dark:bg-[#0B0F19]/50'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor={cfg.id}
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    {cfg.label}
                  </label>
                  <label
                    htmlFor={cfg.inputId}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 transition-colors hover:border-cyan-500 hover:text-cyan-700 whitespace-nowrap shrink-0 dark:border-slate-700 dark:bg-[#111827] dark:text-slate-200 dark:hover:border-cyan-500 dark:hover:text-cyan-300"
                  >
                    <Upload className="h-3 w-3" />
                    <span>{isParsing ? 'Extracting...' : 'Upload PDF'}</span>
                    <input
                      id={cfg.inputId}
                      type="file"
                      accept=".pdf,application/pdf,.txt,.md"
                      onChange={(e) => handleFieldInputChange(cfg.field, e)}
                      className="sr-only"
                    />
                  </label>
                </div>

                <textarea
                  id={cfg.id}
                  rows={3}
                  value={cfg.value}
                  onChange={(e) => setFieldValue(cfg.field, e.target.value)}
                  placeholder={cfg.placeholder}
                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-2.5 text-xs text-slate-900 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-[#0B0F19] dark:text-white"
                />

                {uploaded && (
                  <div
                    data-uploaded-file={cfg.field}
                    className={`mt-2 space-y-1.5 rounded-lg border px-2.5 py-2 text-[11px] ${
                      uploaded.isScanned
                        ? 'border-amber-500/40 bg-amber-500/10'
                        : 'border-cyan-500/40 bg-cyan-500/10'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <FileText
                          className={`h-3.5 w-3.5 shrink-0 ${
                            uploaded.isScanned
                              ? 'text-amber-700 dark:text-amber-400'
                              : 'text-cyan-700 dark:text-cyan-400'
                          }`}
                        />
                        <span className="truncate font-medium text-slate-900 dark:text-slate-100">
                          {uploaded.name}
                        </span>
                        <span className="shrink-0 font-mono text-slate-500 tabular-nums dark:text-slate-400">
                          ({uploaded.sizeLabel})
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveFieldFile(cfg.field)}
                        aria-label={`Remove ${uploaded.name}`}
                        className="inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 font-semibold text-red-700 hover:bg-red-500/15 dark:text-red-300"
                      >
                        <X className="h-3 w-3" />
                        <span>Remove</span>
                      </button>
                    </div>

                    {uploaded.isScanned ? (
                      <p
                        data-scanned-note={cfg.field}
                        className="text-[11px] leading-snug text-amber-800 dark:text-amber-200"
                      >
                        Scanned image-based PDF attached (no embedded text layer). You can still click Generate using your Subject Name &amp; notes, or scan pages in Mode 2.
                      </p>
                    ) : (
                      (() => {
                        const meta = fieldSummaries[cfg.field].summary;
                        if (!meta) return null;
                        const metaParts = [
                          meta.matchedSubjectFilter && meta.detectedSubject
                            ? `Filtered: ${meta.detectedSubject}`
                            : meta.detectedSubject
                              ? `Subject: ${meta.detectedSubject}`
                              : null,
                          meta.monthYear ? `Session: ${meta.monthYear}` : null,
                          meta.scheme ? `Scheme: ${meta.scheme}` : null,
                        ].filter(Boolean);

                        return (
                          <div data-pdf-summary={cfg.field} className="space-y-1">
                            {metaParts.length > 0 && (
                              <div className="flex flex-wrap gap-x-2 gap-y-0.5 font-mono text-[10px] font-semibold text-cyan-800 dark:text-cyan-300">
                                {metaParts.map((part, i) => (
                                  <span key={i}>{part}</span>
                                ))}
                              </div>
                            )}
                            {meta.snippet && (
                              <p className="line-clamp-2 text-[11px] leading-snug text-slate-700 dark:text-slate-300">
                                {meta.snippet}
                              </p>
                            )}
                            <p className="text-[10px] text-slate-500 dark:text-slate-400">
                              Full text stored hidden for AI generation.
                            </p>
                          </div>
                        );
                      })()
                    )}
                  </div>
                )}
              </div>
            );
          })}

          <div className="flex flex-wrap items-center justify-between gap-3 lg:col-span-12">
            {pack ? (
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Active pack below: <strong className="text-slate-900 dark:text-white">{pack.subject}</strong> ({pack.totalMarks} marks)
              </span>
            ) : (
              <span className="text-xs text-slate-500 dark:text-slate-400">
                No active pack yet — upload syllabus + PYQs and click Generate.
              </span>
            )}
            <button
              type="submit"
              disabled={generating}
              className="cosmo-btn-primary inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 whitespace-nowrap"
            >
              <Sparkles className="h-4 w-4 shrink-0" />
              {generating ? 'Building Master Rescue PDF...' : 'Generate Master Rescue PDF'}
            </button>
          </div>
        </form>

        {error && (
          <div role="alert" className="mt-4 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-xs font-medium text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </div>
        )}
      </section>

      {/* Generating Skeleton Loader */}
      {generating && (
        <WorkspaceSkeletonLoader label="Synthesizing High-Yield Map, Master Rescue PDF & adaptive questions via Gemini 2.5 Flash..." />
      )}

      {/* Illustrated Empty State when no pack generated yet */}
      {!pack && !generating && (
        <EmptyStateCard
          illustration="panic"
          title="No active rescue pack yet"
          description="Enter your Subject Name above, drop or paste your syllabus & PYQs, and generate a tailored Master Rescue PDF with clickable concept videos and exam practice."
          actionLabel="Focus Subject Input"
          onAction={() => {
            document.getElementById('panic-subject')?.focus();
          }}
        />
      )}

      {/* Mode Switcher + 1-Click PDF Export — shown only after a pack is generated */}
      {pack && (
      <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1 dark:border-slate-800 dark:bg-[#0F1624]">
          <button
            type="button"
            onClick={() => setViewMode('reader')}
            className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              viewMode === 'reader'
                ? 'bg-white text-slate-900 shadow-xs dark:bg-[#1E293B] dark:text-white'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Master Rescue Reader
          </button>
          <button
            type="button"
            onClick={() => setViewMode('mcq')}
            className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors tabular-nums ${
              viewMode === 'mcq'
                ? 'bg-white text-slate-900 shadow-xs dark:bg-[#1E293B] dark:text-white'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Mode 1 · MCQ Drill ({pack.mcqQuestions.length} Qs)
          </button>
          <button
            type="button"
            onClick={() => setViewMode('written')}
            className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              viewMode === 'written'
                ? 'bg-white text-slate-900 shadow-xs dark:bg-[#1E293B] dark:text-white'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Mode 2 · Written Vision Grader
          </button>
        </div>

        <button
          type="button"
          onClick={() => downloadMasterRescuePdf(pack)}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-cyan-600 dark:hover:bg-cyan-500"
        >
          <Download className="h-3.5 w-3.5" />
          1-Click Download Master Rescue PDF
        </button>
      </div>

      {/* View 1: In-App Master Rescue Reader */}
      {viewMode === 'reader' && (
        <div className="space-y-6">
          {/* High-Yield Repeat Frequency + Crash Plan */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#111827]">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                  High-Yield Repeat Frequency Map
                </h2>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Click any concept
                </span>
              </div>
              <div className="mt-3 space-y-2">
                {pack.highYieldTopics.map((t: HighYieldTopic, idx: number) => {
                  const isOpen = selectedTopicIdx === idx;
                  const topicKey = `${pack.id}-${idx}-${t.topic}`;
                  const resolved = resolvedConceptVideos[topicKey];
                  const activeVideoId =
                    t.youtubeVideoId && /^[a-zA-Z0-9_-]{11}$/.test(t.youtubeVideoId)
                      ? t.youtubeVideoId
                      : resolved?.videoId && /^[a-zA-Z0-9_-]{11}$/.test(resolved.videoId)
                        ? resolved.videoId
                        : null;
                  const activeVideoTitle =
                    t.videoTitle || resolved?.title || `${t.topic} — Concept Walkthrough`;
                  const conceptQuery =
                    t.youtubeQuery || `${t.topic} ${pack.subject} easy explanation`;

                  const ensureConceptVideo = async () => {
                    if (activeVideoId || resolved || loadingVideoKey === topicKey) return;
                    setLoadingVideoKey(topicKey);
                    try {
                      const resp = await fetch(
                        `/api/youtube/concept?q=${encodeURIComponent(conceptQuery)}`
                      );
                      if (resp.ok) {
                        const data = (await resp.json()) as {
                          videoId: string | null;
                          title?: string;
                        };
                        setResolvedConceptVideos((prev) => ({
                          ...prev,
                          [topicKey]: {
                            videoId:
                              data.videoId && /^[a-zA-Z0-9_-]{11}$/.test(data.videoId)
                                ? data.videoId
                                : null,
                            title: data.title || t.topic,
                          },
                        }));
                      } else {
                        setResolvedConceptVideos((prev) => ({
                          ...prev,
                          [topicKey]: { videoId: null, title: t.topic },
                        }));
                      }
                    } catch {
                      setResolvedConceptVideos((prev) => ({
                        ...prev,
                        [topicKey]: { videoId: null, title: t.topic },
                      }));
                    } finally {
                      setLoadingVideoKey((cur) => (cur === topicKey ? null : cur));
                    }
                  };

                  return (
                    <div
                      key={idx}
                      data-high-yield-topic={idx}
                      className={`overflow-hidden rounded-lg border transition-colors ${
                        isOpen
                          ? 'border-cyan-500/70 bg-cyan-500/5 dark:bg-[#0B0F19]'
                          : 'border-slate-200 bg-slate-50/70 hover:border-slate-300 dark:border-slate-800 dark:bg-[#0B0F19]/60 dark:hover:border-slate-700'
                      }`}
                    >
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        onClick={() => {
                          if (isOpen) {
                            setSelectedTopicIdx(null);
                          } else {
                            setSelectedTopicIdx(idx);
                            setTopicTab('explanation');
                          }
                        }}
                        className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left text-xs"
                      >
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {t.topic}
                        </span>
                        <span className="inline-flex items-center gap-2 font-mono text-cyan-700 whitespace-nowrap shrink-0 dark:text-cyan-400">
                          <span>
                            {t.repeatTag} · {t.priority}
                          </span>
                          {isOpen ? (
                            <ChevronUp className="h-3.5 w-3.5 text-slate-400" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                          )}
                        </span>
                      </button>

                      {isOpen && (
                        <div className="border-t border-slate-200 px-3.5 pb-3.5 pt-3 dark:border-slate-800">
                          {/* 2 Options: Full Explanation & Easy Video */}
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              data-topic-option="explanation"
                              onClick={() => setTopicTab('explanation')}
                              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-semibold transition-all ${
                                topicTab === 'explanation'
                                  ? 'cosmo-tab-active cosmo-tab-active-center bg-indigo-600 text-[13px] text-white shadow-md'
                                  : 'border border-slate-300 bg-white text-xs text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-[#111827] dark:text-slate-300 dark:hover:bg-slate-800'
                              }`}
                            >
                              <BookOpen className="h-3.5 w-3.5" />
                              Full Explanation
                            </button>
                            <button
                              type="button"
                              data-topic-option="video"
                              onClick={() => {
                                setTopicTab('video');
                                void ensureConceptVideo();
                              }}
                              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-semibold transition-all ${
                                topicTab === 'video'
                                  ? 'cosmo-tab-active cosmo-tab-active-center bg-cyan-600 text-[13px] text-white shadow-md'
                                  : 'border border-slate-300 bg-white text-xs text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-[#111827] dark:text-slate-300 dark:hover:bg-slate-800'
                              }`}
                            >
                              <PlayCircle className="h-3.5 w-3.5" />
                              Easy Video
                            </button>
                          </div>

                          {/* Option 1: Full Explanation */}
                          {topicTab === 'explanation' && (
                            <div
                              data-topic-panel="explanation"
                              className="mt-3 space-y-2.5 text-xs leading-relaxed text-slate-700 dark:text-slate-300"
                            >
                              <p>
                                {t.fullExplanation ||
                                  `Exam-focused walkthrough for ${t.topic} in ${pack.subject}.`}
                              </p>

                              {Array.isArray(t.keyPoints) && t.keyPoints.length > 0 && (
                                <div className="rounded-md border border-slate-200 bg-white p-2.5 dark:border-slate-800 dark:bg-[#111827]">
                                  <div className="text-[11px] font-semibold text-indigo-700 dark:text-cyan-400">
                                    Key Scoring Points
                                  </div>
                                  <ul className="mt-1.5 space-y-1 text-xs">
                                    {t.keyPoints.map((pt, ptIdx) => (
                                      <li key={ptIdx} className="flex items-start gap-1.5">
                                        <span className="font-mono font-bold text-cyan-600 dark:text-cyan-400">
                                          •
                                        </span>
                                        <span>{pt}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {t.workedExample && (
                                <div className="rounded-md border border-cyan-500/35 bg-cyan-500/5 p-2.5 text-xs">
                                  <span className="font-semibold text-cyan-800 dark:text-cyan-300">
                                    Worked Example:{' '}
                                  </span>
                                  <span>{t.workedExample}</span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Option 2: Easy Video (YouTube embed covering ONLY this clicked concept) */}
                          {topicTab === 'video' && (
                            <div data-topic-panel="video" className="mt-3 space-y-2">
                              <div className="flex items-center justify-between gap-2 text-[11px] text-slate-600 dark:text-slate-400">
                                <span className="truncate font-medium text-slate-800 dark:text-slate-200">
                                  {activeVideoTitle}
                                </span>
                                <span className="shrink-0 font-mono text-[10px] text-cyan-700 dark:text-cyan-400">
                                  Concept-only embed
                                </span>
                              </div>

                              {loadingVideoKey === topicKey ? (
                                <div className="flex aspect-video w-full items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-xs text-slate-500 dark:border-slate-800 dark:bg-[#111827] dark:text-slate-400">
                                  Finding focused video for {t.topic}...
                                </div>
                              ) : activeVideoId ? (
                                <div className="overflow-hidden rounded-lg border border-slate-200 bg-black dark:border-slate-800">
                                  <iframe
                                    title={`Easy video covering ${t.topic}`}
                                    src={`https://www.youtube-nocookie.com/embed/${activeVideoId}?rel=0&modestbranding=1`}
                                    className="aspect-video w-full"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                    referrerPolicy="strict-origin-when-cross-origin"
                                  />
                                </div>
                              ) : (
                                <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-[#111827] dark:text-slate-300">
                                  Unable to resolve an inline embed right now for{' '}
                                  <strong className="text-slate-900 dark:text-white">
                                    {t.topic}
                                  </strong>
                                  .{' '}
                                  <a
                                    href={`https://www.youtube.com/results?search_query=${encodeURIComponent(conceptQuery)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-semibold text-cyan-700 underline hover:text-cyan-600 dark:text-cyan-400"
                                  >
                                    Watch focused concept tutorials on YouTube
                                  </a>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#111827]">
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                Time-Boxed Crash Plan
              </h2>
              <div className="mt-3 divide-y divide-slate-200 dark:divide-slate-800">
                {pack.crashPlan.map((slot, idx) => (
                  <div key={idx} className="py-2.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-900 dark:text-white">{slot.focus}</span>
                      <span className="font-mono text-slate-500 tabular-nums">{slot.slot}</span>
                    </div>
                    <p className="mt-0.5 text-slate-600 dark:text-slate-400">{slot.deliverable}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Q&A with Lock-In Box after EVERY Q&A */}
          <div className="space-y-4">
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              Exam Q&amp;A with Mandatory Lock-In Boxes
            </h2>
            {pack.qaPairs.map((qa, idx) => (
              <article
                key={qa.id}
                className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-[#111827]"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-mono font-semibold text-indigo-600 dark:text-cyan-400">
                    Question {idx + 1} · {qa.repeatTag} · {qa.marksWeight}
                  </span>
                </div>
                <h3 className="mt-2 font-display text-base font-bold text-slate-900 dark:text-white">
                  {qa.question}
                </h3>
                <p className="mt-2.5 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                  {qa.answer}
                </p>

                {/* Lock-In Box */}
                <div className="mt-4 rounded-lg border border-cyan-500/40 bg-cyan-500/5 p-4">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-cyan-800 dark:text-cyan-300">
                    <Lock className="h-3.5 w-3.5" />
                    <span>Lock-In Box</span>
                  </div>
                  <div className="mt-2 grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
                    <div>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">Memory Anchor: </span>
                      <span className="text-slate-600 dark:text-slate-400">{qa.lockInBox.memoryAnchor}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">Formula / Rule: </span>
                      <span className="font-mono text-indigo-700 dark:text-cyan-300">{qa.lockInBox.keyFormulaOrRule}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">Exam Check: </span>
                      <span className="text-slate-600 dark:text-slate-400">{qa.lockInBox.examCheck}</span>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {/* View 2: Mode 1 — MCQ A-D Drill with Scoring */}
      {viewMode === 'mcq' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#111827]">
            <div>
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                Mode 1 · Timed MCQ Drill ({pack.mcqQuestions.length} Questions)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                Answered {Object.keys(mcqAnswers).length} of {pack.mcqQuestions.length}
                {mcqSubmitted ? ` · Score: ${mcqScore.correct}/${mcqScore.total} (${mcqScore.accuracyPct}%)` : ''}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {mcqSubmitted && (
                <button
                  type="button"
                  onClick={() => {
                    setMcqAnswers({});
                    setMcqSubmitted(false);
                  }}
                  className="rounded-lg border border-slate-300 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Retry Drill
                </button>
              )}
              <button
                type="button"
                onClick={() => setMcqSubmitted(true)}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
              >
                Submit &amp; Score MCQ
              </button>
            </div>
          </div>

          {pack.mcqQuestions.map((q, idx) => {
            const chosen = mcqAnswers[q.id];
            return (
              <div
                key={q.id}
                className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#111827]"
              >
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Q{idx + 1} · {q.topic} · {q.repeatTag}
                </div>
                <p className="mt-1.5 text-sm font-semibold text-slate-900 dark:text-white">
                  {q.question}
                </p>
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {q.options.map((opt, optIdx) => {
                    const letter = String.fromCharCode(65 + optIdx);
                    const isSelected = chosen === optIdx;
                    const isCorrect = q.correctIndex === optIdx;
                    let cls =
                      'border-slate-200 bg-slate-50 text-slate-800 hover:border-slate-300 dark:border-slate-800 dark:bg-[#0B0F19] dark:text-slate-200';
                    if (mcqSubmitted) {
                      if (isCorrect) {
                        cls = 'border-emerald-500 bg-emerald-500/15 text-emerald-900 dark:text-emerald-200';
                      } else if (isSelected && !isCorrect) {
                        cls = 'border-red-500 bg-red-500/15 text-red-900 dark:text-red-200';
                      }
                    } else if (isSelected) {
                      cls = 'border-cyan-500 bg-cyan-500/15 text-slate-900 dark:text-white';
                    }
                    return (
                      <button
                        key={optIdx}
                        type="button"
                        disabled={mcqSubmitted}
                        onClick={() => setMcqAnswers((prev) => ({ ...prev, [q.id]: optIdx }))}
                        className={`flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-left text-xs transition-colors ${cls}`}
                      >
                        <span className="font-mono font-bold">{letter}.</span>
                        <span>{opt}</span>
                      </button>
                    );
                  })}
                </div>
                {mcqSubmitted && (
                  <p className="mt-3 text-xs text-slate-600 dark:text-slate-400">
                    <strong className="text-slate-900 dark:text-slate-200">Explanation:</strong> {q.explanation}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* View 3: Mode 2 — Written Photo -> Scan Filter -> jsPDF -> Gemini Vision Grading */}
      {viewMode === 'written' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-6">
            <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#111827]">
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                Select Subjective Prompt
              </h2>
              <div className="mt-3 space-y-2">
                {pack.writtenPrompts.map((wp, idx) => (
                  <button
                    key={wp.id}
                    type="button"
                    onClick={() => setSelectedPromptIdx(idx)}
                    className={`w-full rounded-lg border p-3.5 text-left text-xs transition-colors ${
                      selectedPromptIdx === idx
                        ? 'border-cyan-500 bg-cyan-500/10'
                        : 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-[#0B0F19]'
                    }`}
                  >
                    <div className="font-semibold text-slate-900 dark:text-white">
                      {wp.question}
                    </div>
                    <div className="mt-1 font-mono text-slate-500 tabular-nums">
                      Max {wp.maxMarks} Marks
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#111827]">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Scan Handwritten Answer Sheet
                </h3>
                <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={enhanceScan}
                    onChange={(e) => setEnhanceScan(e.target.checked)}
                    className="rounded border-slate-400"
                  />
                  High-Contrast Scan Filter
                </label>
              </div>

              <label
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const file = e.dataTransfer?.files?.[0];
                  if (file) {
                    void handleScanPhotoFile(file);
                  }
                }}
                className="mt-3 flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-xs text-slate-600 hover:border-cyan-500 dark:border-slate-700 dark:bg-[#0B0F19] dark:text-slate-300"
              >
                <Camera className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                <span className="mt-2 font-semibold">Capture, Drop, or Upload Handwritten Photo (JPG / PNG)</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png"
                  capture="environment"
                  onChange={handleScanPhotoUpload}
                  className="sr-only"
                />
              </label>

              {scannedPages.length > 0 && (
                <div className="mt-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    {scannedPages.map((p, idx) => (
                      <div
                        key={idx}
                        className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800"
                      >
                        <img
                          src={p.dataUrl}
                          alt={`Scanned answer page ${idx + 1}`}
                          className="h-40 w-full object-cover"
                        />
                        <div className="px-2.5 py-1.5 text-xs text-slate-600 dark:text-slate-400 truncate">
                          Page {idx + 1} · {p.name}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        downloadScannedImagesAsPdf(
                          scannedPages.map((p) => p.dataUrl),
                          `cosmolib-written-${pack.subject.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`
                        )
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      Compile &amp; Save PDF (jsPDF)
                    </button>
                    <button
                      type="button"
                      disabled={grading}
                      onClick={handleGradeWritten}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                    >
                      <FileCheck2 className="h-3.5 w-3.5" />
                      {grading ? 'Grading with Gemini Vision...' : 'Grade with Gemini Vision'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Vision Grading Report */}
          <div className="lg:col-span-6">
            <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-[#111827]">
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                Gemini Vision Examiner Report
              </h2>
              {gradeResult ? (
                <div className="mt-4 space-y-4">
                  <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4">
                    <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                      Appreciation First
                    </div>
                    <p className="mt-1 text-sm text-slate-800 dark:text-slate-100">
                      {gradeResult.appreciation}
                    </p>
                  </div>

                  <div className="flex items-baseline justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      Rubric Score
                    </span>
                    <span className="font-mono text-2xl font-bold tabular-nums text-indigo-600 dark:text-cyan-400">
                      {gradeResult.score} / {gradeResult.maxScore}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                      Strong Points
                    </h3>
                    <ul className="mt-2 space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                      {gradeResult.strongPoints.map((pt, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                          <span>{pt}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                      Missed Steps for Full Marks
                    </h3>
                    <ul className="mt-2 space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                      {gradeResult.missedSteps.map((step, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="font-mono font-bold text-amber-500">•</span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-lg bg-slate-100 p-3.5 text-xs text-slate-700 dark:bg-[#0B0F19] dark:text-slate-300">
                    <strong>Next Attempt Tip:</strong> {gradeResult.modelImprovement}
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                  Upload a photo of your handwritten solution, apply the document scan filter, and run Gemini Vision grading to get encouragement first, followed by strong points and missed marking steps.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
};
