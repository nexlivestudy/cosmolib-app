import type { StudyFolder, StudyGroup, MasterRescuePack, StreamCategory, BuddyProfile } from '../types';

export interface CountryOption {
  code: string;
  name: string;
  region: string;
}

export const GLOBAL_COUNTRIES: CountryOption[] = [
  { code: 'IN', name: 'India', region: 'South Asia' },
  { code: 'US', name: 'United States', region: 'North America' },
  { code: 'GB', name: 'United Kingdom', region: 'Europe' },
  { code: 'CA', name: 'Canada', region: 'North America' },
  { code: 'DE', name: 'Germany', region: 'Europe' },
  { code: 'AU', name: 'Australia', region: 'Oceania' },
  { code: 'SG', name: 'Singapore', region: 'Southeast Asia' },
  { code: 'JP', name: 'Japan', region: 'East Asia' },
  { code: 'KR', name: 'South Korea', region: 'East Asia' },
  { code: 'FR', name: 'France', region: 'Europe' },
  { code: 'NL', name: 'Netherlands', region: 'Europe' },
  { code: 'CH', name: 'Switzerland', region: 'Europe' },
  { code: 'AE', name: 'United Arab Emirates', region: 'Middle East' },
  { code: 'BR', name: 'Brazil', region: 'South America' },
  { code: 'NG', name: 'Nigeria', region: 'Africa' },
  { code: 'ZA', name: 'South Africa', region: 'Africa' },
  { code: 'ID', name: 'Indonesia', region: 'Southeast Asia' },
  { code: 'MY', name: 'Malaysia', region: 'Southeast Asia' },
  { code: 'PH', name: 'Philippines', region: 'Southeast Asia' },
  { code: 'PK', name: 'Pakistan', region: 'South Asia' },
  { code: 'BD', name: 'Bangladesh', region: 'South Asia' },
  { code: 'MX', name: 'Mexico', region: 'North America' },
  { code: 'ES', name: 'Spain', region: 'Europe' },
  { code: 'IT', name: 'Italy', region: 'Europe' },
  { code: 'SE', name: 'Sweden', region: 'Europe' },
  { code: 'PL', name: 'Poland', region: 'Europe' },
  { code: 'TR', name: 'Turkey', region: 'Middle East / Europe' },
  { code: 'EG', name: 'Egypt', region: 'Africa' },
  { code: 'KE', name: 'Kenya', region: 'Africa' },
  { code: 'NZ', name: 'New Zealand', region: 'Oceania' },
];

export interface DegreeCatalogEntry {
  branches: string[];
  institutions: string[];
}

export interface StreamCatalogConfig {
  degreeLevels: string[];
  byDegree: Record<string, DegreeCatalogEntry>;
}

