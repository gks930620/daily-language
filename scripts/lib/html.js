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

/** ① 오늘의 문장 섹션. */
export function renderSentences(sentences) {
  const items = sentences
    .map((s) => {
      const notes =
        Array.isArray(s.vocab_notes) && s.vocab_notes.length > 0
          ? `<ul class="vocab-notes">${s.vocab_notes
              .map((v) => `<li><b>${esc(v.word)}</b> — ${esc(v.ko)}</li>`)
              .join('')}</ul>`
          : '';
      return `<li class="sentence">
<p class="en">${esc(s.en)}</p>
<details><summary>해석 · 구문분석</summary>
<p class="ko">${esc(s.ko)}</p>
<p class="structure">${esc(s.structure)}</p>
${notes}</details>
</li>`;
    })
    .join('\n');
  return `<section id="sentences">
<h2>오늘의 문장</h2>
<ol class="sentence-list">
${items}
</ol>
</section>`;
}

/** ② 오늘의 단어 섹션(표). */
export function renderWords(words) {
  const rows = words
    .map((w) => {
      const colls =
        Array.isArray(w.collocations) && w.collocations.length > 0
          ? `<br><small class="collocations">${esc(w.collocations.join(', '))}</small>`
          : '';
      return `<tr class="word-row">
<td class="headword"><b>${esc(w.headword)}</b>${colls}</td>
<td class="pos">${esc(w.pos)}</td>
<td class="meaning">${esc(w.ko)}</td>
<td class="example"><span class="en">${esc(w.example_en)}</span><br><small class="ko">${esc(w.example_ko)}</small></td>
</tr>`;
    })
    .join('\n');
  return `<section id="words">
<h2>오늘의 단어 <span class="count">(${words.length})</span></h2>
<table class="word-table">
<thead><tr><th>단어</th><th>품사</th><th>뜻</th><th>예문</th></tr></thead>
<tbody>
${rows}
</tbody>
</table>
</section>`;
}

/** ③ 오늘의 회화 섹션. 각 줄을 누르면 해석이 열린다. */
export function renderConversation(conv) {
  const lines = conv.lines
    .map(
      (l) => `<details class="line"><summary><b class="speaker">${esc(l.speaker)}</b> ${esc(l.en)}</summary><p class="ko">${esc(l.ko)}</p></details>`
    )
    .join('\n');
  const keys = conv.key_expressions
    .map((k) => `<li><b>${esc(k.en)}</b> — ${esc(k.ko)}</li>`)
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
    .map(
      (d) => `<li class="quiz-item">
<p class="quiz-word"><b>${esc(d.headword)}</b></p>
<p class="quiz-example en">${esc(d.card?.example_en ?? '')}</p>
<details><summary>정답</summary>
<p class="answer">${esc(d.card?.pos ?? '')} ${esc(d.card?.ko ?? '')}</p>
<p class="ko">${esc(d.card?.example_ko ?? '')}</p>
</details>
</li>`
    )
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
  return `<section id="review-sentence">
<h2>복습 문장 <span class="from">(${esc(rs.from_date)} 학습)</span></h2>
<p class="en">${esc(rs.en)}</p>
<details><summary>정답</summary>
<p class="ko">${esc(rs.ko)}</p>
<p class="structure">${esc(rs.structure)}</p>
</details>
</section>`;
}

/** 하루치 본문(섹션 ①~⑤)을 한 번에. day 페이지와 index가 공유한다. */
export function renderDaySections(content, review) {
  return [
    renderSentences(content.sentences),
    renderWords(content.words),
    renderConversation(content.conversation),
    renderQuiz(review?.due_words ?? []),
    renderReviewSentence(review?.review_sentence ?? null),
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
