#!/usr/bin/env node
// preview-formats.js — 최종 채택 포맷(정통 교재형 + 클러스터 단어)의 확인용 샘플 1장을 렌더한다.
// 파이프라인·데이터·스키마와 무관한 순수 렌더링: state/·data/를 읽지도 쓰지도 않는다.
// en 픽스처의 {{DATE}}를 샘플 날짜로 치환해 docs/preview/index.html 하나만 만든다.
// (5종 비교 프리뷰는 선택이 끝나 제거됨 — 필요하면 git 이력의 format-*.html 참고.)

import { readFileSync } from 'node:fs';
import { rootPath, writeTextAtomic } from './lib/store.js';
import { page, esc } from './lib/html.js';
import { renderFinal } from './lib/formats.js';

const SAMPLE_DATE = '2026-07-23';

function finalPage(content) {
  const body = `<header>
<h1>매일 학습 페이지 — 확인용 샘플</h1>
<p class="fmt-tagline">채택 포맷: <b>정통 교재형</b> + 단어만 <b>심화 클러스터형</b>(어원·파생·혼동어).</p>
<p class="fmt-sample">샘플 데이터 · ${esc(SAMPLE_DATE)} · 실제 페이지는 매일 이 레이아웃으로 생성됩니다.</p>
</header>
<main>
${renderFinal(content)}
</main>`;
  return page({ title: '매일 학습 페이지 — 확인용 샘플', body, relRoot: '../' });
}

function main() {
  const raw = readFileSync(rootPath('fixtures', 'sample-content.en.json'), 'utf8');
  const content = JSON.parse(raw.replaceAll('{{DATE}}', SAMPLE_DATE));
  writeTextAtomic(rootPath('docs', 'preview', 'index.html'), finalPage(content));
  console.log('확인용 샘플: docs/preview/index.html (정통 교재형 + 클러스터 단어)');
}

main();