export const STREAM_OPTIONS: Record<StreamCategory, StreamCatalogConfig> = {
  'School / Entrance Boards': {
    degreeLevels: [
      'Grade 10 Board',
      'Grade 12 / Senior Secondary',
      'JEE Main & Advanced',
      'NEET UG',
      'SAT / AP / IB Diploma',
      'A-Levels / GCSE',
    ],
    byDegree: {
      'Grade 10 Board': {
        branches: [
          'Mathematics & Science Core',
          'Social Studies & Languages',
          'Computer Applications Track',
          'Foundation Olympiad Track',
        ],
        institutions: [
          'CBSE National Board',
          'ICSE Board',
          'Maharashtra SSC Board',
          'Cambridge IGCSE',
          'State Secondary Board',
        ],
      },
      'Grade 12 / Senior Secondary': {
        branches: [
          'Physics, Chemistry & Mathematics (PCM)',
          'Physics, Chemistry & Biology (PCB)',
          'Commerce & Accountancy',
          'Humanities & Economics',
          'Computer Science Track',
        ],
        institutions: [
          'CBSE Senior Secondary',
          'ISC Board',
          'Maharashtra HSC Board',
          'Kendriya Vidyalaya Sangathan',
          'State Higher Secondary Board',
        ],
      },
      'JEE Main & Advanced': {
        branches: [
          'Physics, Chemistry & Mathematics (PCM)',
          'JEE Advanced Intensive Problem Solving',
          'JEE Main Rapid Revision Track',
          'Mathematics & Physics Olympiad Bridge',
        ],
        institutions: [
          'Allen Career Institute JEE Cohort',
          'Resonance / FIITJEE Cohort',
          'PhysicsWallah JEE Batch',
          'Self-Prep JEE Aspirants',
        ],
      },
      'NEET UG': {
        branches: [
          'Physics, Chemistry & Biology (PCB)',
          'NCERT Biology High-Yield Mastery',
          'Organic & Inorganic Chemistry Drill',
          'Medical Entrance Dropper Sprint',
        ],
        institutions: [
          'Aakash NEET Medical Cohort',
          'Allen Medical Division',
          'NCERT National Medical Prep',
          'Self-Prep NEET UG Batch',
        ],
      },
      'SAT / AP / IB Diploma': {
        branches: [
          'SAT Digital Math & Reading/Writing',
          'AP STEM (Calculus BC, Physics C, CS A)',
          'IB Diploma HL Sciences & Math AA',
          'IB Diploma Humanities & Economics',
        ],
        institutions: [
          'IB World Schools',
          'College Board AP Cohort',
          'Global SAT Prep Commons',
          'International Baccalaureate Collective',
        ],
      },
      'A-Levels / GCSE': {
        branches: [
          'A-Level Maths, Further Maths & Physics',
          'A-Level Biology & Chemistry',
          'A-Level Economics & History',
          'GCSE Combined Sciences & Maths',
        ],
        institutions: [
          'Cambridge International (CAIE)',
          'Edexcel / Pearson Cohort',
          'AQA / OCR UK Sixth Form',
          'UK Sixth Form Colleges',
        ],
      },
    },
  },
  'Higher Education / Engineering': {
    degreeLevels: [
      'B.Tech / B.E.',
      'B.Sc / BS',
      'M.Tech / MS',
      'MBA / Management',
      'MBBS / Medical',
      'LLB / Law',
      'PhD / Research',
    ],
    byDegree: {
      'B.Tech / B.E.': {
        branches: [
          'Computer Science & Engineering (CSE)',
          'Artificial Intelligence & Data Science',
          'Electronics & Communication (ECE)',
          'Electrical Engineering',
          'Mechanical Engineering',
          'Civil Engineering',
          'Information Technology (IT)',
          'Chemical Engineering',
          'Aerospace Engineering',
          'Biotechnology Engineering',
        ],
        institutions: [
          'IIT Bombay',
          'IIT Delhi',
          'IIT Madras',
          'MIT',
          'Stanford University',
          'NIT Trichy',
          'BITS Pilani',
          'VIT Vellore',
          'COEP Technological University',
          'TU Munich',
          'National University of Singapore',
          'University of Toronto',
          'Savitribai Phule Pune University',
          'Mumbai University',
        ],
      },
      'B.Sc / BS': {
        branches: [
          'Computer Science',
          'Mathematics & Statistics',
          'Physics',
          'Chemistry',
          'Biotechnology & Microbiology',
          'Data Science & Analytics',
          'Economics',
          'Environmental Science',
        ],
        institutions: [
          'IISc Bengaluru',
          'University of Delhi',
          'St. Stephen’s College, Delhi',
          'University of Oxford',
          'University of Cambridge',
          'UC Berkeley',
          'ETH Zurich',
          'University of Toronto',
          'National University of Singapore',
          'Mumbai University',
        ],
      },
      'M.Tech / MS': {
        branches: [
          'Computer Science & Artificial Intelligence',
          'Machine Learning & Robotics',
          'VLSI & Embedded Systems',
          'Data Science & Distributed Systems',
          'Cybersecurity & Cloud Systems',
          'Thermal & Mechanical Systems',
          'Structural & Civil Engineering',
        ],
        institutions: [
          'MIT',
          'Stanford University',
          'Carnegie Mellon University',
          'ETH Zurich',
          'TU Munich',
          'IIT Bombay',
          'IIT Delhi',
          'IISc Bengaluru',
          'University of Toronto',
          'National University of Singapore',
        ],
      },
      'MBA / Management': {
        branches: [
          'Finance & Investment Banking',
          'Marketing & Brand Strategy',
          'Operations & Supply Chain',
          'Business Analytics',
          'Strategy & Management Consulting',
          'Human Resource Management',
          'Entrepreneurship & Venture Capital',
        ],
        institutions: [
          'IIM Ahmedabad',
          'IIM Bangalore',
          'IIM Calcutta',
          'ISB Hyderabad',
          'XLRI Jamshedpur',
          'Harvard Business School',
          'Wharton School (UPenn)',
          'Stanford GSB',
          'INSEAD',
          'London Business School',
        ],
      },
      'MBBS / Medical': {
        branches: [
          'General Medicine',
          'Anatomy',
          'Physiology',
          'Biochemistry',
          'Pathology',
          'Pharmacology',
          'Microbiology',
          'General Surgery',
          'Pediatrics',
          'Obstetrics & Gynecology',
          'Orthopedics',
          'Community Medicine',
        ],
        institutions: [
          'AIIMS New Delhi',
          'CMC Vellore',
          'JIPMER Puducherry',
          'AFMC Pune',
          'Maulana Azad Medical College (MAMC)',
          'Grant Government Medical College, Mumbai',
          'King George’s Medical University (KGMU)',
          'Johns Hopkins School of Medicine',
          'Harvard Medical School',
          'Oxford Medical Sciences Division',
          'Karolinska Institutet',
          'NUS Yong Loo Lin School of Medicine',
        ],
      },
      'LLB / Law': {
        branches: [
          'Constitutional Law',
          'Corporate & Commercial Law',
          'Criminal Law & Procedure',
          'Intellectual Property Law',
          'International & Human Rights Law',
          'Taxation Law',
          'Arbitration & Dispute Resolution',
        ],
        institutions: [
          'NLSIU Bengaluru',
          'NALSAR Hyderabad',
          'NLU Delhi',
          'Faculty of Law, University of Delhi',
          'ILS Law College, Pune',
          'Government Law College, Mumbai',
          'Harvard Law School',
          'Yale Law School',
          'Oxford Faculty of Law',
          'LSE Law School',
        ],
      },
      'PhD / Research': {
        branches: [
          'Computer Science & AI Research',
          'Biomedical & Life Sciences',
          'Theoretical & Applied Physics',
          'Materials Science & Chemistry',
          'Economics & Public Policy',
          'Neuroscience & Cognitive Science',
        ],
        institutions: [
          'MIT',
          'Stanford University',
          'Caltech',
          'IISc Bengaluru',
          'Max Planck Institutes',
          'ETH Zurich',
          'University of Oxford',
          'University of Cambridge',
          'IIT Bombay',
        ],
      },
    },
  },
  'Government Exams': {
    degreeLevels: [
      'National Civil Services',
      'Engineering Services',
      'Banking & Regulatory',
      'Defense & Staff Selection',
    ],
    byDegree: {
      'National Civil Services': {
        branches: [
          'UPSC CSE (IAS / IPS / IFS)',
          'State PCS / Civil Services',
          'General Studies & CSAT',
          'Optional Subject & Essay Mastery',
        ],
        institutions: [
          'UPSC National Cohort',
          'State PSC Aspirants Hub',
          'Self-Study Civil Services Commons',
        ],
      },
      'Engineering Services': {
        branches: [
          'GATE CS & Data Science (DA)',
          'GATE Electronics & Communication (ECE)',
          'GATE Electrical Engineering (EE)',
          'GATE Mechanical Engineering (ME)',
          'GATE Civil Engineering (CE)',
          'UPSC IES / ESE Engineering Services',
        ],
        institutions: [
          'GATE All-India Rankers',
          'IES / ESE National Cohort',
          'PSU Technical Prep Commons',
        ],
      },
      'Banking & Regulatory': {
        branches: [
          'RBI Grade B (Phase 1 & 2)',
          'SBI PO & IBPS PO',
          'SEBI Grade A & NABARD',
          'Quantitative Aptitude, Reasoning & Finance',
        ],
        institutions: [
          'RBI & Regulatory Prep Cohort',
          'Banking & Finance Prep',
          'Self-Prep Banking Desk',
        ],
      },
      'Defense & Staff Selection': {
        branches: [
          'SSC CGL (Tier 1 & 2)',
          'UPSC CDS & AFCAT Officer Prep',
          'NDA & Naval Academy',
          'CAPF Assistant Commandant',
        ],
        institutions: [
          'SSC National Aspirants',
          'Defense Services Prep Commons',
          'Public Service Commons',
        ],
      },
    },
  },
  'IT Languages': {
    degreeLevels: [
      'Foundations',
      'Production Track',
      'System Design & DSA',
      'Cloud & AI Engineering',
    ],
    byDegree: {
      Foundations: {
        branches: [
          'JavaScript & TypeScript Essentials',
          'Python Programming Basics',
          'Java Core & Object-Oriented Design',
          'C / C++ Fundamentals',
          'SQL & Relational Modeling',
        ],
        institutions: [
          'Global Open-Source Learners',
          'CS50 & Foundations Guild',
          'Self-Taught Developers Hub',
        ],
      },
      'Production Track': {
        branches: [
          'TypeScript & Full-Stack Web',
          'Java & Spring Backend',
          'Python & FastAPI / Django',
          'Go & Cloud-Native Microservices',
          'Flutter & React Native Mobile',
        ],
        institutions: [
          'Full-Stack Builders Cohort',
          'Production Engineering Guild',
          'Global Open-Source Learners',
        ],
      },
      'System Design & DSA': {
        branches: [
          'C++ Competitive DSA',
          'Java / Python Interview DSA',
          'High-Level & Low-Level System Design',
          'SQL & Distributed Databases',
        ],
        institutions: [
          'LeetCode & DSA Guild',
          'Interview Prep Commons',
          'Systems Architects Collective',
        ],
      },
      'Cloud & AI Engineering': {
        branches: [
          'Python & Machine Learning',
          'LLM Applications & Applied GenAI',
          'Rust & Systems Programming',
          'AWS / GCP / Kubernetes DevOps',
        ],
        institutions: [
          'AI Builders Cohort',
          'Cloud Architects Collective',
          'MLOps & Infrastructure Guild',
        ],
      },
    },
  },
  'Custom Self-Study': {
    degreeLevels: ['Independent Deep Dive', 'Certification Prep', 'Research Sprint'],
    byDegree: {
      'Independent Deep Dive': {
        branches: [
          'Custom Curriculum',
          'Interdisciplinary STEM',
          'Language Fluency',
          'Quantitative Finance',
        ],
        institutions: ['Independent Study Desk', 'Global Self-Learners Commons'],
      },
      'Certification Prep': {
        branches: [
          'Cloud Architect (AWS / GCP / Azure)',
          'CFA / FRM Finance Certification',
          'Cybersecurity (CompTIA / OSCP)',
          'PMP & Product Management',
        ],
        institutions: ['Global Certification Cohort', 'Independent Study Desk'],
      },
      'Research Sprint': {
        branches: [
          'Literature Review & Paper Synthesis',
          'Open-Source Thesis / Capstone',
          'Experimental Lab & Data Analysis',
        ],
        institutions: ['Independent Research Desk', 'Open Science Collective'],
      },
    },
  },
};

