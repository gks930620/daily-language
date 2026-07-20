import test from 'node:test';
import assert from 'node:assert/strict';
import {
  selectDueWords,
  promoteWord,
  newWordEntry,
  DEFAULT_INTERVALS,
} from '../scripts/lib/srs.js';

const card = (ko) => ({ pos: 'v.', ko, example_en: 'e.g.', example_ko: '예문' });

function makeState(words) {
  return { schema_version: 1, intervals: [...DEFAULT_INTERVALS], words };
}

test('selectDueWords: next_due <= 오늘인 단어만 뽑는다', () => {
  const state = makeState({
    due1: { box: 1, next_due: '2026-07-20', graduated: false, card: card('a') },
    due2: { box: 2, next_due: '2026-07-19', graduated: false, card: card('b') }, // 연체분도 포함
    notyet: { box: 1, next_due: '2026-07-21', graduated: false, card: card('c') },
  });
  const due = selectDueWords(state, '2026-07-20');
  assert.deepEqual(due.map((d) => d.headword), ['due2', 'due1']); // next_due 오름차순
  assert.deepEqual(due[1], { headword: 'due1', box: 1, card: card('a') });
});

test('selectDueWords: graduated 단어는 제외', () => {
  const state = makeState({
    done: { box: 6, next_due: '2026-07-01', graduated: true, card: card('a') },
    alive: { box: 3, next_due: '2026-07-20', graduated: false, card: card('b') },
  });
  const due = selectDueWords(state, '2026-07-20');
  assert.deepEqual(due.map((d) => d.headword), ['alive']);
});

test('selectDueWords: 같은 next_due는 headword 순 — 결정적', () => {
  const state = makeState({
    zebra: { box: 1, next_due: '2026-07-20', graduated: false, card: card('z') },
    apple: { box: 1, next_due: '2026-07-20', graduated: false, card: card('a') },
  });
  const due = selectDueWords(state, '2026-07-20');
  assert.deepEqual(due.map((d) => d.headword), ['apple', 'zebra']);
});

test('promoteWord: box+1, next_due = 오늘 + intervals[새 box - 1]', () => {
  const w = {
    added_on: '2026-07-20',
    box: 1,
    next_due: '2026-07-21',
    last_seen: null,
    graduated: false,
    history: [{ date: '2026-07-20', event: 'added' }],
    card: card('a'),
  };
  const p = promoteWord(w, '2026-07-21', DEFAULT_INTERVALS);
  assert.equal(p.box, 2);
  assert.equal(p.next_due, '2026-07-24'); // 21 + intervals[1]=3
  assert.equal(p.last_seen, '2026-07-21');
  assert.equal(p.graduated, false);
  assert.equal(p.history.at(-1).event, 'shown');
  assert.equal(p.history.at(-1).date, '2026-07-21');
  // 순수 함수: 원본 불변
  assert.equal(w.box, 1);
  assert.equal(w.history.length, 1);
});

test('promoteWord: box 5 → 6 승급, next_due = +60일', () => {
  const w = { box: 5, next_due: '2026-07-20', graduated: false, history: [], card: card('a') };
  const p = promoteWord(w, '2026-07-20', DEFAULT_INTERVALS);
  assert.equal(p.box, 6);
  assert.equal(p.next_due, '2026-09-18'); // 07-20 + 60일
});

test('promoteWord: box 6 노출 후 graduated — 순환 종료', () => {
  const w = { box: 6, next_due: '2026-07-20', graduated: false, history: [], card: card('a') };
  const p = promoteWord(w, '2026-07-20', DEFAULT_INTERVALS);
  assert.equal(p.graduated, true);
  assert.equal(p.box, 6); // 박스는 6에서 멈춘다
  assert.equal(p.history.at(-1).event, 'shown');
  // 이후 selectDueWords에서 다시 뽑히지 않는다
  const state = makeState({ done: p });
  assert.deepEqual(selectDueWords(state, '2027-01-01'), []);
});

test('newWordEntry: box 1, next_due = 오늘+1', () => {
  const e = newWordEntry(card('완화하다'), '2026-07-20', DEFAULT_INTERVALS);
  assert.equal(e.box, 1);
  assert.equal(e.added_on, '2026-07-20');
  assert.equal(e.next_due, '2026-07-21');
  assert.equal(e.graduated, false);
  assert.deepEqual(e.history, [{ date: '2026-07-20', event: 'added' }]);
});

test('intervals를 줄이면 졸업이 빨라진다(설정 주도)', () => {
  const short = [1, 3];
  const w = { box: 2, next_due: '2026-07-20', graduated: false, history: [], card: card('a') };
  const p = promoteWord(w, '2026-07-20', short);
  assert.equal(p.graduated, true); // maxBox=2이므로 즉시 졸업
});
