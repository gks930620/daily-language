// formats.js — 같은 content 객체를 다섯 가지 방식으로 보여주는 프리뷰 전용 렌더러.
// 비교·선택용이므로 파이프라인(build/settle/verify)과는 무관하다 — docs/preview/에서만 쓴다.
// JS 0줄 원칙은 여기서도 지킨다: 인터랙션은 전부 네이티브 <details>.
// 이스케이프와 단어 지식(note·family·related) 렌더는 html.js를 재사용한다.

import {
  esc,
  renderWordKnowledge,
  renderSentences,
  renderWords,
  renderConversation,
} from './html.js';

/** 복습 섹션은 실제 due 데이터가 없어 오늘 단어 앞 3개로 예시를 만든다. */
const REVIEW_NOTE =
  '실제 페이지에선 그날 복습 예정인 단어가 자동으로 채워집니다. 아래는 오늘 단어 3개로 만든 예시입니다.';

const first3 = (content) => content.words.slice(0, 3);

/** 문단(passage) 원문 한 덩어리 — en 픽스처는 공백으로 이어 붙인다. */
function passageBlock(content) {
  if (!content.passage_note) return '';
  const text = content.sentences.map((s) => s.en).join(' ');
  return `<div class="passage">
<p class="passage-note">${esc(content.passage_note)}</p>
<p class="passage-text en">${esc(text)}</p>
</div>
`;
}

/** 예문에서 표제어를 빈칸으로 — 플래시카드 빈칸 채우기용(대소문자 무시, 첫 등장만). */
function blank(example, head) {
  const escaped = head.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return example.replace(new RegExp(escaped, 'i'), '_____');
}

/** 회화 핵심 표현 목록(공용). */
function keyExpressionList(conv) {
  return `<ul class="key-expressions">${conv.key_expressions
    .map((k) => `<li><b>${esc(k.en)}</b> — ${esc(k.ko)}</li>`)
    .join('')}</ul>`;
}

/* ───────────────────────── 포맷 1 · 정통 교재형 ─────────────────────────
   순서 문장→단어→회화→복습. 단어=표, 문장=원문+접기. 지금 페이지와 가장 비슷. */

function reviewFold(content) {
  const items = first3(content)
    .map(
      (w) => `<li class="quiz-item">
<p class="quiz-word"><b>${esc(w.headword)}</b></p>
<p class="quiz-example en">${esc(w.example_en)}</p>
<details><summary>정답</summary>
<p class="answer">${esc(w.pos)} ${esc(w.ko)}</p>
<p class="ko">${esc(w.example_ko)}</p>
${renderWordKnowledge(w)}</details>
</li>`
    )
    .join('\n');
  return `<section id="quiz">
<h2>복습 퀴즈 <span class="count">(예시 3)</span></h2>
<p class="fmt-note">${REVIEW_NOTE}</p>
<ol class="quiz-list">
${items}
</ol>
</section>`;
}

export function renderFormat1(content) {
  return [
    renderSentences(content.sentences, content.passage_note),
    renderWords(content.words),
    renderConversation(content.conversation),
    reviewFold(content),
  ].join('\n');
}

/* ─────────────────── 포맷 2 · 액티브 리콜(플래시카드)형 ───────────────────
   전부 "먼저 맞히고 펼치기". 단어=카드 그리드, 문장·회화는 영어만+접기. */

function recallSentences(content) {
  const items = content.sentences
    .map(
      (s) => `<div class="fmt-recall">
<p class="en">${esc(s.en)}</p>
<details><summary>해석 확인 · 구문분석</summary>
<p class="ko">${esc(s.ko)}</p>
<p class="structure">${esc(s.structure)}</p></details>
</div>`
    )
    .join('\n');
  return `<section id="sentences">
<h2>오늘의 문장 — 먼저 해석해 보기</h2>
<p class="fmt-note">영어를 읽고 뜻을 떠올린 뒤 펼쳐 확인하세요.</p>
${items}
</section>`;
}

function cardWords(content) {
  const cards = content.words
    .map(
      (w) => `<details class="fmt-card">
<summary><b class="en">${esc(w.headword)}</b> <span class="fmt-card-pos">${esc(w.pos)}</span>
<span class="fmt-card-ex en">${esc(w.example_en)}</span></summary>
<p class="fmt-card-mean">${esc(w.ko)}</p>
<p class="ko">${esc(w.example_ko)}</p>
${renderWordKnowledge(w)}</details>`
    )
    .join('\n');
  return `<section id="words">
<h2>오늘의 단어 — 플래시카드 <span class="count">(${content.words.length})</span></h2>
<p class="fmt-note">단어와 예문을 보고 뜻을 떠올린 뒤 카드를 펼치세요.</p>
<div class="fmt-card-grid">
${cards}
</div>
</section>`;
}

