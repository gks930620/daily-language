import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, levelOf, trackStats, studyRows } from '../scripts/lib/studylog.js';
import { API_BASE, apiConfigured } from '../scripts/lib/site.js';

const D = (n) => `2026-08-${String(n).padStart(2, '0')}`;

/** API의 GET /study/me 응답과 같은 모양(진도를 쓰는 건 서버지 이 코드가 아니다). */
const log = (days) => ({ schema_version: 1, days });

test('LEVELS: 진도는 3단계뿐이고 순서가 곧 크기다', () => {
  assert.deepEqual(Object.keys(LEVELS), ['little', 'half', 'full']);
  assert.deepEqual(
    Object.values(LEVELS).map((v) => v.weight),
    [30, 60, 100]
  );
});

test('levelOf: 날짜·트랙별 단계를 읽고, 없거나 모르는 값이면 null', () => {
  const l = log({ [D(10)]: { en: 'full', 'ja-n1': 'half', 'ja-n2': 'ㅁㅁㅁ' } });
  assert.equal(levelOf(l, D(10), 'en'), 'full');
  assert.equal(levelOf(l, D(10), 'ja-n1'), 'half');
  assert.equal(levelOf(l, D(10), 'ja-n2'), null, '등록되지 않은 단계는 무시');
  assert.equal(levelOf(l, D(10), 'de'), null, '없는 트랙');
  assert.equal(levelOf(l, D(9), 'en'), null, '기록 없는 날');
  assert.equal(levelOf(undefined, D(9), 'en'), null, '응답이 비어도 안전');
});

test('trackStats: 분모는 콘텐츠가 있던 날만 — 안 돈 날을 게으름으로 세지 않는다', () => {
  // 콘텐츠는 3·4·5일에만 있었고, 그중 두 날 기록.
  const s = trackStats(log({ [D(3)]: { en: 'full' }, [D(4)]: { en: 'half' } }), 'en', [
    D(3),
    D(4),
    D(5),
  ]);
  assert.equal(s.total, 3);
  assert.equal(s.recorded, 2);
  assert.equal(s.recordedPercent, 67);
  assert.equal(s.avgProgress, 53, '(100 + 60 + 0) / 3');
  assert.deepEqual(s.counts, { little: 0, half: 1, full: 1 });
});

test('trackStats: 가장 최근 하루는 유예 — 오늘 아직 안 했어도 연속이 살아 있다', () => {
  const l = log({ [D(3)]: { en: 'full' }, [D(4)]: { en: 'full' }, [D(5)]: { en: 'full' } });
  const s = trackStats(l, 'en', [D(3), D(4), D(5), D(6)]); // 6일분은 아직 기록 없음
  assert.equal(s.currentStreak, 3, '오늘분 미기록은 연속을 끊지 않는다');
  assert.equal(s.longestStreak, 3);
});

test('trackStats: 중간에 빠지면 연속이 끊긴다', () => {
  const l = log({ [D(3)]: { en: 'full' }, [D(5)]: { en: 'full' }, [D(6)]: { en: 'little' } });
  const s = trackStats(l, 'en', [D(3), D(4), D(5), D(6)]);
  assert.equal(s.currentStreak, 2, '5·6일 연속(4일 빠짐)');
  assert.equal(s.longestStreak, 2);
});

test('trackStats: 기록이 없어도 안전(0으로 수렴, 0으로 나누지 않음)', () => {
  const s = trackStats(log({}), 'en', [D(3), D(4)]);
  assert.deepEqual(
    { r: s.recorded, p: s.avgProgress, c: s.currentStreak, l: s.longestStreak },
    { r: 0, p: 0, c: 0, l: 0 }
  );
  const none = trackStats(log({}), 'en', []);
  assert.equal(none.total, 0);
  assert.equal(none.avgProgress, 0);
});

test('trackStats: 첫 실사용 값과 일치한다(19일 중 2026-08-10 영어 "다 함" 1건)', () => {
  const days = Array.from({ length: 19 }, (_, i) => {
    const d = new Date(Date.UTC(2026, 6, 23) + i * 86400000);
    return d.toISOString().slice(0, 10);
  });
  const s = trackStats(log({ '2026-08-10': { en: 'full' } }), 'en', days);
  assert.equal(s.total, 19);
  assert.equal(s.recorded, 1);
  assert.equal(s.recordedPercent, 5);
  assert.equal(s.avgProgress, 5, '100 / 19');
  assert.equal(s.counts.full, 1);
  assert.equal(s.currentStreak, 1);
  assert.equal(s.longestStreak, 1);
});

test('studyRows: 콘텐츠 없는 날은 available=false로 구분된다', () => {
  const rows = studyRows(log({ [D(6)]: { en: 'full' } }), { en: [D(5), D(6)], 'ja-n1': [D(6)] }, [
    'en',
    'ja-n1',
  ]);
  assert.deepEqual(
    rows.map((r) => r.date),
    [D(6), D(5)],
    '날짜 내림차순'
  );
  const [today, yesterday] = rows;
  assert.deepEqual(today.tracks[0], { lang: 'en', available: true, level: 'full' });
  assert.deepEqual(today.tracks[1], { lang: 'ja-n1', available: true, level: null });
  assert.deepEqual(
    yesterday.tracks[1],
    { lang: 'ja-n1', available: false, level: null },
    '그날 그 트랙 콘텐츠가 없으면 available=false'
  );
});

test('site: API_BASE가 비어 있으면 진도 기능이 꺼진 것으로 판단한다', () => {
  assert.equal(typeof API_BASE, 'string');
  assert.equal(apiConfigured(), API_BASE.trim().length > 0);
});
