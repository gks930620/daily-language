#!/usr/bin/env node
// preview-formats.js — 일일 학습 페이지의 "표현 포맷" 5종을 비교 프리뷰로 렌더한다.
// 파이프라인·데이터·스키마와 무관한 순수 렌더링 작업: state/·data/를 읽지도 쓰지도 않는다.
// en 픽스처(fixtures/sample-content.en.json)의 {{DATE}}를 고정 샘플 날짜로 치환해
// 같은 콘텐츠를 5가지 방식으로 docs/preview/format-1..5.html + index.html로 만든다.

import { readFileSync } from 'node:fs';
import { rootPath, writeTextAtomic } from './lib/store.js';
import { page, esc } from './lib/html.js';
import { FORMATS } from './lib/formats.js';

const SAMPLE_DATE = '2026-07-23';

/** 상·하단 공용 내비: "포맷 N / 5 · 다른 포맷 보기". */
function nav(cur) {
  const links = FORMATS.map((f) =>
    f.n === cur ? `<b>${f.n}</b>` : `<a href="format-${f.n}.html">${f.n}</a>`
  ).join(' · ');
  return `<nav class="fmt-nav">
<span class="fmt-nav-cur">포맷 ${cur} / 5</span>
<span class="fmt-nav-links">다른 포맷 보기: ${links} · <a href="index.html">개요</a></span>
</nav>`;
}

function formatPage(content, f) {
  const body = `${nav(f.n)}
<header>
<h1>포맷 ${f.n} — ${esc(f.name)}</h1>
<p class="fmt-tagline">${esc(f.tagline)}</p>
<p class="fmt-sample">샘플 데이터 · ${esc(SAMPLE_DATE)}</p>
</header>
<main>
${f.render(content)}
</main>
<footer>
${nav(f.n)}
</footer>`;
  return page({ title: `포맷 ${f.n} — ${f.name}`, body, relRoot: '../' });
}

function indexPage() {
  const items = FORMATS.map(
    (f) => `<li class="fmt-index-item">
<a class="fmt-index-link" href="format-${f.n}.html"><b>포맷 ${f.n} — ${esc(f.name)}</b></a>
<p class="fmt-index-desc">${esc(f.tagline)}</p>
</li>`
  ).join('\n');
  const body = `<header>
<h1>일일 학습 페이지 — 표현 포맷 5종 비교</h1>
<p>같은 콘텐츠(문장 5 · 단어 20 · 회화 · 복습 퀴즈)를 다섯 가지 방식으로 보여줍니다. 다섯 개를 둘러보고 <b>마음에 드는 번호를 알려주세요.</b></p>
</header>
<main>
<ol class="fmt-index-list">
${items}
</ol>
<p class="fmt-note">전부 같은 ${esc(
    SAMPLE_DATE
  )} 샘플 데이터로 렌더했습니다. 인터랙션은 접기(details)만 쓰고 자바스크립트는 없습니다. 콘텐츠 자체는 동일하고 설명 방식·순서·레이아웃만 다릅니다.</p>
</main>`;
  return page({ title: '표현 포맷 5종 비교', body, relRoot: '../' });
}

function main() {
  const raw = readFileSync(rootPath('fixtures', 'sample-content.en.json'), 'utf8');
  const content = JSON.parse(raw.replaceAll('{{DATE}}', SAMPLE_DATE));

  for (const f of FORMATS) {
    const out = rootPath('docs', 'preview', `format-${f.n}.html`);
    writeTextAtomic(out, formatPage(content, f));
    console.log(`프리뷰 생성: docs/preview/format-${f.n}.html (${f.name})`);
  }
  writeTextAtomic(rootPath('docs', 'preview', 'index.html'), indexPage());
  console.log('프리뷰 개요: docs/preview/index.html');
}

main();