function recallConversation(content) {
  const conv = content.conversation;
  const lines = conv.lines
    .map(
      (l) =>
        `<details class="line"><summary><b class="speaker">${esc(l.speaker)}</b> ${esc(
          l.en
        )}</summary><p class="ko">${esc(l.ko)}</p></details>`
    )
    .join('\n');
  const keys = conv.key_expressions
    .map(
      (k) =>
        `<details class="fmt-key-recall"><summary><b>${esc(k.en)}</b></summary><p class="ko">${esc(
          k.ko
        )}</p></details>`
    )
    .join('\n');
  return `<section id="conversation">
<h2>오늘의 회화 — ${esc(conv.topic)}</h2>
<p class="situation">${esc(conv.situation_ko)}</p>
<div class="dialogue">
${lines}
</div>
<h3>핵심 표현 — 뜻 떠올리기</h3>
${keys}
</section>`;
}

function reviewFlash(content) {
  const items = first3(content)
    .map(
      (w) => `<details class="fmt-card fmt-card--quiz">
<summary><span class="fmt-card-ex en">${esc(blank(w.example_en, w.headword))}</span></summary>
<p class="fmt-card-answer"><b class="en">${esc(w.headword)}</b> <span class="fmt-card-pos">${esc(
        w.pos
      )}</span> — ${esc(w.ko)}</p>
<p class="ko">${esc(w.example_ko)}</p></details>`
    )
    .join('\n');
  return `<section id="quiz">
<h2>복습 퀴즈 — 빈칸 채우기 <span class="count">(예시 3)</span></h2>
<p class="fmt-note">${REVIEW_NOTE}</p>
<div class="fmt-card-grid">
${items}
</div>
</section>`;
}

export function renderFormat2(content) {
  return [
    recallSentences(content),
    cardWords(content),
    recallConversation(content),
    reviewFlash(content),
  ].join('\n');
}

/* ───────────────────── 포맷 3 · 맥락 우선(스토리)형 ─────────────────────
   순서 회화→문장→단어→복습. 장면을 먼저 크게, 맥락 속에서 단어를 익힌다. */

function sceneConversation(content) {
  const conv = content.conversation;
  const lines = conv.lines
    .map(
      (l) => `<div class="fmt-scene-line"><b class="speaker">${esc(l.speaker)}</b>
<span class="en">${esc(l.en)}</span>
<span class="ko">${esc(l.ko)}</span></div>`
    )
    .join('\n');
  return `<section id="conversation">
<h2>오늘의 장면 — ${esc(conv.topic)}</h2>
<div class="fmt-scene">
<p class="fmt-scene-situation">${esc(conv.situation_ko)}</p>
</div>
<div class="dialogue fmt-script">
${lines}
</div>
<h3>핵심 표현</h3>
${keyExpressionList(conv)}
</section>`;
}

function storySentences(content) {
  const items = content.sentences
    .map(
      (s) => `<div class="fmt-story-s">
<p class="en">${esc(s.en)}</p>
<p class="ko">${esc(s.ko)}</p>
<details><summary>구문 분석</summary><p class="structure">${esc(s.structure)}</p></details>
</div>`
    )
    .join('\n');
  return `<section id="sentences">
<h2>오늘의 지문</h2>
${passageBlock(content)}${items}
</section>`;
}

function contextWords(content) {
  const items = content.words
    .map((w) => {
      const knowledge = renderWordKnowledge(w);
      return `<li class="fmt-wordline">
<p class="fmt-wl-head"><b class="en">${esc(w.headword)}</b> <span class="pos">${esc(
        w.pos
      )}</span> — ${esc(w.ko)}</p>
<p class="fmt-wl-ex"><span class="en">${esc(w.example_en)}</span><br><small class="ko">${esc(
        w.example_ko
      )}</small></p>
${knowledge ? `${knowledge}\n` : ''}</li>`;
    })
    .join('\n');
  return `<section id="words">
<h2>오늘 지문·대화에서 만난 단어 <span class="count">(${content.words.length})</span></h2>
<p class="fmt-note">문장과 회화의 맥락 속에서 쓰인 표현들입니다.</p>
<ul class="fmt-wordlist">
${items}
</ul>
</section>`;
}

export function renderFormat3(content) {
  return [
    sceneConversation(content),
    storySentences(content),
    contextWords(content),
    reviewFold(content),
  ].join('\n');
}

/* ─────────────────────── 포맷 4 · 미니멀 한눈에형 ───────────────────────
   접기 없이 전부 펼친 상태, 한 줄 압축. 폰 스크롤·빠른 복습용. */

