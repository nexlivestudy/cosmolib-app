export type ThemeMode = 'dark' | 'light';

export type ActiveModule =
  | 'dashboard'
  | 'folders'
  | 'panic'
  | 'focus'
  | 'groups'
  | 'live';

export interface LiveRoom {
  id: string;
  name: string;
  topic: string;
  scheduledAt: string;
  createdBy: string;
  isLive: boolean;
}

export interface LiveChatMsg {
  id: string;
  author: string;
  text: string;
  isBot: boolean;
  createdAt: string;
}

export type StreamCategory =
  | 'School / Entrance Boards'
  | 'Higher Education / Engineering'
  | 'Government Exams'
  | 'IT Languages'
  | 'Custom Self-Study';

export type DailyTargetHours = 2 | 4 | 6 | 8;

export type StudyVibe = 'night_cook' | 'early_bird';

export interface StudyFolder {
  id: string;
  email: string;
  displayName: string;
  country: string;
  countryCode: string;
  dailyTargetHours: DailyTargetHours;
  vibe: StudyVibe;
  streamCategory: StreamCategory;
  degreeLevel: string;
  branch: string;
  institution: string;
  primaryGroupId: string;
  joinedGroupIds: string[];
  streakDays: number;
  minutesStudiedToday: number;
  onboardingComplete: boolean;
  isDemoUser?: boolean;
}

export interface StudyGroup {
  id: string;
  name: string;
  type: 'university_branch' | 'global_branch' | 'exam_cohort' | 'community';
  institution?: string;
  branch: string;
  country?: string;
  memberCount: number;
  activeCams: number;
  description: string;
}

export interface FolderResource {
  id: string;
  type: 'pdf' | 'audio' | 'photo' | 'video' | 'youtube';
  title: string;
  createdAt: string;
  extractedText?: string;
  youtubeId?: string;
  youtubeUrl?: string;
  syncedNotes?: { timestamp: string; note: string }[];
  fileSizeLabel?: string;
  previewDataUrl?: string;
}

export interface ConceptItem {
  id: string;
  title: string;
  difficulty: 'Core' | 'High Yield' | 'Advanced';
  estimatedMins: number;
  covered: boolean;
}

export interface GeneratedSubfolders {
  generatedAt: string;
  strategyPlan: {
    phase: string;
    duration: string;
    objective: string;
    actions: string[];
  }[];
  easyConceptPdfs: {
    title: string;
    summary: string;
    explanation: string;
    workedExample: string;
    keyTakeaway: string;
  }[];
  formulasVault: {
    label: string;
    expression: string;
    whenToUse: string;
    trapToAvoid: string;
  }[];
}

export interface StudyFolder {
  id: string;
  name: string;
  subjectTag: string;
  updatedAt: string;
  resources: FolderResource[];
  concepts: ConceptItem[];
  subfolders?: GeneratedSubfolders;
}

export interface RescueQA {
  id: string;
  question: string;
  repeatTag: string;
  marksWeight: string;
  answer: string;
  lockInBox: {
    memoryAnchor: string;
    keyFormulaOrRule: string;
    examCheck: string;
  };
}

export interface RescueMCQ {
  id: string;
  question: string;
  options: [string, string, string, string];
  correctIndex: number;
  explanation: string;
  topic: string;
  repeatTag: string;
}

export interface WrittenPrompt {
  id: string;
  question: string;
  maxMarks: number;
  rubric: string[];
}

export interface HighYieldTopic {
  topic: string;
  repeatTag: string;
  priority: 'Critical' | 'High' | 'Medium';
  fullExplanation: string;
  keyPoints?: string[];
  workedExample?: string;
  youtubeQuery: string;
  youtubeVideoId?: string;
  videoTitle?: string;
}

export interface MasterRescuePack {
  id: string;
  subject: string;
  totalMarks: number;
  createdAt: string;
  crashPlan: {
    slot: string;
    focus: string;
    deliverable: string;
  }[];
  highYieldTopics: HighYieldTopic[];
  qaPairs: RescueQA[];
  mcqQuestions: RescueMCQ[];
  writtenPrompts: WrittenPrompt[];
}

export interface WrittenGradeResult {
  appreciation: string;
  score: number;
  maxScore: number;
  strongPoints: string[];
  missedSteps: string[];
  modelImprovement: string;
}

export interface GroupMessage {
  id: string;
  group_id: string;
  user_id: string;
  author_name: string;
  author_streak: number;
  content: string;
  created_at: string;
}

export interface GroupResourceItem {
  id: string;
  group_id: string;
  user_id: string;
  uploader_name: string;
  title: string;
  category: 'PDF Notes' | 'PYQ Paper' | 'Formula Sheet' | 'Lecture Deck';
  file_url: string;
  file_size: string;
  created_at: string;
}

export interface BuddyProfile {
  id: string;
  name: string;
  branch: string;
  institution: string;
  streakDays: number;
  isStudyingNow: boolean;
  isFollowing: boolean;
  lastAlertSentAt: number | null;
}

export type BYOKProvider = 'default' | 'gemini' | 'groq' | 'openrouter';

export interface BYOKConfig {
  provider: BYOKProvider;
  apiKey: string;
  modelOverride?: string;
}
