#!/usr/bin/env node
// build.js — data/<lang>/*/(content.json + review.json)를 전부 스캔해
// docs/<lang>/days/*.html + docs/<lang>/index.html + 허브 docs/index.html을 처음부터 다시 만든다.
// --lang을 받지 않는 유일한 스크립트: 항상 전 언어 + 허브를 재생성한다.
// 단어 상태(words.json)는 읽지 않는다. 순수 재생성이므로 몇 번을 돌려도 결과가 같다.

import { readdirSync, existsSync } from 'node:fs';
import { isValidDateString } from './lib/dates.js';
import { rootPath, readJson, writeTextAtomic, readRunlog, writeJsonAtomic } from './lib/store.js';
import { LANGS } from './lib/langs.js';
import { page, esc, renderDaySections, renderDayNav } from './lib/html.js';

function listDays(lang) {
  const dataDir = rootPath('data', lang);
  if (!existsSync(dataDir)) return [];
  return readdirSync(dataDir, { withFileTypes: true })
    .filter(
      (d) =>
        d.isDirectory() &&
        isValidDateString(d.name) &&
        existsSync(rootPath('data', lang, d.name, 'content.json'))
    )
    .map((d) => d.name)
    .sort();
}

/**
 * "오늘의 단어"는 settle이 동결한 selected.json(최종 선별본)이 기준.
 * selected.json이 없는 과거 데이터는 content.words로 폴백한다.
 */
function loadDay(lang, date) {
  const content = readJson(rootPath('data', lang, date, 'content.json'));
  const review = readJson(rootPath('data', lang, date, 'review.json'));
  const selected = readJson(rootPath('data', lang, date, 'selected.json'));
  const words = Array.isArray(selected?.words) ? selected.words : content.words;
  return { content: { ...content, words }, review };
}

function buildDayPage(lang, config, date, prevDate, nextDate) {
  const { content, review } = loadDay(lang, date);
  const nav = renderDayNav(prevDate, nextDate);
  const body = `<header>
${nav}
<h1>${esc(date)} ${esc(config.label)} 학습</h1>
</header>
<main>
${renderDaySections(content, review)}
</main>
<footer>
${nav}
</footer>`;
  return page({ title: `${date} ${config.label} 학습`, body, relRoot: '../../' });
}

function buildLangIndex(lang, config, days) {
  let latestBlock = '<p class="empty">아직 생성된 콘텐츠가 없습니다.</p>';
  if (days.length > 0) {
    const latest = days[days.length - 1];
    const { content, review } = loadDay(lang, latest);
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
<p class="hub-link"><a href="../index.html">← 전체 언어</a></p>
<h1>${esc(config.pageTitle)}</h1>
</header>
<main>
${latestBlock}
<section id="archive">
<h2>아카이브</h2>
${archive}
</section>
</main>`;
  return page({ title: config.pageTitle, body, relRoot: '../' });
}

/**
 * 허브 docs/index.html — 전 트랙 날짜의 합집합을 내림차순 리스트로.
 * 날짜마다 그 날짜 데이터가 있는 트랙만 링크한다(라벨·순서는 langs.js가 기준).
 * 트랙별 아카이브(트랙 인덱스) 링크는 상단에 작게 유지.
 */
function buildHub(daysByLang) {
  const archives = Object.entries(LANGS)
    .map(([lang, config]) => `<a href="${esc(lang)}/index.html">${esc(config.label)}</a>`)
    .join(' · ');
  const allDates = [...new Set(Object.values(daysByLang).flat())].sort().reverse();
  const items = allDates
    .map((date) => {
      const links = Object.entries(LANGS)
        .filter(([lang]) => (daysByLang[lang] ?? []).includes(date))
        .map(
          ([lang, config]) =>
            `<a href="${esc(lang)}/days/${esc(date)}.html">${esc(config.label)}</a>`
        )
        .join(' · ');
      return `<li class="date-item">
<p class="date">${esc(date)}</p>
<p class="date-tracks">${links}</p>
</li>`;
    })
    .join('\n');
  const list =
    allDates.length > 0
      ? `<ul class="date-list">
${items}
</ul>`
      : '<p class="empty">아직 생성된 콘텐츠가 없습니다.</p>';
  const body = `<header>
<h1>매일 언어 학습</h1>
<p class="track-archives">아카이브: ${archives}</p>
</header>
<main>
${list}
</main>`;
  return page({ title: '매일 언어 학습', body, relRoot: '' });
}

function main() {
  const daysByLang = {};
  for (const [lang, config] of Object.entries(LANGS)) {
    const days = listDays(lang);
    daysByLang[lang] = days;
    for (let i = 0; i < days.length; i++) {
      const date = days[i];
      const html = buildDayPage(lang, config, date, days[i - 1] ?? null, days[i + 1] ?? null);
      writeTextAtomic(rootPath('docs', lang, 'days', `${date}.html`), html);
    }
    writeTextAtomic(rootPath('docs', lang, 'index.html'), buildLangIndex(lang, config, days));

    // 언어별 runlog의 최신 날짜 항목에 built_at 타임스탬프만 남긴다(있을 때만).
    if (days.length > 0) {
      const latest = days[days.length - 1];
      const runlog = readRunlog(lang);
      if (runlog.runs?.[latest]) {
        runlog.runs[latest].built_at = new Date().toISOString();
        writeJsonAtomic(rootPath('state', lang, 'runlog.json'), runlog);
      }
    }
  }
  writeTextAtomic(rootPath('docs', 'index.html'), buildHub(daysByLang));

  for (const [lang, days] of Object.entries(daysByLang)) {
    console.log(
      `빌드 완료(${lang}): day 페이지 ${days.length}개 + docs/${lang}/index.html` +
        (days.length > 0 ? ` (최신: docs/${lang}/days/${days[days.length - 1]}.html)` : '')
    );
  }
  console.log('허브: docs/index.html');
}

main();
