#!/usr/bin/env node
// build.js — data/<lang>/*/(content.json + review.json)를 전부 스캔해
// docs/<lang>/days/*.html + docs/<lang>/index.html + 허브 docs/index.html을 처음부터 다시 만든다.
// --lang을 받지 않는 유일한 스크립트: 항상 전 언어 + 허브를 재생성한다.
// 단어 상태(words.json)는 읽지 않는다. 순수 재생성이므로 몇 번을 돌려도 결과가 같다.

import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isValidDateString } from './lib/dates.js';
import { rootPath, readJson, writeTextAtomic, readRunlog, writeJsonAtomic } from './lib/store.js';
import { LANGS } from './lib/langs.js';
import { page, esc, renderDaySections, renderDayNav } from './lib/html.js';
import { mdToHtml } from './lib/markdown.js';

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
function buildHub(daysByLang, hasBasics = false) {
  const archives = Object.entries(LANGS)
    .map(([lang, config]) => `<a href="${esc(lang)}/index.html">${esc(config.label)}</a>`)
    .join(' · ');
  const basicsBtn = hasBasics
    ? '<p class="hub-basics"><a class="btn" href="basics/index.html">📚 기초 교재 (일본어)</a></p>\n'
    : '';
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
${basicsBtn}<p class="track-archives">아카이브: ${archives}</p>
</header>
<main>
${list}
</main>`;
  return page({ title: '매일 언어 학습', body, relRoot: '' });
}

/** 폴더명 → 목차 트리의 그룹 표시명(파일 목록 자체는 파일 시스템에서 생성).
 *  versions를 맨 앞에 — 지금은 "1과를 여러 방식으로" 비교하는 게 주 용도. */
const BASICS_GROUPS = {
  versions: '1과 · 방식 비교',
  'book1-conversation': '대화 입문',
  'book2-grammar': '기본 문법',
  'book3-expressions': '필수 표현',
  'book4-kanji': '필수 한자',
};

/** basics 로드맵 — 인덱스에 사설로 얹지 않는다(공부 화면은 깔끔하게). 별도 html도 안 냄. */
const BASICS_ROADMAP_REL = 'ja/README.md';

/** basics/ 아래 모든 .md의 경로를 basics 루트 기준 상대(/ 구분)로 재귀 수집. */
function walkMd(dir, base = dir) {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkMd(full, base));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      results.push(full.slice(base.length + 1).replaceAll('\\', '/'));
    }
  }
  return results;
}

/** md 첫 H1을 제목으로(없으면 fallback). */
function firstHeading(md, fallback) {
  for (const line of md.split(/\r?\n/)) {
    const m = /^#\s+(.*)$/.exec(line.trim());
    if (m) return m[1].trim();
  }
  return fallback;
}

/** basics 상대경로(ja/…/x.md)의 html이 docs 루트까지 올라가는 relRoot("../" 반복).
 *  docs/basics/<rel>.html 기준: 디렉터리 깊이 = (rel의 디렉터리 수) + 'basics' 1 = rel의 세그먼트 수. */
function basicsRelRoot(rel) {
  return '../'.repeat(rel.split('/').length);
}

/** 개별 교재 페이지 렌더(상단 내비 + md 본문). */
function buildBasicsPage(rel, md) {
  const relRoot = basicsRelRoot(rel);
  const title = firstHeading(md, rel);
  const nav = `<nav class="basics-nav"><a href="${relRoot}basics/index.html">← 기초 교재</a> · <a href="${relRoot}index.html">홈</a></nav>`;
  const body = `${nav}
<main class="md-content">
${mdToHtml(md)}
</main>`;
  return page({ title, body, relRoot });
}

/** 기초 교재 랜딩(docs/basics/index.html): 사설 없이 그룹별 목차 링크만. */
function buildBasicsIndex(rels) {
  // 폴더(그룹)별로 파일을 모은다 — 최상위 로드맵(2단 경로)은 트리에서 제외.
  const byGroup = new Map();
  for (const rel of rels) {
    const segs = rel.split('/');
    if (segs.length < 3) continue;
    const folder = segs[1];
    if (!byGroup.has(folder)) byGroup.set(folder, []);
    byGroup.get(folder).push(rel);
  }
  const ordered = [
    ...Object.keys(BASICS_GROUPS).filter((f) => byGroup.has(f)),
    ...[...byGroup.keys()].filter((f) => !(f in BASICS_GROUPS)).sort(),
  ];
  const tree = ordered
    .map((folder) => {
      const label = BASICS_GROUPS[folder] ?? folder;
      const items = byGroup
        .get(folder)
        .sort()
        .map((rel) => {
          const md = readFileSync(rootPath('basics', rel), 'utf8');
          const title = firstHeading(md, rel.split('/').pop());
          const href = rel.replace(/\.md$/, '.html');
          return `<li><a href="${esc(href)}">${esc(title)}</a></li>`;
        })
        .join('\n');
      return `<section class="basics-group">
<h2>${esc(label)}</h2>
<ul class="basics-tree">
${items}
</ul>
</section>`;
    })
    .join('\n');

  const body = `<header>
<p class="hub-link"><a href="../index.html">← 홈</a></p>
<h1>기초 교재</h1>
</header>
<main class="basics-index-tree">
${tree}
</main>`;
  return page({ title: '기초 교재', body, relRoot: '../' });
}

/** basics/ md → docs/basics/ html 렌더 + 랜딩 index. 없으면 조용히 스킵(0 반환). */
function buildBasics() {
  const basicsRoot = rootPath('basics');
  if (!existsSync(basicsRoot)) return 0;
  const rels = walkMd(basicsRoot);
  if (rels.length === 0) return 0;
  let rendered = 0;
  for (const rel of rels) {
    if (rel === BASICS_ROADMAP_REL) continue; // 로드맵은 index.html로 대체 렌더
    const md = readFileSync(join(basicsRoot, rel), 'utf8');
    writeTextAtomic(
      rootPath('docs', 'basics', rel.replace(/\.md$/, '.html')),
      buildBasicsPage(rel, md)
    );
    rendered++;
  }
  writeTextAtomic(rootPath('docs', 'basics', 'index.html'), buildBasicsIndex(rels));
  console.log(`기초 교재: 교재 ${rendered}개 + 랜딩 index → docs/basics/ (총 ${rendered + 1}개)`);
  return rendered + 1;
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
  const basicsRoot = rootPath('basics');
  const hasBasics = existsSync(basicsRoot) && walkMd(basicsRoot).length > 0;
  writeTextAtomic(rootPath('docs', 'index.html'), buildHub(daysByLang, hasBasics));

  for (const [lang, days] of Object.entries(daysByLang)) {
    console.log(
      `빌드 완료(${lang}): day 페이지 ${days.length}개 + docs/${lang}/index.html` +
        (days.length > 0 ? ` (최신: docs/${lang}/days/${days[days.length - 1]}.html)` : '')
    );
  }
  console.log('허브: docs/index.html');

  buildBasics(); // 허브 생성 뒤. basics가 없으면 조용히 스킵.
}

main();
