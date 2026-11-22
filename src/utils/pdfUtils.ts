import { jsPDF } from 'jspdf';
import type { GeneratedSubfolders, MasterRescuePack } from '../types';

export interface PdfSummaryMeta {
  detectedSubject: string | null;
  monthYear: string | null;
  scheme: string | null;
  snippet: string;
  matchedSubjectFilter: boolean;
}

/**
 * Filter a multi-subject syllabus document to ONLY the section matching the typed Subject Name.
 */
export function filterSyllabusForSubject(
  fullText: string,
  subjectName: string
): { filteredText: string; matched: boolean } {
  const cleanFull = fullText.trim();
  const query = subjectName.trim();
  if (!cleanFull || query.length < 2) {
    return { filteredText: cleanFull, matched: false };
  }

  const lowerFull = cleanFull.toLowerCase();
  const lowerQuery = query.toLowerCase();

  // Prefer exact subject name match; fall back to matching all significant words (>= 3 chars)
  let matchIdx = lowerFull.indexOf(lowerQuery);
  if (matchIdx === -1) {
    const words = lowerQuery
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 3);
    if (words.length > 0) {
      const lines = cleanFull.split(/\r?\n/);
      let offset = 0;
      for (const line of lines) {
        const lowerLine = line.toLowerCase();
        if (words.every((w) => lowerLine.includes(w))) {
          matchIdx = offset;
          break;
        }
        offset += line.length + 1;
      }
    }
  }

  if (matchIdx === -1) {
    return { filteredText: cleanFull, matched: false };
  }

  // Step back to line start if nearby, or up to 35 chars for space-joined PDF page text
  const lineStart = cleanFull.lastIndexOf('\n', matchIdx);
  const start =
    lineStart >= 0 && matchIdx - lineStart <= 80
      ? lineStart + 1
      : Math.max(0, matchIdx - 35);
  const tail = cleanFull.slice(start);

  // Stop before the next distinct subject/course section header (newline OR inline space-joined PDF text)
  const nextSectionRegex =
    /\b(?:Course\s*Code|Subject\s*Code|Subject\s*Name|Course\s*Title|Paper\s*Code|SUBJECT\s*\d+|COURSE\s*\d+)\s*[:\-]/gi;
  let end = Math.min(tail.length, 4500);
  let headerMatch: RegExpExecArray | null;
  while ((headerMatch = nextSectionRegex.exec(tail)) !== null) {
    if (headerMatch.index > 60) {
      const candidateLine = tail
        .slice(headerMatch.index, headerMatch.index + 160)
        .toLowerCase();
      if (!candidateLine.includes(lowerQuery)) {
        end = Math.min(end, headerMatch.index);
        break;
      }
    }
  }

  const filtered = tail.slice(0, end).trim();
  return {
    filteredText: filtered || cleanFull,
    matched: true,
  };
}

/**
 * Extract compact metadata (Subject, Month/Year, Scheme/Pattern) and a short preview snippet
 * from uploaded PDF/text content so full text never floods the textarea.
 */
