// srs.js — Leitner SRS 순수 함수 모음.
// 파일을 읽거나 쓰지 않는다. 입력을 받아 새 값을 돌려줄 뿐이다.
// 상태 파일에 실제로 쓰는 곳은 settle.js 하나다.

import { addDays } from './dates.js';

export const DEFAULT_INTERVALS = [1, 3, 7, 14, 30, 60];

/**
 * 오늘 복습(퀴즈)에 나갈 단어를 고른다.
 * 조건: graduated가 아니고 next_due <= today.
 * 반환: [{ headword, box, card }] — next_due, headword 순으로 정렬(결정적).
 */
export function selectDueWords(wordsState, today) {
  const out = [];
  for (const [headword, w] of Object.entries(wordsState.words ?? {})) {
    if (w.graduated) continue;
    if (typeof w.next_due !== 'string' || w.next_due > today) continue;
    out.push({ headword, box: w.box, card: w.card, next_due: w.next_due });
  }
  out.sort((a, b) =>
    a.next_due !== b.next_due
      ? a.next_due < b.next_due ? -1 : 1
      : a.headword < b.headword ? -1 : a.headword > b.headword ? 1 : 0
  );
  // next_due는 정렬용으로만 쓰고 결과에서는 뺀다(review.json 스키마 유지).
  return out.map(({ headword, box, card }) => ({ headword, box, card }));
}

/**
 * 퀴즈에 노출된(shown) 단어를 승급시킨다. 순수 함수 — 새 객체를 돌려준다.
 * - box < maxBox: box+1, next_due = today + intervals[새 box - 1]
 * - box >= maxBox(마지막 박스 노출): graduated = true, 순환 종료
 */
export function promoteWord(word, today, intervals = DEFAULT_INTERVALS) {
  const maxBox = intervals.length;
  const history = [...(word.history ?? []), { date: today, event: 'shown' }];
  if (word.box >= maxBox) {
    return { ...word, last_seen: today, graduated: true, history };
  }
  const newBox = word.box + 1;
  return {
    ...word,
    box: newBox,
    next_due: addDays(today, intervals[newBox - 1]),
    last_seen: today,
    graduated: false,
    history,
  };
}

/**
 * 신규 단어 항목을 만든다. box 1, next_due = today + intervals[0](기본 +1일).
 * card: { pos, ko, example_en, example_ko }
 */
export function newWordEntry(card, today, intervals = DEFAULT_INTERVALS) {
  return {
    added_on: today,
    box: 1,
    next_due: addDays(today, intervals[0]),
    last_seen: null,
    graduated: false,
    history: [{ date: today, event: 'added' }],
    card,
  };
}