function minWords(content) {
  const items = content.words
    .map((w) => {
      const fam =
        Array.isArray(w.family) && w.family.length > 0
          ? ` <span class="fmt-min-fam">· 파생 ${esc(w.family.map((m) => m.word).join(', '))}</span>`
          : '';
      return `<li class="fmt-min-word"><b class="en">${esc(w.headword)}</b> — ${esc(
        w.ko
      )}${fam} <span class="fmt-min-ex">· ${esc(w.example_en)}</span></li>`;
    })
    .join('\n');
  return `<section id="words">
<h2>단어 <span class="count">(${content.words.length})</span></h2>
<ul class="fmt-min-list">
${items}
</ul>
</section>`;
}

function minSentences(content) {
  const items = content.sentences
    .map(
      (s) => `<li class="fmt-min-sentence"><p class="en">${esc(s.en)}</p><p class="ko">${esc(
        s.ko
      )}</p></li>`
    )
    .join('\n');
  return `<section id="sentences">
<h2>문장 <span class="count">(${content.sentences.length})</span></h2>
<ul class="fmt-min-list">
${items}
</ul>
</section>`;
}

function minConversation(content) {
  const conv = content.conversation;
  const rows = conv.lines
    .map(
      (l) =>
        `<tr><th class="speaker">${esc(l.speaker)}</th><td class="en">${esc(
          l.en
        )}</td><td class="ko">${esc(l.ko)}</td></tr>`
    )
    .join('\n');
  const keys = conv.key_expressions
    .map((k) => `<li><b>${esc(k.en)}</b> — ${esc(k.ko)}</li>`)
    .join('');
  return `<section id="conversation">
<h2>회화 — ${esc(conv.topic)}</h2>
<p class="situation">${esc(conv.situation_ko)}</p>
<table class="fmt-dialogue-table"><tbody>
${rows}
</tbody></table>
<h3>핵심 표현</h3>
<ul class="key-expressions">${keys}</ul>
</section>`;
}

function minReview(content) {
  const items = first3(content)
    .map(
      (w) => `<li class="fmt-min-quiz">
<span class="quiz-example en">${esc(w.example_en)}</span>
<details><summary>정답</summary><b class="en">${esc(w.headword)}</b> ${esc(w.pos)} — ${esc(
        w.ko
      )}</details>
</li>`
    )
    .join('\n');
  return `<section id="quiz">
<h2>복습 퀴즈 <span class="count">(예시 3)</span></h2>
<p class="fmt-note">${REVIEW_NOTE}</p>
<ul class="fmt-min-list">
${items}
</ul>
</section>`;
}

export function renderFormat4(content) {
  return [
    minSentences(content),
    minWords(content),
    minConversation(content),
    minReview(content),
  ].join('\n');
}

/* ─────────────────────── 포맷 5 · 심화 클러스터형 ───────────────────────
   단어를 어원·파생으로 크게 묶고, 구문 분석을 펼친 상태로 자세히. */

function clusterWords(content) {
  const items = content.words
    .map((w) => {
      const etym = w.note
        ? `<div class="fmt-etymology"><b>어원·감각</b><p>${esc(w.note)}</p></div>`
        : '';
      const family =
        Array.isArray(w.family) && w.family.length > 0
          ? `<div class="fmt-chips"><span class="fmt-chip-label">파생</span>${w.family
              .map(
                (m) =>
                  `<span class="fmt-chip"><b>${esc(m.word)}</b>${
                    m.pos ? `(${esc(m.pos)})` : ''
                  } ${esc(m.ko)}</span>`
              )
              .join('')}</div>`
          : '';
      const related =
        Array.isArray(w.related) && w.related.length > 0
          ? `<div class="fmt-chips"><span class="fmt-chip-label">혼동어</span>${w.related
              .map(
                (r) =>
                  `<span class="fmt-chip fmt-chip--related"><b>${esc(r.word)}</b>${
                    r.ko ? `(${esc(r.ko)})` : ''
                  } — ${esc(r.note)}</span>`
              )
              .join('')}</div>`
          : '';
      return `<div class="fmt-cluster">
<p class="fmt-cluster-head"><b class="en">${esc(w.headword)}</b> <span class="pos">${esc(
        w.pos
      )}</span> <span class="fmt-cluster-ko">${esc(w.ko)}</span></p>
<p class="fmt-cluster-ex"><span class="en">${esc(w.example_en)}</span><br><small class="ko">${esc(
        w.example_ko
      )}</small></p>
${etym}${family}${related}</div>`;
    })
    .join('\n');
  return `<section id="words">
<h2>단어 클러스터 — 어원·파생으로 넓히기 <span class="count">(${content.words.length})</span></h2>
${items}
</section>`;
}