export function extractPdfSummaryMetadata(
  rawText: string,
  typedSubject?: string,
  matchedSubjectFilter = false
): PdfSummaryMeta {
  const normalized = rawText.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return {
      detectedSubject: typedSubject?.trim() || null,
      monthYear: null,
      scheme: null,
      snippet: '',
      matchedSubjectFilter: false,
    };
  }

  // Detect Month/Year or Exam Session (e.g., "Nov/Dec 2024", "May 2025", "Winter 2023")
  const monthRegex =
    /\b(?:(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)(?:\s*[/\-]\s*(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?))?|(?:Summer|Winter|Spring|Autumn|Fall))\s*[-/,]?\s*(?:20\d{2}|19\d{2})\b/i;
  const monthMatch = rawText.match(monthRegex);
  const monthYear = monthMatch ? monthMatch[0].replace(/\s+/g, ' ').trim() : null;

  // Detect Academic Scheme / Pattern / Regulation (e.g., "2019 Pattern", "CBCS Scheme", "NEP 2020", "R20")
  const schemeRegex =
    /\b(?:(?:20\d{2}\s*(?:Pattern|Scheme|Course|Regulation|Curriculum|CBCS))|(?:(?:CBCS|NEP\s*2020|K-Scheme|I-Scheme|C-Scheme|Rev(?:ision)?\s*20\d{2})(?:\s*(?:Scheme|Pattern))?)|(?:Scheme\s*[:\-]?\s*[A-Z0-9\-]{1,12})|(?:R\d{2}\s*(?:Regulation|Scheme)))\b/i;
  const schemeMatch = rawText.match(schemeRegex);
  const scheme = schemeMatch ? schemeMatch[0].replace(/\s+/g, ' ').trim() : null;

  // Detect Subject Name from explicit labels or matched typed subject
  let detectedSubject: string | null = null;
  if (matchedSubjectFilter && typedSubject?.trim()) {
    detectedSubject = typedSubject.trim();
  } else {
    const subjMatch = rawText.match(
      /(?:Subject(?:\s*Name)?|Course(?:\s*Title|\s*Name)?|Paper(?:\s*Name)?)\s*[:\-]\s*([^\n\r|]{3,70})/i
    );
    if (subjMatch?.[1]) {
      detectedSubject = subjMatch[1].replace(/\s+/g, ' ').trim();
    } else if (
      typedSubject?.trim() &&
      normalized.toLowerCase().includes(typedSubject.trim().toLowerCase())
    ) {
      detectedSubject = typedSubject.trim();
    }
  }

  const snippet =
    normalized.length > 165 ? `${normalized.slice(0, 162).trimEnd()}...` : normalized;

  return {
    detectedSubject,
    monthYear,
    scheme,
    snippet,
    matchedSubjectFilter,
  };
}

/**
 * Client-side PDF text extraction using pdfjs-dist so token usage stays minimal.
 */
export async function extractTextFromPdfFile(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  // Use bundled worker via URL resolved by Vite
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();
  }

  const buffer = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) });
  const pdf = await loadingTask.promise;
  const maxPages = Math.min(pdf.numPages, 40);
  const pageTexts: string[] = [];

  for (let i = 1; i <= maxPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .filter(Boolean);
    pageTexts.push(strings.join(' '));
  }

  return pageTexts.join('\n\n').trim();
}

/**
 * Apply high-contrast document scan filter to a handwritten photo on an offscreen canvas.
 * Returns a clean JPEG DataURL and pure base64 payload for jsPDF + Gemini Vision grading.
 */
export async function applyDocumentScanFilter(
  file: File,
  enhanceContrast = true
): Promise<{ dataUrl: string; base64: string; mimeType: 'image/jpeg' }> {
  const bitmap = await createImageBitmap(file);
  const maxDim = 1600;
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable.');

  ctx.drawImage(bitmap, 0, 0, width, height);

  if (enhanceContrast) {
    const imgData = ctx.getImageData(0, 0, width, height);
    const d = imgData.data;
    // Document scanner grayscale + contrast stretch
    for (let i = 0; i < d.length; i += 4) {
      const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      const stretched = Math.max(0, Math.min(255, (lum - 128) * 1.45 + 138));
      const clean = stretched > 218 ? 255 : stretched;
      d[i] = clean;
      d[i + 1] = clean;
      d[i + 2] = clean;
    }
    ctx.putImageData(imgData, 0, 0);
  }

  const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
  const base64 = dataUrl.split(',')[1] || '';
  return { dataUrl, base64, mimeType: 'image/jpeg' };
}

/**
 * Compile one or more scanned handwritten answer images into a downloadable PDF via jsPDF.
 */