export function getDegreeLevelsForStream(stream: StreamCategory): string[] {
  return STREAM_OPTIONS[stream]?.degreeLevels ?? [];
}

/**
 * Strictly returns ONLY the branches mapped to the given (stream, degreeLevel).
 * Never falls back to another degree's branches.
 */
export function getBranchesForDegree(stream: StreamCategory, degreeLevel: string): string[] {
  const entry = STREAM_OPTIONS[stream]?.byDegree[degreeLevel];
  return entry ? entry.branches : [];
}

/**
 * Strictly returns ONLY the institutions mapped to the given (stream, degreeLevel).
 * Never falls back to another degree's institutions.
 */
export function getInstitutionsForDegree(stream: StreamCategory, degreeLevel: string): string[] {
  const entry = STREAM_OPTIONS[stream]?.byDegree[degreeLevel];
  return entry ? entry.institutions : [];
}

export function detectUserCountry(): CountryOption {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    if (tz.includes('Kolkata') || tz.includes('Calcutta')) return GLOBAL_COUNTRIES[0];
    if (tz.includes('America/New_York') || tz.includes('Los_Angeles') || tz.includes('Chicago')) return GLOBAL_COUNTRIES[1];
    if (tz.includes('Europe/London')) return GLOBAL_COUNTRIES[2];
    if (tz.includes('America/Toronto') || tz.includes('Vancouver')) return GLOBAL_COUNTRIES[3];
    if (tz.includes('Europe/Berlin')) return GLOBAL_COUNTRIES[4];
    if (tz.includes('Australia/')) return GLOBAL_COUNTRIES[5];
    if (tz.includes('Asia/Singapore')) return GLOBAL_COUNTRIES[6];
    if (tz.includes('Asia/Tokyo')) return GLOBAL_COUNTRIES[7];
  } catch {
    // fallback
  }
  return GLOBAL_COUNTRIES[0];
}

