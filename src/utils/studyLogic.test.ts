import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeExamQuestionCount,
  chunkStudyText,
  calculateConceptMastery,
  shouldTriggerScheduledBreak,
  formatTimerDisplay,
  canSendBuddyAlert,
  BUDDY_ALERT_COOLDOWN_MS,
  extractSafeYouTubeId,
  buildMatchedGroups,
  scoreMcqAttempt,
} from './studyLogic';

test('computeExamQuestionCount enforces 40 questions for marks >= 50 else 20', () => {
  assert.equal(computeExamQuestionCount(100), 40);
  assert.equal(computeExamQuestionCount(50), 40);
  assert.equal(computeExamQuestionCount(49), 20);
  assert.equal(computeExamQuestionCount(25), 20);
  assert.equal(computeExamQuestionCount(0), 20);
});

test('chunkStudyText compacts whitespace and splits bounded chunks', () => {
  const text = 'Paragraph one   with   spaces.\n\n\n\nParagraph two.\n\nParagraph three.';
  const packed = chunkStudyText(text, 35, 6);
  assert.equal(packed.length, 2);
  assert.equal(packed[0], 'Paragraph one with spaces.');
  assert.equal(packed[1], 'Paragraph two.\n\nParagraph three.');

  const split = chunkStudyText(text, 28, 6);
  assert.equal(split.length, 3);
  assert.equal(chunkStudyText('   ').length, 0);
});

test('calculateConceptMastery returns exact counts and percentages', () => {
  const res = calculateConceptMastery([
    { id: '1', title: 'Eigenvalues', difficulty: 'Core', estimatedMins: 20, covered: true },
    { id: '2', title: 'SVD', difficulty: 'High Yield', estimatedMins: 30, covered: true },
    { id: '3', title: 'Jordan Form', difficulty: 'Advanced', estimatedMins: 25, covered: false },
    { id: '4', title: 'Orthogonality', difficulty: 'Core', estimatedMins: 15, covered: false },
  ]);
  assert.deepEqual(res, { coveredCount: 2, uncoveredCount: 2, totalCount: 4, percentage: 50 });
  assert.equal(calculateConceptMastery([]).percentage, 0);
});

test('focus timer triggers 5-min break every 30 min and formats display cleanly', () => {
  assert.equal(shouldTriggerScheduledBreak(0), false);
  assert.equal(shouldTriggerScheduledBreak(1799), false);
  assert.equal(shouldTriggerScheduledBreak(1800), true);
  assert.equal(shouldTriggerScheduledBreak(3600), true);
  assert.equal(formatTimerDisplay(1800), '30:00');
  assert.equal(formatTimerDisplay(3661), '01:01:01');
});

test('study buddy alert enforces 3-hour cooldown and Ultra Block suppression', () => {
  const now = 1_700_000_000_000;
  assert.equal(
    canSendBuddyAlert({ lastAlertSentAt: null, nowMs: now, isUltraBlockActive: true }).reason,
    'ultra_block_suppressed'
  );
  assert.equal(
    canSendBuddyAlert({ lastAlertSentAt: null, nowMs: now, isUltraBlockActive: false }).allowed,
    true
  );
  const recent = canSendBuddyAlert({
    lastAlertSentAt: now - 60_000,
    nowMs: now,
    isUltraBlockActive: false,
  });
  assert.equal(recent.allowed, false);
  assert.equal(recent.reason, 'cooldown');
  assert.equal(recent.remainingMs, BUDDY_ALERT_COOLDOWN_MS - 60_000);

  const expired = canSendBuddyAlert({
    lastAlertSentAt: now - BUDDY_ALERT_COOLDOWN_MS - 1000,
    nowMs: now,
    isUltraBlockActive: false,
  });
  assert.equal(expired.allowed, true);
});

