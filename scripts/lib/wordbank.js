// wordbank.js — "이미 나온 단어" 장부의 순수 함수. 파일을 읽거나 쓰지 않는다.
// state/<lang>/words.json에 실제로 쓰는 곳은 settle.js 하나다.
//
// 이 파일은 2026-08-04까지 srs.js(6박스 Leitner)였다. 복습 퀴즈 화면이 없어진 뒤로는
// box·next_due를 아무도 읽지 않으면서 매일 갱신만 됐고, 그 결과 화면에 보인 적 없는 단어에
// "노출됨" 기록이 쌓여 상태가 사실과 어긋났다(사용자 확정: 퀴즈·별도 복습 페이지 모두 불필요).
// 그래서 SRS를 걷어내고 장부가 답하는 질문을 하나로 줄였다 — "이 단어는 이미 나왔는가".
// 유일한 소비자는 prepare.js의 known_words(같은 단어를 다시 내지 않기 위한 목록)다.

export const WORDS_SCHEMA_VERSION = 2;

/**
 * 장부에 새로 올릴 항목. added_on만 남긴다.
 * 그날 페이지에 실제로 보이는 단어 내용(뜻·예문·note 등)은
 * data/<lang>/<날짜>/selected.json이 날짜별로 갖고 있으므로 여기에 중복 보관하지 않는다.
 */
export function newWordEntry(today) {
  return { added_on: today };
}

/**
 * words.json을 최신 스키마로 올린다(v1 → v2). 순수 함수 — 새 객체를 돌려준다.
 * v1의 SRS 잔재(top-level intervals, 항목별 box·next_due·last_seen·graduated·history)와
 * card 스냅샷을 버리고 added_on만 남긴다. 이미 v2면 그대로 돌려준다(멱등).
 * settle.js가 words.json을 쓸 때마다 통과시키므로, 트랙별로 다음 실행 한 번에 정리된다.
 */
export function migrateWordsState(state) {
  if (state?.schema_version === WORDS_SCHEMA_VERSION) return state;
  const words = {};
  for (const [headword, w] of Object.entries(state?.words ?? {})) {
    words[headword] = { added_on: w?.added_on ?? null };
  }
  return { schema_version: WORDS_SCHEMA_VERSION, words };
}
