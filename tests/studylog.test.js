import test from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyStudyLog,
  recordStudy,
  levelOf,
  isLevel,
  trackStats,
  studyRows,
  LEVELS,
} from '../scripts/lib/studylog.js';
import { checkinTitle, checkinUrl } from '../scripts/lib/site.js';

const D = (n) => `2026-08-${String(n).padStart(2, '0')}`;

test('isLevel: 등록된 3단계만 통과 — 이슈 제목 파싱의 방어선', () => {
  assert.deepEqual(Object.keys(LEVELS), ['little', 'half', 'full']);
  for (const ok of ['little', 'half', 'full']) assert.ok(isLevel(ok));
  for (const bad of ['FULL', 'done', '', null, undefined, 3]) assert.ok(!isLevel(bad));
});

test('recordStudy: 날짜·트랙별로 진도를 남긴다', () => {
  let log = emptyStudyLog();
  log = recordStudy(log, D(6), 'en', 'full');
  log = recordStudy(log, D(6), 'ja-n1', 'half');
  assert.equal(levelOf(log, D(6), 'en'), 'full');
  assert.equal(levelOf(log, D(6), 'ja-n1'), 'half');
  assert.equal(levelOf(log, D(6), 'ja-n2'), null, '기록 없으면 null');
  assert.equal(levelOf(log, D(5), 'en'), null);
});

test('recordStudy: 같은 날·트랙을 다시 기록하면 나중 것이 이긴다(정정 가능)', () => {
  let log = recordStudy(emptyStudyLog(), D(6), 'en', 'full');
  log = recordStudy(log, D(6), 'en', 'little'); // 잘못 눌렀다가 고침
  assert.equal(levelOf(log, D(6), 'en'), 'little');
});

test('recordStudy: 순수 함수 — 원본 불변', () => {
  const before = recordStudy(emptyStudyLog(), D(6), 'en', 'half');
  const after = recordStudy(before, D(6), 'en', 'full');
  assert.equal(levelOf(before, D(6), 'en'), 'half');
  assert.equal(levelOf(after, D(6), 'en'), 'full');
});

test('recordStudy: 알 수 없는 단계는 throw', () => {
  assert.throws(() => recordStudy(emptyStudyLog(), D(6), 'en', 'done'), /알 수 없는 진도 단계/);
});

test('trackStats: 분모는 콘텐츠가 있던 날만 — 안 돈 날을 게으름으로 세지 않는다', () => {
  // 콘텐츠는 3·4·5일에만 있었고, 그중 두 날 기록.
  let log = recordStudy(emptyStudyLog(), D(3), 'en', 'full');
  log = recordStudy(log, D(4), 'en', 'half');
  const s = trackStats(log, 'en', [D(3), D(4), D(5)]);
  assert.equal(s.total, 3);
  assert.equal(s.recorded, 2);
  assert.equal(s.recordedPercent, 67);
  // 평균 진도: (100 + 60 + 0) / 3 = 53
  assert.equal(s.avgProgress, 53);
  assert.deepEqual(s.counts, { little: 0, half: 1, full: 1 });
});

test('trackStats: 가장 최근 하루는 유예 — 오늘 아직 안 했어도 연속이 살아 있다', () => {
  let log = emptyStudyLog();
  for (const d of [D(3), D(4), D(5)]) log = recordStudy(log, d, 'en', 'full');
  const s = trackStats(log, 'en', [D(3), D(4), D(5), D(6)]); // 6일분은 아직 기록 없음
  assert.equal(s.currentStreak, 3, '오늘분 미기록은 연속을 끊지 않는다');
  assert.equal(s.longestStreak, 3);
});

test('trackStats: 중간에 빠지면 연속이 끊긴다', () => {
  let log = recordStudy(emptyStudyLog(), D(3), 'en', 'full');
  log = recordStudy(log, D(5), 'en', 'full');
  log = recordStudy(log, D(6), 'en', 'little');
  const s = trackStats(log, 'en', [D(3), D(4), D(5), D(6)]);
  assert.equal(s.currentStreak, 2, '5·6일 연속(4일 빠짐)');
  assert.equal(s.longestStreak, 2);
});

test('trackStats: 기록이 하나도 없어도 안전(0으로 수렴)', () => {
  const s = trackStats(emptyStudyLog(), 'en', [D(3), D(4)]);
  assert.deepEqual(
    { r: s.recorded, p: s.avgProgress, c: s.currentStreak, l: s.longestStreak },
    { r: 0, p: 0, c: 0, l: 0 }
  );
  const none = trackStats(emptyStudyLog(), 'en', []);
  assert.equal(none.total, 0);
  assert.equal(none.avgProgress, 0, '0으로 나누지 않는다');
});

test('studyRows: 콘텐츠 없는 날은 available=false로 구분된다', () => {
  const log = recordStudy(emptyStudyLog(), D(6), 'en', 'full');
  const rows = studyRows(log, { en: [D(5), D(6)], 'ja-n1': [D(6)] }, ['en', 'ja-n1']);
  assert.deepEqual(rows.map((r) => r.date), [D(6), D(5)], '날짜 내림차순');
  const [today, yesterday] = rows;
  assert.deepEqual(today.tracks[0], { lang: 'en', available: true, level: 'full' });
  assert.deepEqual(today.tracks[1], { lang: 'ja-n1', available: true, level: null });
  assert.deepEqual(
    yesterday.tracks[1],
    { lang: 'ja-n1', available: false, level: null },
    '그날 그 트랙 콘텐츠가 없으면 available=false'
  );
});

test('checkinTitle/Url: 워크플로 정규식이 받는 형식 그대로 만든다', () => {
  assert.equal(checkinTitle('2026-08-06', 'ja-n1', 'full'), 'study: 2026-08-06 ja-n1 full');
  // 워크플로의 파싱 정규식과 동일한 형태
  const re = /^study:\s*(\d{4}-\d{2}-\d{2})\s+([a-z0-9-]+)\s+([a-z]+)\s*$/;
  assert.match(checkinTitle('2026-08-06', 'ja-n1', 'full'), re);
  const url = checkinUrl('2026-08-06', 'en', 'half');
  assert.ok(url.startsWith('https://github.com/gks930620/daily-language/issues/new?title='));
  assert.ok(url.includes('study%3A%202026-08-06%20en%20half'), 'URL 인코딩된 제목');
});
