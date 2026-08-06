import test from 'node:test';
import assert from 'node:assert/strict';
import {
  newWordEntry,
  migrateWordsState,
  WORDS_SCHEMA_VERSION,
} from '../scripts/lib/wordbank.js';
import { emptyWordsState } from '../scripts/lib/store.js';

test('newWordEntry: added_on만 남긴다 — 장부는 "언제 나왔는가"만 답한다', () => {
  assert.deepEqual(newWordEntry('2026-07-20'), { added_on: '2026-07-20' });
});

test('emptyWordsState: 최신 스키마·SRS 필드 없음', () => {
  const s = emptyWordsState();
  assert.equal(s.schema_version, WORDS_SCHEMA_VERSION);
  assert.deepEqual(s.words, {});
  assert.equal(s.intervals, undefined, 'intervals(SRS 간격)는 더 이상 없다');
});

test('migrateWordsState: v1의 SRS 잔재와 card를 버리고 added_on만 남긴다', () => {
  const v1 = {
    schema_version: 1,
    intervals: [1, 3, 7, 14, 30, 60],
    words: {
      mitigate: {
        added_on: '2026-07-23',
        box: 3,
        next_due: '2026-08-10',
        last_seen: '2026-08-03',
        graduated: false,
        history: [
          { date: '2026-07-23', event: 'added' },
          { date: '2026-08-03', event: 'shown' },
        ],
        card: { pos: 'v.', ko: '완화하다', example_en: 'e.g.', example_ko: '예문' },
      },
    },
  };
  const v2 = migrateWordsState(v1);
  assert.equal(v2.schema_version, WORDS_SCHEMA_VERSION);
  assert.equal(v2.intervals, undefined);
  assert.deepEqual(v2.words.mitigate, { added_on: '2026-07-23' });
  // 순수 함수: 원본 불변
  assert.equal(v1.words.mitigate.box, 3);
  assert.equal(v1.schema_version, 1);
});

test('migrateWordsState: 이미 v2면 그대로 — 멱등', () => {
  const v2 = { schema_version: WORDS_SCHEMA_VERSION, words: { a: { added_on: '2026-08-01' } } };
  assert.equal(migrateWordsState(v2), v2);
  assert.deepEqual(migrateWordsState(migrateWordsState(v2)), v2);
});

test('migrateWordsState: added_on이 없던 항목도 키는 보존한다(known_words 방어)', () => {
  const v2 = migrateWordsState({ schema_version: 1, words: { orphan: { box: 1 } } });
  assert.deepEqual(v2.words.orphan, { added_on: null });
});

test('migrateWordsState: 빈/없는 상태도 안전하게 v2 빈 장부', () => {
  assert.deepEqual(migrateWordsState(undefined), {
    schema_version: WORDS_SCHEMA_VERSION,
    words: {},
  });
});