test('extractSafeYouTubeId extracts valid IDs and blocks unsafe URLs', () => {
  assert.equal(extractSafeYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(extractSafeYouTubeId('https://youtu.be/aircAruvnKk?t=42'), 'aircAruvnKk');
  assert.equal(extractSafeYouTubeId('javascript:alert(1)'), null);
  assert.equal(extractSafeYouTubeId('https://evil.example/watch?v=dQw4w9WgXcQ'), null);
});

test('buildMatchedGroups creates university+branch and global branch groups', () => {
  const { universityBranchGroup, globalBranchGroup } = buildMatchedGroups({
    institution: 'IIT Bombay',
    branch: 'Computer Science & Engineering',
    country: 'India',
    streamCategory: 'Higher Education / Engineering',
  });
  assert.equal(universityBranchGroup.type, 'university_branch');
  assert.equal(globalBranchGroup.type, 'global_branch');
  assert.match(universityBranchGroup.id, /^uni-iit-bombay-/);
  assert.match(globalBranchGroup.id, /^global-computer-science/);
});

test('scoreMcqAttempt accurately grades selected options', () => {
  const result = scoreMcqAttempt(
    { q1: 0, q2: 2, q3: 1 },
    [
      { id: 'q1', correctIndex: 0 },
      { id: 'q2', correctIndex: 1 },
      { id: 'q3', correctIndex: 1 },
      { id: 'q4', correctIndex: 3 },
    ]
  );
  assert.deepEqual(result, { correct: 2, total: 4, accuracyPct: 50 });
});

test('onboarding degree cascade strictly isolates MBBS/Medical from B.Tech/B.E. branches and institutions', async () => {
  const {
    STREAM_OPTIONS,
    getDegreeLevelsForStream,
    getBranchesForDegree,
    getInstitutionsForDegree,
  } = await import('../data/catalog');

  const medBranches = getBranchesForDegree('Higher Education / Engineering', 'MBBS / Medical');
  const medInsts = getInstitutionsForDegree('Higher Education / Engineering', 'MBBS / Medical');
  const engBranches = getBranchesForDegree('Higher Education / Engineering', 'B.Tech / B.E.');
  const engInsts = getInstitutionsForDegree('Higher Education / Engineering', 'B.Tech / B.E.');

  assert.ok(medBranches.length > 0);
  assert.ok(medInsts.length > 0);
  assert.ok(engBranches.length > 0);
  assert.ok(engInsts.length > 0);

  // MBBS must contain zero Engineering branches and zero Engineering-only institutes
  assert.equal(
    medBranches.some((b) => /engineering|cse|ece|mechanical|civil|electrical/i.test(b)),
    false
  );
  assert.equal(
    medInsts.some((i) => /IIT|NIT|BITS|VIT|COEP|TU Munich/i.test(i)),
    false
  );
  assert.ok(medBranches.includes('Anatomy'));
  assert.ok(medBranches.includes('General Medicine'));
  assert.ok(medInsts.includes('AIIMS New Delhi'));

  // B.Tech/B.E. must contain zero Medical branches and zero Medical-only colleges
  assert.equal(
    engBranches.some((b) => /anatomy|medicine|pediatrics|pathology|pharmacology|surgery/i.test(b)),
    false
  );
  assert.equal(
    engInsts.some((i) => /AIIMS|JIPMER|AFMC|Medical College/i.test(i)),
    false
  );
  assert.ok(engBranches.some((b) => b.includes('Computer Science & Engineering')));
  assert.ok(engInsts.includes('IIT Bombay'));

  // Every degree level in every stream must have a non-empty strict mapping
  for (const stream of Object.keys(STREAM_OPTIONS) as Array<keyof typeof STREAM_OPTIONS>) {
    const degrees = getDegreeLevelsForStream(stream);
    assert.ok(degrees.length > 0);
    for (const deg of degrees) {
      assert.ok(getBranchesForDegree(stream, deg).length > 0, `Missing branches for ${stream} -> ${deg}`);
      assert.ok(getInstitutionsForDegree(stream, deg).length > 0, `Missing institutions for ${stream} -> ${deg}`);
    }
  }

  // Unmapped degree must strictly return empty arrays (never another degree's entries)
  assert.deepEqual(getBranchesForDegree('Higher Education / Engineering', 'Unknown Degree XYZ'), []);
  assert.deepEqual(getInstitutionsForDegree('Higher Education / Engineering', 'Unknown Degree XYZ'), []);
});

test('pdfUtils filters multi-subject syllabus strictly to typed Subject Name and extracts summary metadata', async () => {
  const { filterSyllabusForSubject, extractPdfSummaryMetadata } = await import('./pdfUtils');

  const multiSubjectSyllabus = [
    'University Syllabus — 2019 Pattern · May/June 2025',
    'Course Code: CS301',
    'Subject Name: Discrete Mathematics',
    'Unit 1: Propositional Logic and Graph Theory',
    '',
    'Course Code: CS304',
    'Subject Name: Operating Systems',
    '2019 Pattern · Nov/Dec 2024',
    'Unit 1: Process Scheduling and Deadlocks',
    'Unit 2: Virtual Memory and Paging',
    '',
    'Course Code: CS309',
    'Subject Name: Computer Graphics',
    'Unit 1: Bresenham Line Algorithm and 3D Transformations',
  ].join('\n');

  const { filteredText, matched } = filterSyllabusForSubject(multiSubjectSyllabus, 'Operating Systems');
  assert.equal(matched, true);
  assert.match(filteredText, /Operating Systems/);
  assert.match(filteredText, /Process Scheduling and Deadlocks/);
  assert.equal(/Computer Graphics|Bresenham/.test(filteredText), false);
  assert.equal(/Discrete Mathematics|Propositional Logic/.test(filteredText), false);

  const meta = extractPdfSummaryMetadata(filteredText, 'Operating Systems', matched);
  assert.equal(meta.detectedSubject, 'Operating Systems');
  assert.equal(meta.monthYear, 'Nov/Dec 2024');
  assert.equal(meta.scheme, '2019 Pattern');
  assert.equal(meta.matchedSubjectFilter, true);
  assert.ok(meta.snippet.length > 0 && meta.snippet.length <= 165);
});
