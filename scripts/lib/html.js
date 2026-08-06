// html.js — HTML 이스케이프와 페이지 템플릿.
// JS 0줄 원칙: 접기/펼치기는 전부 네이티브 <details>로만 처리한다.
// 모든 동적 텍스트는 esc()를 거친다.

/** HTML 특수문자 이스케이프. 모든 동적 텍스트에 적용. */
export function esc(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * 공통 페이지 골격.
 * relRoot: docs/ 루트까지의 상대 경로 접두어 ("" 또는 "../").
 */
export function page({ title, body, relRoot = '' }) {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<!-- 발음 음성(TTS) 엔드포인트는 Referer가 붙은 요청에 404를 준다. 이 페이지의 유일한 외부 요청이라 문서 전역으로 꺼도 안전. -->
<meta name="referrer" content="no-referrer">
<title>${esc(title)}</title>
<link rel="stylesheet" href="${relRoot}assets/style.css">
</head>
<body>
${body}
</body>
</html>
`;
}

/**
 * ① 오늘의 문단 섹션. sentences는 하나의 글에서 이어진 한 문단을 문장 단위로 자른 것.
 * passage_note가 **있을 때만** 상단에 문단 원문 블록을 렌더한다(하위 호환 —
 * passage_note 없는 과거 데이터는 무관한 5문장이라 이어붙이면 이상하므로 기존 형태 유지).
 * reading(발음)은 있으면 details 안(해석 위)에 렌더한다. 문장 마커(<li class="sentence">)는 문장당 정확히 1개.
 */
export function renderSentences(sentences, passageNote) {
  // reading이 있는 언어(일본어)는 공백 없이, 없는 언어(영어)는 공백으로 이어붙인다.
  const hasReading = sentences.some((s) => s.reading);
  let passage = '';
  if (passageNote) {
    const text = sentences.map((s) => s.en).join(hasReading ? '' : ' ');
    passage = `<div class="passage">
<p class="passage-note">${esc(passageNote)}</p>
<p class="passage-text en">${esc(text)}</p>
</div>
`;
  }
  const items = sentences
    .map((s) => {
      // 단어 풀이 — 문장에 나온 순서대로. 학습자가 단어를 거의 모른다고 가정하고 넉넉히.
      const notes =
        Array.isArray(s.vocab_notes) && s.vocab_notes.length > 0
          ? `<div class="vocab"><p class="sub-label">단어</p><ul class="vocab-notes">${s.vocab_notes
              .map((v) => `<li><b>${esc(v.word)}</b> — ${esc(v.ko)}</li>`)
              .join('')}</ul></div>`
          : '';
      const reading = s.reading ? `<p class="furigana">${esc(s.reading)}</p>\n` : '';
      // 순서: (일본어는 후리가나) → 해석 → 단어 → 구문 분석
      return `<li class="sentence">
<p class="en">${esc(s.en)}</p>
<details><summary>해석 · 단어 · 구문 분석</summary>
${reading}<p class="ko">${esc(s.ko)}</p>
${notes}<div class="analysis"><p class="sub-label">구문 분석</p><p class="structure">${esc(s.structure)}</p></div>
</details>
</li>`;
    })
    .join('\n');
  return `<section id="sentences">
<h2>${passageNote ? '오늘의 문단' : '오늘의 문장'}</h2>
${passage}<ol class="sentence-list">
${items}
</ol>
</section>`;
}

/**
 * 표제어 발음 음성 URL. 트랙의 ttsLang(langs.js)이 있을 때만 쓰인다.
 * 단어 하나만 읽어 주는 용도 — 예문·문장에는 붙이지 않는다.
 * 주의: 이 엔드포인트는 Referer가 붙으면 404다. page()의 no-referrer 메타와 한 쌍으로 동작한다.
 */
export function ttsUrl(text, ttsLang) {
  return `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${encodeURIComponent(
    ttsLang
  )}&q=${encodeURIComponent(text)}`;
}

/**
 * ② 오늘의 단어 섹션(클러스터형). 단어당 마커는 정확히 <article class="word-item"> 하나.
 * head(표제어·reading·발음 음성·품사·뜻) → 예문 → note(어원·감각) → family(파생) → related(구분) →
 * collocations 순. reading·note·family·related·collocations는 전부 "있으면 렌더".
 * ttsLang(트랙 설정)이 있을 때만 표제어 옆에 발음 재생 버튼을 붙인다 — 같은 "있으면 렌더" 규칙.
 * preload="none"이라 재생을 누르기 전에는 음성을 받지 않는다(단어 15개 × 자동 요청 방지).
 */
export function renderWords(words, ttsLang = null) {
  const items = words
    .map((w) => {
      const reading = w.reading
        ? ` <small class="reading">${esc(w.reading)}</small>`
        : '';
      const say = ttsLang
        ? ` <audio class="say" controls preload="none" src="${esc(
            ttsUrl(w.headword, ttsLang)
          )}"></audio>`
        : '';
      const etym = w.note ? `\n<div class="word-etym">💡 ${esc(w.note)}</div>` : '';
      const family =
        Array.isArray(w.family) && w.family.length > 0
          ? `\n<div class="word-chips"><span class="chip-label">파생</span>${w.family
              .map(
                (m) =>
                  `<span class="chip"><b>${esc(m.word)}</b>${
                    m.pos ? `(${esc(m.pos)})` : ''
                  } ${esc(m.ko)}</span>`
              )
              .join('')}</div>`
          : '';
      const related =
        Array.isArray(w.related) && w.related.length > 0
          ? `\n<div class="word-chips"><span class="chip-label">구분</span>${w.related
              .map(
                (r) =>
                  `<span class="chip chip--related"><b>${esc(r.word)}</b>${
                    r.ko ? `(${esc(r.ko)})` : ''
                  } — ${esc(r.note)}</span>`
              )
              .join('')}</div>`
          : '';
      const colls =
        Array.isArray(w.collocations) && w.collocations.length > 0
          ? `\n<div class="word-colls"><small class="collocations">${esc(
              w.collocations.join(', ')
            )}</small></div>`
          : '';
      return `<article class="word-item">
<p class="word-head"><b class="en">${esc(w.headword)}</b>${reading}${say} <span class="pos">${esc(
        w.pos
      )}</span> <span class="meaning">${esc(w.ko)}</span></p>
<p class="word-ex"><span class="en">${esc(w.example_en)}</span><br><small class="ko">${esc(
        w.example_ko
      )}</small></p>${etym}${family}${related}${colls}
</article>`;
    })
    .join('\n');
  return `<section id="words">
<h2>오늘의 단어 <span class="count">(${words.length})</span></h2>
<div class="word-list">
${items}
</div>
</section>`;
}