export const EXPLORE_STUDY_GROUPS: StudyGroup[] = [
  {
    id: 'global-computer-science-engineering',
    name: 'Global Computer Science & Engineering Commons',
    type: 'global_branch',
    branch: 'Computer Science & Engineering',
    memberCount: 4120,
    activeCams: 112,
    description: 'Operating Systems, DBMS, Algorithms, and Distributed Systems study hall with 24/7 silent cameras.',
  },
  {
    id: 'exam-gate-cs-2027',
    name: 'GATE CS & AI Rankers Hub',
    type: 'exam_cohort',
    branch: 'GATE CS & DA',
    memberCount: 1890,
    activeCams: 64,
    description: 'Daily PYQ sprint, mock test reviews, and formula sheets for GATE Computer Science & Data Science.',
  },
  {
    id: 'global-jee-pcm-night-owls',
    name: 'Global Physics & Calculus Deep Work',
    type: 'community',
    branch: 'Physics, Chemistry & Mathematics (PCM)',
    memberCount: 2350,
    activeCams: 78,
    description: 'Silent 50/10 problem-solving blocks for mechanics, electromagnetism, and multivariable calculus.',
  },
  {
    id: 'global-medical-anatomy-sprint',
    name: 'Clinical Medicine & Anatomy Vault',
    type: 'community',
    branch: 'MBBS / Medical',
    memberCount: 1470,
    activeCams: 49,
    description: 'High-yield pathology tables, pharmacology mnemonics, and silent late-night review rooms.',
  },
];

