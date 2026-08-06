#!/usr/bin/env node
// settle.js — AI 산출물(content.json)을 검증하고 단어 장부에 반영한다.
// state/<lang>/words.json을 쓰는 유일한 스크립트. 쓰기는 원자적, settled 마킹은 성공 후에만.

import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolveDate } from './lib/dates.js';
import {
  rootPath,
  writeJsonAtomic,
  readWordsState,
  readRunlog,
} from './lib/store.js';
import { LANGS, resolveLang } from './lib/langs.js';
import { assertValidContent } from './lib/validate.js';
import { newWordEntry, migrateWordsState } from './lib/wordbank.js';

/** headword 정규화: NFKC(전각/반각 등) → trim → 소문자. words.json 키와 dedup의 기준. */
function normalizeHeadword(s) {
  return s.normalize('NFKC').trim().toLowerCase();
}

function main() {
  const argv = process.argv.slice(2);
  const lang = resolveLang(argv);
  const config = LANGS[lang];
  const date = resolveDate(argv);
  const runlog = readRunlog(lang);

  if (runlog.runs?.[date]?.settled) {
    console.log(`이미 정산됨(${lang}, ${date}) — no-op.`);
    return;
  }

  const contentPath = rootPath('data', lang, date, 'content.json');
  if (!existsSync(contentPath)) {
    console.error(`에러: ${contentPath} 없음. generator가 content.json을 먼저 만들어야 함.`);
    process.exit(1);
  }

  const rawContent = readFileSync(contentPath, 'utf8');
  let content;
  try {
    content = JSON.parse(rawContent);
  } catch (err) {
    console.error(`에러: content.json 파싱 실패 — ${err.message}`);
    process.exit(1);
  }

  try {
    assertValidContent(content, date, lang);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }

  // 읽을 때마다 최신 스키마로 올린다(v1 SRS 잔재 제거, 멱등).
  const wordsState = migrateWordsState(readWordsState(lang));
  const notes = [];

  // --- 1) 신규 단어 dedup + 선별(최대 maxNewWords개) ---
  // AI의 known_words 회피는 참고일 뿐, 최종 중복 방어는 여기 코드다.
  // 크래시-재실행 가드: 오늘 이미 등록된 단어(added_on === date)를 쿼터에 포함해
  // words.json 쓰기 후 runlog 마킹 전에 죽어도 재실행에서 초과 등록되지 않는다.
  const maxNewWords = config.maxNewWords;
  const alreadyAddedToday = Object.values(wordsState.words).filter(
    (w) => w.added_on === date
  ).length;
  const quota = Math.max(0, maxNewWords - alreadyAddedToday);
  if (alreadyAddedToday > 0) {
    notes.push(
      `재실행 가드: 오늘 이미 등록된 단어 ${alreadyAddedToday}개 — 신규 쿼터에 포함`
    );
  }

  const registered = [];
  const duplicates = [];
  const seenInBatch = new Set();
  for (const w of content.words) {
    const headword = normalizeHeadword(w.headword);
    const existing = wordsState.words[headword];
    if (existing?.added_on === date) {
      continue; // 오늘자 재실행으로 이미 등록된 단어 — 중복 집계 대상 아님
    }
    if (existing || seenInBatch.has(headword)) {
      // 쿼터 도달 여부와 무관하게 끝까지 집계해 notes의 중복 개수를 정확히 남긴다.
      duplicates.push(headword);
      continue;
    }
    seenInBatch.add(headword);
    if (registered.length >= quota) {
      continue; // 쿼터 초과 후보 — 등록하지 않음(집계만 계속)
    }
    registered.push(headword);
  }
  if (duplicates.length > 0) {
    notes.push(`중복 단어 ${duplicates.length}개 제외: ${duplicates.join(', ')}`);
  }
  const totalNewToday = alreadyAddedToday + registered.length;
  if (totalNewToday < maxNewWords) {
    notes.push(`신규 단어 ${totalNewToday}개(<${maxNewWords}) — 로그만 남기고 진행`);
  }
  for (const headword of registered) {
    wordsState.words[headword] = newWordEntry(date);
  }

  // --- 2) 오늘의 단어 최종 선별본 동결(selected.json) — build·verify의 렌더 기준 ---
  // 상태 기준(added_on === date)으로 만들므로 재실행해도 같은 내용이 재생성된다.
  const selectedSet = new Set(
    Object.entries(wordsState.words)
      .filter(([, w]) => w.added_on === date)
      .map(([h]) => h)
  );
  const emitted = new Set();
  const selectedWords = content.words.filter((w) => {
    const h = normalizeHeadword(w.headword);
    if (!selectedSet.has(h) || emitted.has(h)) return false;
    emitted.add(h);
    return true;
  });

  // --- 3) 원자적 쓰기: words.json → selected.json 성공 후에만 settled 마킹 ---
  writeJsonAtomic(rootPath('state', lang, 'words.json'), wordsState);
  writeJsonAtomic(rootPath('data', lang, date, 'selected.json'), {
    date,
    words: selectedWords,
  });

  const sha256 = createHash('sha256').update(rawContent).digest('hex');
  runlog.runs ??= {};
  runlog.runs[date] = {
    ...(runlog.runs[date] ?? {}),
    settled: true,
    settled_at: new Date().toISOString(),
    content_sha256: sha256,
    notes,
  };
  writeJsonAtomic(rootPath('state', lang, 'runlog.json'), runlog);

  console.log(
    `정산 완료(${lang}, ${date}): 신규 ${registered.length}개, 중복 제외 ${duplicates.length}개, 선별 ${selectedWords.length}개`
  );
  for (const n of notes) console.log(`- ${n}`);
}

main();
