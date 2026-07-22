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
    const readingBlock = hasReading
      ? `\n<details><summary>전문 읽기</summary><p class="reading">${esc(
          sentences.map((s) => s.reading ?? '').join('')
        )}</p></details>`
      : '';
    passage = `<div class="passage">
<p class="passage-note">${esc(passageNote)}</p>
<p class="passage-text en">${esc(text)}</p>${readingBlock}
</div>
`;
  }
  const items = sentences
    .map((s) => {
      const notes =
        Array.isArray(s.vocab_notes) && s.vocab_notes.length > 0
          ? `<ul class="vocab-notes">${s.vocab_notes
              .map((v) => `<li><b>${esc(v.word)}</b> — ${esc(v.ko)}</li>`)
              .join('')}</ul>`
          : '';
      const reading = s.reading ? `<p class="reading">${esc(s.reading)}</p>\n` : '';
      return `<li class="sentence">
<p class="en">${esc(s.en)}</p>
<details><summary>해석 · 구문분석</summary>
${reading}<p class="ko">${esc(s.ko)}</p>
<p class="structure">${esc(s.structure)}</p>
${notes}</details>
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
 * 단어 지식(note·family·related) 보조 렌더 — "있으면 렌더" 원칙(reading과 동일).
 * 단어 표의 예문 셀 하단과 복습 퀴즈 정답 안에서 공유한다.
 * 반환물은 클래스가 다른 서브 요소뿐 — verify의 마커(<tr class="word-row"> 등)와 겹치지 않는다.
 */
export function renderWordKnowledge(w) {
  if (!w) return '';
  const parts = [];
  if (w.note) {
    parts.push(`<p class="word-note">💡 ${esc(w.note)}</p>`);
  }
  if (Array.isArray(w.family) && w.family.length > 0) {
    const items = w.family
      .map((m) => `<b>${esc(m.word)}</b>${m.pos ? `(${esc(m.pos)})` : ''} ${esc(m.ko)}`)
      .join(' · ');
    parts.push(`<p class="word-family">파생: ${items}</p>`);
  }
  if (Array.isArray(w.related) && w.related.length > 0) {
    const items = w.related
      .map((r) => `<b>${esc(r.word)}</b>${r.ko ? `(${esc(r.ko)})` : ''} — ${esc(r.note)}`)
      .join(' · ');
    parts.push(`<p class="word-related">구분: ${items}</p>`);
  }
  return parts.join('\n');
}

/**
 * ② 오늘의 단어 섹션(클러스터형). 단어당 마커는 정확히 <article class="word-item"> 하나.
 * head(표제어·reading·품사·뜻) → 예문 → note(어원·감각) → family(파생) → related(구분) →
 * collocations 순. reading·note·family·related·collocations는 전부 "있으면 렌더".
 */
export function renderWords(words) {
  const items = words
    .map((w) => {
      const reading = w.reading
        ? ` <small class="reading">${esc(w.reading)}</small>`
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
<p class="word-head"><b class="en">${esc(w.headword)}</b>${reading} <span class="pos">${esc(
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

/** ③ 오늘의 회화 섹션. 각 줄을 누르면 해석이 열린다. reading은 있으면 details 안에 렌더. */
export function renderConversation(conv) {
  const lines = conv.lines
    .map((l) => {
      const reading = l.reading ? `<p class="reading">${esc(l.reading)}</p>` : '';
      return `<details class="line"><summary><b class="speaker">${esc(l.speaker)}</b> ${esc(l.en)}</summary>${reading}<p class="ko">${esc(l.ko)}</p></details>`;
    })
    .join('\n');
  const keys = conv.key_expressions
    .map((k) => {
      const reading = k.reading ? ` <small class="reading">${esc(k.reading)}</small>` : '';
      return `<li><b>${esc(k.en)}</b>${reading} — ${esc(k.ko)}</li>`;
    })
    .join('');
  return `<section id="conversation">
<h2>오늘의 회화 — ${esc(conv.topic)}</h2>
<p class="situation">${esc(conv.situation_ko)}</p>
<div class="dialogue">
${lines}
</div>
<h3>핵심 표현</h3>
<ul class="key-expressions">${keys}</ul>
</section>`;
}

/** ④ 복습 퀴즈 섹션. 정답(뜻·해석)은 <details> 안에만 둔다. */
export function renderQuiz(dueWords) {
  if (!dueWords || dueWords.length === 0) {
    return `<section id="quiz">
<h2>복습 퀴즈</h2>
<p class="empty">오늘 복습할 단어가 없습니다.</p>
</section>`;
  }
  const items = dueWords
    .map((d) => {
      const reading = d.card?.reading
        ? `<p class="reading">${esc(d.card.reading)}</p>\n`
        : '';
      // card에 note/family/related가 있으면 정답과 함께 렌더 — 복습 때마다 지식 재노출.
      const knowledge = renderWordKnowledge(d.card);
      return `<li class="quiz-item">
<p class="quiz-word"><b>${esc(d.headword)}</b></p>
<p class="quiz-example en">${esc(d.card?.example_en ?? '')}</p>
<details><summary>정답</summary>
${reading}<p class="answer">${esc(d.card?.pos ?? '')} ${esc(d.card?.ko ?? '')}</p>
<p class="ko">${esc(d.card?.example_ko ?? '')}</p>
${knowledge ? `${knowledge}\n` : ''}</details>
</li>`;
    })
    .join('\n');
  return `<section id="quiz">
<h2>복습 퀴즈 <span class="count">(${dueWords.length})</span></h2>
<ol class="quiz-list">
${items}
</ol>
</section>`;
}

/** ⑤ 복습 문장 섹션. */
export function renderReviewSentence(rs) {
  if (!rs) {
    return `<section id="review-sentence">
<h2>복습 문장</h2>
<p class="empty">아직 복습할 과거 문장이 없습니다.</p>
</section>`;
  }
  const reading = rs.reading ? `<p class="reading">${esc(rs.reading)}</p>\n` : '';
  return `<section id="review-sentence">
<h2>복습 문장 <span class="from">(${esc(rs.from_date)} 학습)</span></h2>
<p class="en">${esc(rs.en)}</p>
<details><summary>정답</summary>
${reading}<p class="ko">${esc(rs.ko)}</p>
<p class="structure">${esc(rs.structure)}</p>
</details>
</section>`;
}

/**
 * 하루치 본문(문단 + 단어)을 한 번에. day 페이지와 index가 공유한다.
 * 사용자 확정(2026-07-22): 페이지는 문장(문단) + 단어(클러스터)만.
 * 회화·복습 퀴즈·복습 문장은 제거(추후 재설계) — renderConversation/renderQuiz/
 * renderReviewSentence 함수 정의는 복원용으로 남겨 두되 여기서 호출하지 않는다.
 * review 인자는 시그니처 호환을 위해 유지(현재 미사용).
 */
export function renderDaySections(content, review) {
  return [
    renderSentences(content.sentences, content.passage_note),
    renderWords(content.words),
  ].join('\n');
}

/** 이전/다음 날짜 내비게이션(day 페이지용). */
export function renderDayNav(prevDate, nextDate) {
  const prev = prevDate
    ? `<a class="prev" href="./${esc(prevDate)}.html">← ${esc(prevDate)}</a>`
    : '<span class="prev"></span>';
  const next = nextDate
    ? `<a class="next" href="./${esc(nextDate)}.html">${esc(nextDate)} →</a>`
    : '<span class="next"></span>';
  return `<nav class="day-nav">${prev}<a class="home" href="../index.html">홈</a>${next}</nav>`;
}