export const INITIAL_STUDY_FOLDERS: StudyFolder[] = [
  {
    id: 'folder-os-kernels',
    name: 'Operating Systems & Concurrency',
    subjectTag: 'CS-304 · Core',
    updatedAt: 'Today, 02:15',
    resources: [
      {
        id: 'res-pdf-1',
        type: 'pdf',
        title: 'Unit 3 — CPU Scheduling & Deadlocks.pdf',
        createdAt: '2h ago',
        fileSizeLabel: '2.4 MB',
        extractedText:
          'Preemptive vs Non-preemptive scheduling: Round Robin uses a fixed time quantum q. Shortest Remaining Time First (SRTF) minimizes average waiting time. Deadlock requires 4 Coffman conditions: Mutual Exclusion, Hold and Wait, No Preemption, Circular Wait. Banker algorithm checks safe sequence before resource allocation.',
      },
      {
        id: 'res-yt-1',
        type: 'youtube',
        title: 'Virtual Memory & Page Replacement Explained',
        createdAt: 'Yesterday',
        youtubeId: 'qlH4-oHnBb8',
        youtubeUrl: 'https://www.youtube.com/watch?v=qlH4-oHnBb8',
        syncedNotes: [
          { timestamp: '00:45', note: 'Logical vs physical address spaces separated by the MMU page table.' },
          { timestamp: '04:20', note: 'TLB hit ratio dominates Effective Access Time: EAT = α(t+m) + (1-α)(t+2m).' },
          { timestamp: '08:10', note: 'Belady anomaly occurs in FIFO replacement, never in stack algorithms like LRU or Optimal.' },
        ],
      },
    ],
    concepts: [
      { id: 'c1', title: 'Process State Transitions & PCB Layout', difficulty: 'Core', estimatedMins: 15, covered: true },
      { id: 'c2', title: 'SRTF, SJF & Round-Robin Gantt Charts', difficulty: 'High Yield', estimatedMins: 25, covered: true },
      { id: 'c3', title: 'Coffman Deadlock Conditions & Banker Algorithm', difficulty: 'High Yield', estimatedMins: 30, covered: false },
      { id: 'c4', title: 'TLB Effective Access Time & Multi-Level Paging', difficulty: 'Advanced', estimatedMins: 35, covered: false },
      { id: 'c5', title: 'LRU vs FIFO Page Fault Analysis', difficulty: 'High Yield', estimatedMins: 20, covered: false },
    ],
    subfolders: {
      generatedAt: new Date().toISOString(),
      strategyPlan: [
        {
          phase: 'Phase 1 · Scheduling Mechanics',
          duration: '45 mins',
          objective: 'Master Gantt chart timing and turnaround/waiting-time formulas without arithmetic slips.',
          actions: [
            'Solve 3 mixed arrival-time SRTF and Round-Robin numericals.',
            'Verify Turnaround = Completion - Arrival and Waiting = Turnaround - Burst.',
            'Compare starvation risks in Priority Scheduling vs Aging.',
          ],
        },
        {
          phase: 'Phase 2 · Deadlocks & Safe Sequences',
          duration: '40 mins',
          objective: 'Execute Banker safety checks cleanly under exam time pressure.',
          actions: [
            'Memorize all 4 Coffman conditions verbatim for 4-mark theory prompts.',
            'Compute Need = Max - Allocation matrix before testing process eligibility.',
            'Trace one unsafe state counterexample.',
          ],
        },
      ],
      easyConceptPdfs: [
        {
          title: 'Deadlock Conditions & Banker Safety Algorithm',
          summary: 'A deadlock occurs when circular resource dependencies permanently block a set of processes.',
          explanation:
            'All four Coffman conditions (Mutual Exclusion, Hold and Wait, No Preemption, Circular Wait) must hold simultaneously for a deadlock to arise. Breaking any single condition prevents deadlock. Banker’s Algorithm avoids deadlocks dynamically by simulating every allocation request and granting it only if at least one safe completion sequence exists.',
          workedExample:
            'Given Available = [3, 3, 2], compute Need[i] = Max[i] - Alloc[i]. Pick process P1 where Need[1] <= Available, release Alloc[1] back into Work, and repeat until all processes finish.',
          keyTakeaway: 'Always show the Need matrix explicitly on the answer sheet — examiners award 40% of marks for that step alone.',
        },
      ],
      formulasVault: [
        {
          label: 'Effective Access Time (TLB)',
          expression: 'EAT = α(t_TLB + t_mem) + (1 - α)(t_TLB + 2·t_mem)',
          whenToUse: 'Single-level paging problems specifying TLB hit ratio α and lookup times.',
          trapToAvoid: 'Do not forget to add t_TLB on a TLB miss — the TLB is checked first in both branches.',
        },
        {
          label: 'Turnaround & Waiting Time',
          expression: 'TAT = CT - AT   |   WT = TAT - BT',
          whenToUse: 'Every CPU scheduling table calculation.',
          trapToAvoid: 'Never assume AT = 0 unless explicitly stated in the problem statement.',
        },
      ],
    },
  },
];

