import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Circle,
  Download,
  FileAudio,
  FileText,
  Film,
  FolderPlus,
  Image as ImageIcon,
  Play,
  Sparkles,
  Youtube,
} from 'lucide-react';
import { generateFolderSubfolders, generateYouTubeNotes } from '../lib/aiClient';
import type { BYOKConfig, FolderResource, StudyFolder } from '../types';
import { downloadEasyConceptPdf, extractTextFromPdfFile } from '../utils/pdfUtils';
import { sanitizeUserText, validateVaultFile } from '../utils/security';
import {
  calculateConceptMastery,
  chunkStudyText,
  extractSafeYouTubeId,
} from '../utils/studyLogic';

interface StudyFoldersModuleProps {
  folders: StudyFolder[];
  byok: BYOKConfig;
  onUpdateFolders: React.Dispatch<React.SetStateAction<StudyFolder[]>>;
}

export const StudyFoldersModule: React.FC<StudyFoldersModuleProps> = ({
  folders,
  byok,
  onUpdateFolders,
}) => {
  const [selectedFolderId, setSelectedFolderId] = useState(folders[0]?.id || '');
  const [activeTab, setActiveTab] = useState<'materials' | 'strategy' | 'concepts_pdf' | 'formulas' | 'tracker'>('materials');
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderSubject, setNewFolderSubject] = useState('');
  const [youtubeTitle, setYoutubeTitle] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [activeYoutubeId, setActiveYoutubeId] = useState<string | null>(null);
  const [newConceptTitle, setNewConceptTitle] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generatingYtNotes, setGeneratingYtNotes] = useState(false);

  const selectedFolder = useMemo(
    () => folders.find((f) => f.id === selectedFolderId) || folders[0],
    [folders, selectedFolderId]
  );

  const mastery = useMemo(
    () => calculateConceptMastery(selectedFolder?.concepts || []),
    [selectedFolder]
  );

  const updateCurrentFolder = (updater: (folder: StudyFolder) => StudyFolder) => {
    if (!selectedFolder) return;
    onUpdateFolders((prev) =>
      prev.map((f) => (f.id === selectedFolder.id ? updater(f) : f))
    );
  };

  const handleCreateFolder = (e: React.FormEvent) => {
    e.preventDefault();
    const safeName = sanitizeUserText(newFolderName, 100);
    const safeSub = sanitizeUserText(newFolderSubject, 60) || 'General Studies';
    if (!safeName) return;

    const created: StudyFolder = {
      id: `folder-${Date.now()}`,
      name: safeName,
      subjectTag: safeSub,
      updatedAt: 'Just now',
      resources: [],
      concepts: [],
    };
    onUpdateFolders((prev) => [created, ...prev]);
    setSelectedFolderId(created.id);
    setNewFolderName('');
    setNewFolderSubject('');
    setStatusMessage(`Created study folder "${safeName}".`);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !selectedFolder) return;

    setError(null);
    setStatusMessage(null);

    const check = validateVaultFile({
      name: file.name,
      size: file.size,
      type: file.type,
    });
    if (!check.valid) {
      setError(check.error);
      return;
    }

    const sizeLabel = `${(file.size / (1024 * 1024)).toFixed(2)} MB`;
    let resourceType: FolderResource['type'] = 'pdf';
    if (check.ext === 'mp3') resourceType = 'audio';
    else if (check.ext === 'mp4') resourceType = 'video';
    else if (check.ext === 'jpg' || check.ext === 'jpeg' || check.ext === 'png') resourceType = 'photo';

    try {
      let extractedText = '';
      if (resourceType === 'pdf') {
        setStatusMessage(`Extracting text client-side from ${check.safeName}...`);
        extractedText = await extractTextFromPdfFile(file);
      }

      const newRes: FolderResource = {
        id: `res-${Date.now()}`,
        type: resourceType,
        title: check.safeName,
        createdAt: 'Just now',
        fileSizeLabel: sizeLabel,
        extractedText: extractedText || undefined,
      };

      updateCurrentFolder((f) => ({
        ...f,
        updatedAt: 'Just now',
        resources: [newRes, ...f.resources],
      }));
      setStatusMessage(
        resourceType === 'pdf' && extractedText
          ? `Extracted ${extractedText.length.toLocaleString()} chars locally from ${check.safeName} (zero server upload cost).`
          : `Added ${check.safeName} (${sizeLabel}) to ${selectedFolder.name}.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not process the selected file.');
    }
  };

  const handleAddYouTube = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFolder) return;
    setError(null);
    setStatusMessage(null);

    const videoId = extractSafeYouTubeId(youtubeUrl);
    if (!videoId) {
      setError('Enter a valid HTTPS YouTube watch, youtu.be, or embed URL.');
      return;
    }
    const safeTitle = sanitizeUserText(youtubeTitle, 140) || `YouTube Lecture (${videoId})`;
    const resId = `yt-${Date.now()}`;

    const newRes: FolderResource = {
      id: resId,
      type: 'youtube',
      title: safeTitle,
      createdAt: 'Just now',
      youtubeId: videoId,
      youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
      syncedNotes: [],
    };

    updateCurrentFolder((f) => ({
      ...f,
      updatedAt: 'Just now',
      resources: [newRes, ...f.resources],
    }));
    setActiveYoutubeId(videoId);
    setYoutubeTitle('');
    setYoutubeUrl('');

    setGeneratingYtNotes(true);
    try {
      const { syncedNotes } = await generateYouTubeNotes(
        { title: safeTitle, videoId, topicHint: selectedFolder.name },
        byok
      );
      updateCurrentFolder((f) => ({
        ...f,
        resources: f.resources.map((r) => (r.id === resId ? { ...r, syncedNotes } : r)),
      }));
      setStatusMessage(`Loaded distraction-free player and generated ${syncedNotes.length} synced AI notes.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Added video, but synced AI notes could not be generated.');
    } finally {
      setGeneratingYtNotes(false);
    }
  };

  const handleGenerateSubfolders = async () => {
    if (!selectedFolder) return;
    setError(null);
    setStatusMessage(null);
    setGenerating(true);

    try {
      const rawCombined = selectedFolder.resources
        .map((r) => r.extractedText || r.syncedNotes?.map((n) => n.note).join(' ') || '')
        .filter(Boolean)
        .join('\n\n');

      const chunks = chunkStudyText(rawCombined, 2400, 6);
      const resourceTitles = selectedFolder.resources.map((r) => r.title);

      const result = await generateFolderSubfolders(
        {
          folderName: selectedFolder.name,
          subjectTag: selectedFolder.subjectTag,
          chunks,
          resourceTitles,
        },
        byok
      );

      updateCurrentFolder((f) => {
        const existingTitles = new Set(f.concepts.map((c) => c.title.toLowerCase()));
        const mergedConcepts = [
          ...f.concepts,
          ...result.concepts
            .filter((c) => !existingTitles.has(c.title.toLowerCase()))
            .map((c, idx) => ({
              id: `ai-c-${Date.now()}-${idx}`,
              title: sanitizeUserText(c.title, 160),
              difficulty: c.difficulty,
              estimatedMins: c.estimatedMins,
              covered: false,
            })),
        ];
        return {
          ...f,
          updatedAt: 'Just now',
          subfolders: result.subfolders,
          concepts: mergedConcepts,
        };
      });

      setActiveTab('strategy');
      setStatusMessage('Generated Master Study Strategy Plan, Easy Concept PDFs, and Formulas Vault.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI subfolder generation failed.');
    } finally {
      setGenerating(false);
    }
  };

  const toggleConcept = (conceptId: string) => {
    updateCurrentFolder((f) => ({
      ...f,
      concepts: f.concepts.map((c) =>
        c.id === conceptId ? { ...c, covered: !c.covered } : c
      ),
    }));
  };

  const handleAddConcept = (e: React.FormEvent) => {
    e.preventDefault();
    const safeTitle = sanitizeUserText(newConceptTitle, 160);
    if (!safeTitle || !selectedFolder) return;
    updateCurrentFolder((f) => ({
      ...f,
      concepts: [
        ...f.concepts,
        {
          id: `c-${Date.now()}`,
          title: safeTitle,
          difficulty: 'Core',
          estimatedMins: 20,
          covered: false,
        },
      ],
    }));
    setNewConceptTitle('');
  };

  const activeYoutubeResource = useMemo(
    () =>
      selectedFolder?.resources.find(
        (r) => r.type === 'youtube' && (activeYoutubeId ? r.youtubeId === activeYoutubeId : true)
      ),
    [selectedFolder, activeYoutubeId]
  );

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Left Folder Directory */}
      <aside className="space-y-4 lg:col-span-4 xl:col-span-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-[#111827]">
          <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
            Study Folders
          </h2>
          <form onSubmit={handleCreateFolder} className="mt-3 space-y-2">
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="New folder title..."
              aria-label="New folder title"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-[#0B0F19] dark:text-white"
            />
            <div className="flex gap-2">
              <input
                type="text"
                value={newFolderSubject}
                onChange={(e) => setNewFolderSubject(e.target.value)}
                placeholder="Course code / tag"
                aria-label="Course code or tag"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-[#0B0F19] dark:text-white"
              />
              <button
                type="submit"
                aria-label="Create folder"
                className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-500 shrink-0"
              >
                <FolderPlus className="h-3.5 w-3.5" />
                Add
              </button>
            </div>
          </form>

          <div className="mt-4 space-y-1.5">
            {folders.map((folder) => {
              const stats = calculateConceptMastery(folder.concepts);
              const isSelected = folder.id === selectedFolder?.id;
              return (
                <button
                  key={folder.id}
                  type="button"
                  onClick={() => {
                    setSelectedFolderId(folder.id);
                    setActiveYoutubeId(null);
                  }}
                  className={`w-full rounded-lg border p-3 text-left transition-colors ${
                    isSelected
                      ? 'border-cyan-500 bg-cyan-500/10'
                      : 'border-transparent hover:bg-slate-100 dark:hover:bg-slate-800/70'
                  }`}
                >
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">
                    {folder.name}
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    <span>{folder.subjectTag}</span>
                    <span>{stats.percentage}% mastered</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </aside>

      {/* Main Folder Workspace */}
      <section className="space-y-5 lg:col-span-8 xl:col-span-9">
        {selectedFolder && (
          <>
            <div className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center dark:border-slate-800 dark:bg-[#111827]">
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 tabular-nums">
                  {selectedFolder.subjectTag} · {selectedFolder.resources.length} sources · {mastery.coveredCount}/{mastery.totalCount} concepts covered
                </p>
                <h1 className="mt-1 font-display text-2xl font-bold text-slate-900 dark:text-white">
                  {selectedFolder.name}
                </h1>
              </div>

              <button
                type="button"
                disabled={generating}
                onClick={handleGenerateSubfolders}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-500 disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                <Sparkles className="h-4 w-4" />
                {generating ? 'Generating AI Subfolders...' : 'Generate AI Subfolders'}
              </button>
            </div>

            {error && (
              <div role="alert" className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-xs font-medium text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                {error}
              </div>
            )}

            {statusMessage && (
              <div role="status" className="rounded-lg border border-cyan-300 bg-cyan-50 px-4 py-3 text-xs font-medium text-cyan-900 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-200">
                {statusMessage}
              </div>
            )}

            {/* Subfolder Segmented Navigation */}
            <div className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1 dark:border-slate-800 dark:bg-[#0F1624]">
              {(
                [
                  { id: 'materials', label: 'Multi-Format Sources' },
                  { id: 'strategy', label: 'Strategy Plan' },
                  { id: 'concepts_pdf', label: 'Easy Concept PDFs' },
                  { id: 'formulas', label: 'Tips & Formulas Vault' },
                  { id: 'tracker', label: `Concept Tracker (${mastery.percentage}%)` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-[#1E293B] dark:text-white'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab 1: Multi-Format Sources + Distraction-Free YouTube */}
            {activeTab === 'materials' && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {/* File Upload (PDF, Audio, Photo, Video) */}
                  <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#111827]">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                      Upload Study Material
                    </h3>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      PDFs are extracted locally in your browser via pdfjs-dist. Allowed: PDF, JPG, PNG, MP3, MP4 (max 50 MB).
                    </p>
                    <label className="mt-4 flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-xs font-semibold text-slate-700 hover:border-cyan-500 dark:border-slate-700 dark:bg-[#0B0F19] dark:text-slate-200">
                      <span>Choose PDF, Audio, Note Photo, or Video</span>
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.mp3,.mp4"
                        onChange={handleFileUpload}
                        className="sr-only"
                      />
                    </label>
                  </div>

                  {/* Distraction-Free YouTube Link Adder */}
                  <form
                    onSubmit={handleAddYouTube}
                    className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#111827]"
                  >
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                      Add Distraction-Free YouTube Lecture
                    </h3>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Strips recommendations and generates timestamped AI notes alongside the player.
                    </p>
                    <div className="mt-3 space-y-2">
                      <input
                        type="text"
                        value={youtubeTitle}
                        onChange={(e) => setYoutubeTitle(e.target.value)}
                        placeholder="Lecture title (e.g., Dijkstra Shortest Path)"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-[#0B0F19] dark:text-white"
                      />
                      <div className="flex gap-2">
                        <input
                          type="url"
                          required
                          value={youtubeUrl}
                          onChange={(e) => setYoutubeUrl(e.target.value)}
                          placeholder="https://www.youtube.com/watch?v=..."
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-[#0B0F19] dark:text-white"
                        />
                        <button
                          type="submit"
                          disabled={generatingYtNotes}
                          className="rounded-lg bg-cyan-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-cyan-500 disabled:opacity-50 whitespace-nowrap"
                        >
                          {generatingYtNotes ? 'Syncing...' : 'Add Video'}
                        </button>
                      </div>
                    </div>
                  </form>
                </div>

                {/* Distraction-Free YouTube Player + Synced Notes */}
                {activeYoutubeResource?.youtubeId && (
                  <div className="grid grid-cols-1 gap-5 rounded-xl border border-slate-200 bg-white p-5 xl:grid-cols-12 dark:border-slate-800 dark:bg-[#111827]">
                    <div className="xl:col-span-7">
                      <div className="flex items-center justify-between pb-3">
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                          {activeYoutubeResource.title}
                        </h3>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          Distraction-Free Embed
                        </span>
                      </div>
                      <div className="aspect-video overflow-hidden rounded-lg bg-black">
                        <iframe
                          title={activeYoutubeResource.title}
                          src={`https://www.youtube-nocookie.com/embed/${activeYoutubeResource.youtubeId}?rel=0&modestbranding=1`}
                          allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          className="h-full w-full border-0"
                        />
                      </div>
                    </div>
                    <div className="xl:col-span-5">
                      <h4 className="text-xs font-semibold text-cyan-700 dark:text-cyan-400">
                        Synced AI Lecture Notes
                      </h4>
                      <div className="mt-3 max-h-72 space-y-2.5 overflow-y-auto pr-1">
                        {(activeYoutubeResource.syncedNotes || []).map((note, idx) => (
                          <div
                            key={idx}
                            className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-[#0B0F19]"
                          >
                            <span className="font-mono text-xs font-semibold text-indigo-600 tabular-nums dark:text-cyan-400">
                              {note.timestamp}
                            </span>
                            <p className="mt-1 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                              {note.note}
                            </p>
                          </div>
                        ))}
                        {(!activeYoutubeResource.syncedNotes || activeYoutubeResource.syncedNotes.length === 0) && (
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            No synced notes generated yet for this video.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Resource List */}
                <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#111827]">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Folder Files & Links
                  </h3>
                  <div className="mt-3 divide-y divide-slate-200 dark:divide-slate-800">
                    {selectedFolder.resources.map((res) => (
                      <div key={res.id} className="flex items-center justify-between gap-4 py-3">
                        <div className="flex items-center gap-3 min-w-0">
                          {res.type === 'pdf' && <FileText className="h-4 w-4 shrink-0 text-indigo-500" />}
                          {res.type === 'audio' && <FileAudio className="h-4 w-4 shrink-0 text-amber-500" />}
                          {res.type === 'photo' && <ImageIcon className="h-4 w-4 shrink-0 text-emerald-500" />}
                          {res.type === 'video' && <Film className="h-4 w-4 shrink-0 text-rose-500" />}
                          {res.type === 'youtube' && <Youtube className="h-4 w-4 shrink-0 text-red-500" />}
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-slate-900 dark:text-white">
                              {res.title}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              {res.type.toUpperCase()} {res.fileSizeLabel ? `· ${res.fileSizeLabel}` : ''} · {res.createdAt}
                              {res.extractedText ? ` · ${res.extractedText.length.toLocaleString()} chars indexed` : ''}
                            </div>
                          </div>
                        </div>

                        {res.type === 'youtube' && res.youtubeId && (
                          <button
                            type="button"
                            onClick={() => setActiveYoutubeId(res.youtubeId!)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                          >
                            <Play className="h-3.5 w-3.5" />
                            Watch
                          </button>
                        )}
                      </div>
                    ))}
                    {selectedFolder.resources.length === 0 && (
                      <p className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">
                        Upload a PDF, audio recording, handwritten note photo, or YouTube link to get started.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Master Study Strategy Plan */}
            {activeTab === 'strategy' && (
              <div className="space-y-4">
                {(selectedFolder.subfolders?.strategyPlan || []).map((phase, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#111827]"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                        {phase.phase}
                      </h3>
                      <span className="font-mono text-xs text-cyan-700 dark:text-cyan-400">
                        {phase.duration}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300">
                      {phase.objective}
                    </p>
                    <ul className="mt-3 space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                      {phase.actions.map((act, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="font-mono text-indigo-600 dark:text-cyan-400">{i + 1}.</span>
                          <span>{act}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                {!selectedFolder.subfolders && (
                  <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-[#111827] dark:text-slate-400">
                    Click &ldquo;Generate AI Subfolders&rdquo; above to build your Master Study Strategy Plan.
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: Easy Concept PDFs (with jsPDF download) */}
            {activeTab === 'concepts_pdf' && (
              <div className="space-y-4">
                {(selectedFolder.subfolders?.easyConceptPdfs || []).map((sheet, idx) => (
                  <article
                    key={idx}
                    className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-[#111827]"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                          {sheet.title}
                        </h3>
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                          {sheet.summary}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => downloadEasyConceptPdf(selectedFolder.name, sheet)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-cyan-600 dark:hover:bg-cyan-500 whitespace-nowrap"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Download PDF
                      </button>
                    </div>
                    <div className="mt-4 space-y-3 border-t border-slate-200 pt-4 text-sm text-slate-700 dark:border-slate-800 dark:text-slate-300">
                      <p>{sheet.explanation}</p>
                      <div className="rounded-lg bg-slate-50 p-3.5 text-xs dark:bg-[#0B0F19]">
                        <div className="font-semibold text-indigo-600 dark:text-indigo-400">Worked Example</div>
                        <p className="mt-1 leading-relaxed">{sheet.workedExample}</p>
                      </div>
                      <p className="text-xs font-semibold text-cyan-700 dark:text-cyan-400">
                        Exam Key Takeaway: {sheet.keyTakeaway}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            )}

            {/* Tab 4: Tips, Formulas & Key Points Vault */}
            {activeTab === 'formulas' && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {(selectedFolder.subfolders?.formulasVault || []).map((item, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#111827]"
                  >
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                      {item.label}
                    </h3>
                    <div className="mt-2 rounded-lg bg-slate-100 px-3 py-2.5 font-mono text-xs font-medium text-indigo-700 dark:bg-[#0B0F19] dark:text-cyan-300">
                      {item.expression}
                    </div>
                    <p className="mt-3 text-xs text-slate-600 dark:text-slate-400">
                      <strong className="text-slate-800 dark:text-slate-200">When to use:</strong> {item.whenToUse}
                    </p>
                    <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                      <strong>Trap to avoid:</strong> {item.trapToAvoid}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Tab 5: Concept Mastery Tracker (Covered vs Uncovered) */}
            {activeTab === 'tracker' && (
              <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-[#111827]">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                      Concept Mastery Tracker
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      {mastery.coveredCount} Covered · {mastery.uncoveredCount} Uncovered · {mastery.percentage}% complete
                    </p>
                  </div>
                  <div className="h-2 w-48 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                    <div className="h-full bg-emerald-500 transition-all" style={{ width: `${mastery.percentage}%` }} />
                  </div>
                </div>

                <form onSubmit={handleAddConcept} className="mt-4 flex gap-2">
                  <input
                    type="text"
                    value={newConceptTitle}
                    onChange={(e) => setNewConceptTitle(e.target.value)}
                    placeholder="Add concept to track..."
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-[#0B0F19] dark:text-white"
                  />
                  <button
                    type="submit"
                    className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-500 whitespace-nowrap"
                  >
                    Add Concept
                  </button>
                </form>

                <div className="mt-4 divide-y divide-slate-200 dark:divide-slate-800">
                  {selectedFolder.concepts.map((concept) => (
                    <button
                      key={concept.id}
                      type="button"
                      onClick={() => toggleConcept(concept.id)}
                      className="flex w-full items-center justify-between gap-4 py-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    >
                      <div className="flex items-center gap-3">
                        {concept.covered ? (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                        ) : (
                          <Circle className="h-4 w-4 shrink-0 text-slate-400" />
                        )}
                        <span
                          className={`text-sm ${
                            concept.covered
                              ? 'text-slate-400 line-through'
                              : 'font-medium text-slate-900 dark:text-slate-100'
                          }`}
                        >
                          {concept.title}
                        </span>
                      </div>
                      <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap">
                        {concept.difficulty} · {concept.estimatedMins}m · {concept.covered ? 'Covered' : 'Uncovered'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
};