export function downloadScannedImagesAsPdf(imageDataUrls: string[], fileName: string): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;

  imageDataUrls.forEach((dataUrl, idx) => {
    if (idx > 0) doc.addPage();
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`NEXLIVE Scanned Answer Sheet · Page ${idx + 1}`, margin, 8);
    doc.addImage(
      dataUrl,
      'JPEG',
      margin,
      12,
      pageWidth - margin * 2,
      pageHeight - 22,
      undefined,
      'FAST'
    );
  });

  doc.save(fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`);
}

/**
 * Export Easy Concept Sheet from Core Module A into a clean PDF via jsPDF.
 */
export function downloadEasyConceptPdf(
  folderName: string,
  concept: GeneratedSubfolders['easyConceptPdfs'][number]
): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const margin = 16;
  const maxWidth = doc.internal.pageSize.getWidth() - margin * 2;
  let y = 20;

  const writeWrapped = (text: string, size: number, bold = false, color: [number, number, number] = [15, 23, 42]) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);
    const lines = doc.splitTextToSize(text, maxWidth);
    for (const line of lines) {
      if (y > 276) {
        doc.addPage();
        y = 20;
      }
      doc.text(line, margin, y);
      y += size * 0.48;
    }
    y += 3;
  };

  writeWrapped('NEXLIVE · EASY CONCEPT SHEET', 9, true, [8, 145, 178]);
  writeWrapped(concept.title, 18, true, [15, 23, 42]);
  writeWrapped(`Folder: ${folderName}`, 10, false, [100, 116, 139]);
  y += 2;

  writeWrapped('Summary', 12, true, [79, 70, 229]);
  writeWrapped(concept.summary, 10.5);

  writeWrapped('Plain-English Explanation', 12, true, [79, 70, 229]);
  writeWrapped(concept.explanation, 10.5);

  writeWrapped('Worked Example', 12, true, [79, 70, 229]);
  writeWrapped(concept.workedExample, 10.5);

  writeWrapped('Exam Key Takeaway', 12, true, [8, 145, 178]);
  writeWrapped(concept.keyTakeaway, 10.5, true);

  const safeSlug = concept.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
  doc.save(`nexlive-concept-${safeSlug || 'sheet'}.pdf`);
}

/**
 * Export the One-Shot Exam Panic Mode "Master Rescue PDF" via jsPDF.
 */
export function downloadMasterRescuePdf(pack: MasterRescuePack): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const margin = 15;
  const maxWidth = doc.internal.pageSize.getWidth() - margin * 2;
  let y = 18;

  const ensureSpace = (needed = 14) => {
    if (y + needed > 280) {
      doc.addPage();
      y = 18;
    }
  };

  const writeBlock = (
    text: string,
    size: number,
    bold = false,
    color: [number, number, number] = [15, 23, 42]
  ) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);
    const lines = doc.splitTextToSize(text, maxWidth);
    for (const line of lines) {
      ensureSpace(8);
      doc.text(line, margin, y);
      y += size * 0.46;
    }
    y += 2;
  };

  writeBlock('NEXLIVE · MASTER RESCUE PDF', 9, true, [8, 145, 178]);
  writeBlock(`${pack.subject} (${pack.totalMarks} Marks)`, 19, true, [15, 23, 42]);
  writeBlock(`Generated: ${new Date(pack.createdAt).toLocaleString()}`, 9.5, false, [100, 116, 139]);
  y += 2;

  writeBlock('1. High-Yield Topics & Repeat Frequency', 13, true, [79, 70, 229]);
  for (const t of pack.highYieldTopics) {
    writeBlock(`• ${t.topic} — ${t.repeatTag} [${t.priority}]`, 10);
  }

  y += 2;
  writeBlock('2. Last-Night Crash Plan', 13, true, [79, 70, 229]);
  for (const step of pack.crashPlan) {
    writeBlock(`${step.slot}: ${step.focus} -> ${step.deliverable}`, 10);
  }

  y += 2;
  writeBlock('3. High-Yield Exam Q&A with Lock-In Boxes', 13, true, [79, 70, 229]);
  pack.qaPairs.forEach((qa, idx) => {
    ensureSpace(34);
    writeBlock(`Q${idx + 1}. ${qa.question} (${qa.repeatTag} · ${qa.marksWeight})`, 11, true, [15, 23, 42]);
    writeBlock(qa.answer, 10, false, [30, 41, 59]);
    writeBlock(
      `LOCK-IN BOX — Anchor: ${qa.lockInBox.memoryAnchor} | Key Rule/Formula: ${qa.lockInBox.keyFormulaOrRule} | Check: ${qa.lockInBox.examCheck}`,
      9.5,
      true,
      [8, 145, 178]
    );
    y += 2;
  });

  const slug = pack.subject.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
  doc.save(`nexlive-master-rescue-${slug || 'exam'}.pdf`);
}