export const SAMPLE_RESCUE_PACK: MasterRescuePack = {
  id: 'sample-rescue-dbms',
  subject: 'Database Management Systems (Sample Pack)',
  totalMarks: 60,
  createdAt: new Date().toISOString(),
  crashPlan: [
    { slot: '00:00 – 00:45', focus: 'Normalization (1NF to BCNF)', deliverable: 'Decompose 2 lossless-join & dependency-preserving schemas' },
    { slot: '00:45 – 01:30', focus: 'Transactions & ACID + Conflict Serializability', deliverable: 'Draw precedence graphs for 4 concurrent schedules' },
    { slot: '01:30 – 02:15', focus: 'B+ Trees & Indexing Math', deliverable: 'Calculate max order p and tree height for 1M records' },
    { slot: '02:15 – 03:00', focus: 'SQL Joins, Window Functions & PYQ Drill', deliverable: 'Score >= 85% on the 40-question MCQ drill' },
  ],
  highYieldTopics: [
    {
      topic: 'BCNF vs 3NF Lossless Decomposition',
      repeatTag: 'Repeated 6x',
      priority: 'Critical',
      fullExplanation:
        'Third Normal Form (3NF) permits a non-trivial functional dependency X -> Y whenever X is a superkey OR Y is a prime attribute (part of any candidate key). Boyce-Codd Normal Form (BCNF) closes that prime-attribute loophole: for every non-trivial FD X -> Y, the determinant X MUST be a superkey. When decomposing a table into BCNF, pick a violating FD X -> Y, split R into R1(X ∪ Y) and R2(R - (Y - X)), and repeat. This always guarantees a lossless-join decomposition because the common attribute X is a superkey of R1, though dependency preservation is not always guaranteed.',
      keyPoints: [
        '3NF rule: X is a superkey OR Y is a prime attribute.',
        'BCNF rule: X must ALWAYS be a superkey for every non-trivial FD.',
        'Lossless join test for R1 & R2: (R1 ∩ R2) -> R1 or (R1 ∩ R2) -> R2.',
        'Every BCNF relation is in 3NF, but not every 3NF relation is in BCNF.',
      ],
      workedExample:
        'R(Student, Course, Instructor) with {Student, Course} -> Instructor and Instructor -> Course. Candidate keys: {Student, Course} and {Student, Instructor}. Instructor -> Course satisfies 3NF (Course is prime) but violates BCNF (Instructor is not a superkey). Split into R1(Instructor, Course) and R2(Student, Instructor).',
      youtubeQuery: 'BCNF vs 3NF lossless decomposition DBMS easy explanation',
      youtubeVideoId: 'VWnKUKH4tLg',
      videoTitle: 'Learn Boyce-Codd Normal Form (BCNF)',
    },
    {
      topic: 'Conflict Serializability & Precedence Graphs',
      repeatTag: 'Repeated 5x',
      priority: 'Critical',
      fullExplanation:
        'A concurrent schedule is conflict-serializable if it can be transformed into a serial schedule by swapping adjacent non-conflicting operations. Two operations conflict if and only if they belong to different transactions, operate on the same data item, and at least one is a Write (R-W, W-R, or W-W). Build a precedence (serialization) graph with one node per transaction and draw a directed edge Ti -> Tj whenever Ti executes an operation that conflicts with a later operation in Tj. If the graph has NO cycles (a DAG), the schedule is conflict-serializable and any topological ordering gives an equivalent serial schedule.',
      keyPoints: [
        'Conflict conditions: different transactions + same item + at least one Write.',
        'Read-Read on the same item NEVER conflicts.',
        'Acyclic precedence graph ⇔ Conflict-serializable schedule.',
        'Topological sort of the acyclic graph gives the equivalent serial order.',
      ],
      workedExample:
        'Schedule: R1(A), W2(A), R2(B), W1(B). R1(A) before W2(A) creates edge T1 -> T2; R2(B) before W1(B) creates edge T2 -> T1. The cycle T1 -> T2 -> T1 proves the schedule is NOT conflict-serializable.',
      youtubeQuery: 'Conflict serializability precedence graph DBMS easy explanation',
      youtubeVideoId: 'zv0ba0Iok1Y',
      videoTitle: 'Conflict Serializability & Precedence Graph in DBMS',
    },
    {
      topic: 'Two-Phase Locking (Strict 2PL) & Deadlocks',
      repeatTag: 'Asked 4x',
      priority: 'High',
      fullExplanation:
        'Basic Two-Phase Locking (2PL) divides every transaction into two phases: a Growing Phase (locks may only be acquired, never released) and a Shrinking Phase (locks may only be released, never acquired). Basic 2PL guarantees conflict serializability, but it can suffer from cascading rollbacks if a transaction releases a write lock before committing. Strict 2PL fixes this by holding ALL exclusive (write) locks until the transaction commits or aborts, guaranteeing cascadeless and recoverable schedules. Note that 2PL does not prevent deadlocks, so systems pair it with Wait-Die / Wound-Wait or deadlock detection.',
      keyPoints: [
        'Basic 2PL = Growing Phase (acquire only) + Shrinking Phase (release only).',
        'Strict 2PL holds all exclusive (X) locks until commit/abort.',
        'Rigorous 2PL holds both shared (S) and exclusive (X) locks until commit/abort.',
        'Strict 2PL prevents dirty reads and cascading aborts, but deadlocks can still occur.',
      ],
      workedExample:
        'T1 acquires X(A), writes A, then waits for X(B) held by T2 while T2 waits for X(A). Both follow Strict 2PL, yet a wait-for cycle T1 <-> T2 forms a deadlock resolved by aborting the younger transaction.',
      youtubeQuery: 'Two phase locking protocol strict 2PL DBMS easy explanation',
      youtubeVideoId: 'z8Yqn91akV8',
      videoTitle: 'Strict 2PL, Rigorous 2PL & Two-Phase Locking in DBMS',
    },
    {
      topic: 'B+ Tree Node Order & Disk Block Calculations',
      repeatTag: 'Asked 4x',
      priority: 'High',
      fullExplanation:
        'A B+ Tree is a balanced multi-way search tree optimized for disk block I/O. Internal nodes store only search keys and block pointers (maximizing fanout p), while leaf nodes store keys paired with record pointers and link sequentially to the next leaf for fast range queries. To compute the maximum order p of an internal node for a disk block of size B, solve: p · P_block + (p - 1) · K <= B, where P_block is block pointer size and K is key size. For a leaf node, solve: p_leaf · (K + P_record) + P_block <= B.',
      keyPoints: [
        'Internal node order formula: p · P_block + (p - 1) · K <= BlockSize.',
        'Leaf node order formula: p_leaf · (K + P_record) + P_block <= BlockSize.',
        'All actual data pointers live at the leaf level; leaves form a linked list.',
        'Higher internal fanout p minimizes tree height and disk seeks.',
      ],
      workedExample:
        'BlockSize = 1024 B, Key K = 12 B, Block Pointer P = 8 B. Internal node equation: 8p + 12(p - 1) <= 1024 => 20p <= 1036 => max order p = 51.',
      youtubeQuery: 'B+ tree order calculation DBMS easy explanation',
      youtubeVideoId: 'o_2psWN8k_c',
      videoTitle: 'B+ Tree Explained | Structure, Search & Calculations',
    },
  ],
  qaPairs: [
    {
      id: 'qa-1',
      question: 'Differentiate between 3NF and BCNF with a concrete relation that is in 3NF but violates BCNF.',
      repeatTag: 'Repeated 6x',
      marksWeight: '8 Marks',
      answer:
        'A relation is in 3NF if for every non-trivial FD X -> Y, either X is a superkey OR Y is a prime attribute. BCNF removes the second escape hatch: X MUST be a superkey for every non-trivial FD. Example: R(Student, Course, Instructor) with {Student, Course} -> Instructor and Instructor -> Course. Here Instructor -> Course has a prime attribute (Course) on the RHS so it satisfies 3NF, but Instructor is not a superkey, violating BCNF.',
      lockInBox: {
        memoryAnchor: '3NF allows Prime RHS; BCNF demands Superkey LHS always.',
        keyFormulaOrRule: 'BCNF: ∀(X → Y) non-trivial ⇒ X is a Superkey',
        examCheck: 'State both candidate keys before declaring an attribute prime.',
      },
    },
    {
      id: 'qa-2',
      question: 'How do you test whether a concurrent schedule is conflict-serializable? Explain with precedence graph rules.',
      repeatTag: 'Repeated 5x',
      marksWeight: '6 Marks',
      answer:
        'Two operations conflict if they belong to different transactions, access the same data item, and at least one is a Write (RW, WR, WW). Construct a directed graph where nodes are transactions and add edge Ti -> Tj whenever an operation in Ti precedes and conflicts with an operation in Tj. The schedule is conflict-serializable if and only if the precedence graph is acyclic; any topological ordering gives an equivalent serial schedule.',
      lockInBox: {
        memoryAnchor: 'Conflict = Different Tx + Same Item + At least one Write.',
        keyFormulaOrRule: 'Acyclic Precedence Graph ⇔ Conflict Serializable',
        examCheck: 'Always write out the topological order if the graph has no cycle.',
      },
    },
  ],
  mcqQuestions: [
    {
      id: 'sample-mcq-1',
      question: 'Which condition guarantees that a schedule is conflict-serializable?',
      options: [
        'Its precedence graph contains no directed cycles',
        'Every transaction commits in arrival order',
        'No two transactions read the same data item',
        'All write operations happen at the end of the schedule',
      ],
      correctIndex: 0,
      explanation: 'Conflict serializability holds if and only if the serialization (precedence) graph is a DAG (acyclic).',
      topic: 'Concurrency Control',
      repeatTag: 'Repeated 5x',
    },
    {
      id: 'sample-mcq-2',
      question: 'Strict Two-Phase Locking (Strict 2PL) prevents cascading aborts by holding which locks until commit/abort?',
      options: [
        'Shared locks only',
        'Exclusive (write) locks until transaction termination',
        'Intent locks only',
        'Table-level metadata locks only',
      ],
      correctIndex: 1,
      explanation: 'Holding all exclusive locks until commit ensures no other transaction reads uncommitted dirty data.',
      topic: 'Locking Protocols',
      repeatTag: 'Asked 4x',
    },
  ],
  writtenPrompts: [
    {
      id: 'wp-1',
      question: 'Given R(A, B, C, D, E) with FDs A->BC, CD->E, B->D, E->A: find all candidate keys and verify whether R is in BCNF.',
      maxMarks: 10,
      rubric: [
        'Compute attribute closures cleanly (A+, E+, BC+, CD+)',
        'List all candidate keys accurately',
        'Check every FD LHS against candidate/superkeys',
        'State final BCNF verdict with justification',
      ],
    },
  ],
};

export const INITIAL_STUDY_BUDDIES: BuddyProfile[] = [
  {
    id: 'buddy-arjun',
    name: 'Arjun Mehta',
    branch: 'Computer Science & Engineering',
    institution: 'IIT Bombay',
    streakDays: 19,
    isStudyingNow: true,
    isFollowing: true,
    lastAlertSentAt: null,
  },
  {
    id: 'buddy-elena',
    name: 'Elena Rostova',
    branch: 'Artificial Intelligence & Data Science',
    institution: 'TU Munich',
    streakDays: 14,
    isStudyingNow: true,
    isFollowing: false,
    lastAlertSentAt: null,
  },
  {
    id: 'buddy-kenji',
    name: 'Kenji Sato',
    branch: 'Electronics & Communication (ECE)',
    institution: 'National University of Singapore',
    streakDays: 27,
    isStudyingNow: false,
    isFollowing: true,
    lastAlertSentAt: null,
  },
];