function deepSentences(content) {
  const items = content.sentences
    .map((s) => {
      const notes =
        Array.isArray(s.vocab_notes) && s.vocab_notes.length > 0
          ? `<ul class="vocab-notes">${s.vocab_notes
              .map((v) => `<li><b>${esc(v.word)}</b> — ${esc(v.ko)}</li>`)
              .join('')}</ul>`
          : '';
      return `<div class="fmt-deep-s">
<p class="en">${esc(s.en)}</p>
<p class="ko">${esc(s.ko)}</p>
<div class="fmt-structure"><b>구문 분석</b><p class="structure">${esc(s.structure)}</p></div>
${notes}</div>`;
    })
    .join('\n');
  return `<section id="sentences">
<h2>문장 — 구문 분석 <span class="count">(${content.sentences.length})</span></h2>
${passageBlock(content)}${items}
</section>`;
}

function keyFirstConversation(content) {
  const conv = content.conversation;
  const lines = conv.lines
    .map(
      (l) =>
        `<details class="line"><summary><b class="speaker">${esc(l.speaker)}</b> ${esc(
          l.en
        )}</summary><p class="ko">${esc(l.ko)}</p></details>`
    )
    .join('\n');
  return `<section id="conversation">
<h2>오늘의 회화 — ${esc(conv.topic)}</h2>
<div class="fmt-key-box">
<h3>핵심 표현</h3>
${keyExpressionList(conv)}
</div>
<p class="situation">${esc(conv.situation_ko)}</p>
<div class="dialogue">
${lines}
</div>
</section>`;
}

function reviewCluster(content) {
  const items = first3(content)
    .map(
      (w) => `<li class="quiz-item">
<p class="quiz-word"><b>${esc(w.headword)}</b></p>
<p class="quiz-example en">${esc(w.example_en)}</p>
<details><summary>정답 · 파생까지</summary>
<p class="answer">${esc(w.pos)} ${esc(w.ko)}</p>
<p class="ko">${esc(w.example_ko)}</p>
${renderWordKnowledge(w)}</details>
</li>`
    )
    .join('\n');
  return `<section id="quiz">
<h2>복습 퀴즈 <span class="count">(예시 3)</span></h2>
<p class="fmt-note">${REVIEW_NOTE}</p>
<ol class="quiz-list">
${items}
</ol>
</section>`;
}

export function renderFormat5(content) {
  return [
    clusterWords(content),
    deepSentences(content),
    keyFirstConversation(content),
    reviewCluster(content),
  ].join('\n');
}

/* ─────────────────── 최종 채택 포맷 · 정통 교재형 + 클러스터 단어 ───────────────────
   사용자 확정(2026-07-22): 포맷 1(정통 교재형)을 뼈대로 하되, 단어 섹션만
   포맷 5의 클러스터형(어원·파생·혼동어 박스)으로 교체. 순서 문장→단어→회화→복습. */
export function renderFinal(content) {
  return [
    renderSentences(content.sentences, content.passage_note),
    clusterWords(content),
    renderConversation(content.conversation),
    reviewFold(content),
  ].join('\n');
}

/** 프리뷰 index·페이지가 공유하는 포맷 메타(번호·이름·한 줄 설명·렌더러). */
export const FORMATS = [
  {
    n: 1,
    name: '정통 교재형',
    tagline:
      '순서 문장→단어→회화→복습. 단어는 표로 정돈하고 문장은 원문+접기(해석·구문). 지금 페이지와 가장 비슷한 정돈형.',
    render: renderFormat1,
  },
  {
    n: 2,
    name: '액티브 리콜(플래시카드)형',
    tagline:
      '전부 먼저 맞히고 펼쳐 확인. 단어는 카드 그리드, 문장·회화는 영어만 보이고 접기로 해석. 능동 암기 극대화.',
    render: renderFormat2,
  },
  {
    n: 3,
    name: '맥락 우선(스토리)형',
    tagline:
      '오늘의 장면(회화)부터 크게. 지문→단어 순으로, 맥락 속에서 표현을 익히는 흐름.',
    render: renderFormat3,
  },
  {
    n: 4,
    name: '미니멀 한눈에형',
    tagline:
      '접기 없이 전부 펼친 한 줄 압축. 단어 한 줄·문장 두 줄·회화는 대사|해석 표. 폰 스크롤·빠른 복습용.',
    render: renderFormat4,
  },
  {
    n: 5,
    name: '심화 클러스터형',
    tagline:
      '어원·파생으로 단어를 묶은 큰 박스, 구문 분석은 펼친 상태로 자세히, 회화는 핵심 표현 강조. 깊게 파는 설명 중심.',
    render: renderFormat5,
  },
];
