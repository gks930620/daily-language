#!/usr/bin/env node
// prepare.js — 하루의 시작. AI 입력(brief.json)과 오늘 퀴즈 동결본(review.json)을 만든다.
// state/<lang>/words.json은 읽기만 한다. runlog에는 prepared_at만 기록한다.

import { readdirSync, existsSync } from 'node:fs';
import { resolveDate, addDays, isValidDateString } from './lib/dates.js';
import {
  rootPath,
  readJson,
  writeJsonAtomic,
  readWordsState,
  readRunlog,
} from './lib/store.js';
import { LANGS, resolveLang } from './lib/langs.js';
import { selectDueWords } from './lib/srs.js';

// 언어 중립 상수(언어별 값은 scripts/lib/langs.js가 단일 소스).
const KNOWN_WORDS_FULL_LIMIT = 3000; // 이하면 전체 전달
const KNOWN_WORDS_RECENT_LIMIT = 1000; // 초과 시 최근 추가분만
const TOPIC_LOOKBACK_DAYS = 14;
const REVIEW_SENTENCE_WINDOW = { from: 10, to: 3 }; // D-10 ~ D-3

/** 날짜 문자열용 결정적 해시(FNV-1a 32bit). */
function hashString(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** data/<lang>/ 아래 날짜 폴더 목록(정렬). */
function listDataDates(lang) {
  const dataDir = rootPath('data', lang);
  if (!existsSync(dataDir)) return [];
  return readdirSync(dataDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && isValidDateString(d.name))
    .map((d) => d.name)
    .sort();
}

function collectKnownWords(wordsState) {
  const entries = Object.entries(wordsState.words ?? {});
  if (entries.length <= KNOWN_WORDS_FULL_LIMIT) {
    return entries.map(([headword]) => headword).sort();
  }
  // 3,000개 초과: 최근 추가된 1,000개만 (added_on 내림차순 → headword로 안정 정렬)
  return entries
    .sort((a, b) => {
      const d = (b[1].added_on ?? '').localeCompare(a[1].added_on ?? '');
      return d !== 0 ? d : a[0].localeCompare(b[0]);
    })
    .slice(0, KNOWN_WORDS_RECENT_LIMIT)
    .map(([headword]) => headword)
    .sort();
}

function collectRecentTopics(lang, today) {
  const from = addDays(today, -TOPIC_LOOKBACK_DAYS);
  const topics = [];
  for (const date of listDataDates(lang)) {
    if (date < from || date >= today) continue;
    const content = readJson(rootPath('data', lang, date, 'content.json'));
    const topic = content?.conversation?.topic;
    if (typeof topic === 'string' && topic.trim() && !topics.includes(topic)) {
      topics.push(topic);
    }
  }
  return topics;
}

/** D-10~D-3 창의 과거 문장 풀에서 날짜 해시로 1개 결정적 선택. 없으면 null. */
function pickReviewSentence(lang, today) {
  const from = addDays(today, -REVIEW_SENTENCE_WINDOW.from);
  const to = addDays(today, -REVIEW_SENTENCE_WINDOW.to);
  const pool = [];
  for (const date of listDataDates(lang)) {
    if (date < from || date > to) continue;
    const content = readJson(rootPath('data', lang, date, 'content.json'));
    if (!Array.isArray(content?.sentences)) continue;
    for (const s of content.sentences) {
      pool.push({
        from_date: date,
        en: s.en,
        ...(s.reading ? { reading: s.reading } : {}),
        ko: s.ko,
        structure: s.structure,
      });
    }
  }
  if (pool.length === 0) return null;
  return pool[hashString(today) % pool.length];
}

function main() {
  const argv = process.argv.slice(2);
  const lang = resolveLang(argv);
  const config = LANGS[lang];
  const date = resolveDate(argv);
  const runlog = readRunlog(lang);

  if (runlog.runs?.[date]?.settled) {
    console.log('ALREADY_DONE');
    console.log(`DATE=${date}`);
    console.log(`오늘(${date})분 ${config.label}은 이미 정산 완료. 아무것도 하지 않음.`);
    return;
  }

  const wordsState = readWordsState(lang);
  const dueWords = selectDueWords(wordsState, date);

  const review = {
    date,
    due_words: dueWords,
    review_sentence: pickReviewSentence(lang, date),
  };

  const brief = {
    date,
    learner_profile: config.learnerProfile,
    new_word_candidates_requested: config.newWordCandidates,
    known_words: collectKnownWords(wordsState),
    recent_conversation_topics: collectRecentTopics(lang, date),
  };

  const briefPath = rootPath('data', lang, date, 'brief.json');
  const reviewPath = rootPath('data', lang, date, 'review.json');
  writeJsonAtomic(reviewPath, review);
  writeJsonAtomic(briefPath, brief);

  // runlog에는 prepared_at만 기록(단어 상태 words.json은 settle만 쓴다).
  runlog.runs ??= {};
  runlog.runs[date] = {
    ...(runlog.runs[date] ?? {}),
    prepared_at: new Date().toISOString(),
    settled: runlog.runs[date]?.settled ?? false,
  };
  writeJsonAtomic(rootPath('state', lang, 'runlog.json'), runlog);

  console.log(`DATE=${date}`);
  console.log(`LANG=${lang}`);
  console.log(`NODE=${process.version}`);
  console.log(`BRIEF=${briefPath}`);
  console.log(`REVIEW=${reviewPath}`);
  console.log(
    `복습 예정 단어 ${dueWords.length}개, known_words ${brief.known_words.length}개, 최근 회화 주제 ${brief.recent_conversation_topics.length}개, 복습 문장 ${review.review_sentence ? '1개' : '없음'}`
  );
  console.log(
    `다음 단계: ${config.promptFile} 지침대로 data/${lang}/${date}/content.json 작성 후 settle.js --lang ${lang} 실행`
  );
}

main();
