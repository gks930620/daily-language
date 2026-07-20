#!/usr/bin/env node
// build.js — data/*/(content.json + review.json)를 전부 스캔해
// docs/days/*.html과 docs/index.html을 처음부터 다시 만든다.
// 단어 상태(words.json)는 읽지 않는다. 순수 재생성이므로 몇 번을 돌려도 결과가 같다.

import { readdirSync, existsSync } from 'node:fs';
import { isValidDateString } from './lib/dates.js';
import { rootPath, readJson, writeTextAtomic, readRunlog, writeJsonAtomic } from './lib/store.js';
import { page, esc, renderDaySections, renderDayNav } from './lib/html.js';

function listDays() {
  const dataDir = rootPath('data');
  if (!existsSync(dataDir)) return [];
  return readdirSync(dataDir, { withFileTypes: true })
    .filter(
      (d) =>
        d.isDirectory() &&
        isValidDateString(d.name) &&
        existsSync(rootPath('data', d.name, 'content.json'))
    )
    .map((d) => d.name)
    .sort();
}

/**
 * "오늘의 단어"는 settle이 동결한 selected.json(최종 선별 20개)이 기준.
 * selected.json이 없는 과거 데이터는 content.words로 폴백한다.
 */
function loadDay(date) {
  const content = readJson(rootPath('data', date, 'content.json'));
  const review = readJson(rootPath('data', date, 'review.json'));
  const selected = readJson(rootPath('data', date, 'selected.json'));
  const words = Array.isArray(selected?.words) ? selected.words : content.words;
  return { content: { ...content, words }, review };
}

function buildDayPage(date, prevDate, nextDate) {
  const { content, review } = loadDay(date);
  const nav = renderDayNav(prevDate, nextDate);
  const body = `<header>
${nav}
<h1>${esc(date)} 영어 학습</h1>
</header>
<main>
${renderDaySections(content, review)}
</main>
<footer>
${nav}
</footer>`;
  return page({ title: `${date} 영어 학습`, body, relRoot: '../' });
}

function buildIndex(days) {
  let latestBlock = '<p class="empty">아직 생성된 콘텐츠가 없습니다.</p>';
  if (days.length > 0) {
    const latest = days[days.length - 1];
    const { content, review } = loadDay(latest);
    latestBlock = `<p class="latest-date">최신: <a href="days/${esc(latest)}.html">${esc(latest)}</a></p>
${renderDaySections(content, review)}`;
  }
  const archive =
    days.length > 0
      ? `<ul class="archive-list">
${[...days]
  .reverse()
  .map((d) => `<li><a href="days/${esc(d)}.html">${esc(d)}</a></li>`)
  .join('\n')}
</ul>`
      : '<p class="empty">비어 있음</p>';
  const body = `<header>
<h1>매일 영어 학습</h1>
</header>
<main>
${latestBlock}
<section id="archive">
<h2>아카이브</h2>
${archive}
</section>
</main>`;
  return page({ title: '매일 영어 학습', body, relRoot: '' });
}

function main() {
  const days = listDays();
  for (let i = 0; i < days.length; i++) {
    const date = days[i];
    const html = buildDayPage(date, days[i - 1] ?? null, days[i + 1] ?? null);
    writeTextAtomic(rootPath('docs', 'days', `${date}.html`), html);
  }
  writeTextAtomic(rootPath('docs', 'index.html'), buildIndex(days));

  // 최신 날짜의 runlog 항목에 built_at 타임스탬프만 남긴다(있을 때만).
  if (days.length > 0) {
    const latest = days[days.length - 1];
    const runlog = readRunlog();
    if (runlog.runs?.[latest]) {
      runlog.runs[latest].built_at = new Date().toISOString();
      writeJsonAtomic(rootPath('state', 'runlog.json'), runlog);
    }
  }

  console.log(`빌드 완료: day 페이지 ${days.length}개 + index.html`);
  if (days.length > 0) {
    console.log(`최신: docs/days/${days[days.length - 1]}.html`);
  }
}

main();