/**
 * 하루치 본문(문단 + 단어)을 한 번에. day 페이지와 index가 공유한다.
 * 사용자 확정: 페이지는 문장(문단) + 단어(클러스터) 둘뿐이다.
 * 회화·복습 퀴즈·복습 문장 렌더러는 2026-08-04에 삭제했다(사용자 확정: 복습 기능 불필요).
 * 되살릴 일이 생기면 git 이력의 renderConversation/renderQuiz/renderReviewSentence 참조.
 * ttsLang은 트랙 설정(langs.js)에서 그대로 전달 — null이면 발음 음성이 렌더되지 않는다.
 */
export function renderDaySections(content, ttsLang = null) {
  return [
    renderSentences(content.sentences, content.passage_note),
    renderWords(content.words, ttsLang),
  ].join('\n');
}

/**
 * 이전/다음 날짜 내비게이션(day 페이지용).
 * "홈"은 **사이트 홈(허브 docs/index.html)** 으로 간다. day 페이지는 docs/<lang>/days/ 아래라
 * 두 단계를 올라가야 한다(`../index.html`은 그 트랙의 아카이브였다 — 2026-08-05 수정).
 */
export function renderDayNav(prevDate, nextDate) {
  const prev = prevDate
    ? `<a class="prev" href="./${esc(prevDate)}.html">← ${esc(prevDate)}</a>`
    : '<span class="prev"></span>';
  const next = nextDate
    ? `<a class="next" href="./${esc(nextDate)}.html">${esc(nextDate)} →</a>`
    : '<span class="next"></span>';
  return `<nav class="day-nav">${prev}<a class="home" href="../../index.html">홈</a>${next}</nav>`;
}
