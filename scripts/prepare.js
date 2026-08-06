#!/usr/bin/env node
// prepare.js — 하루의 시작. AI 입력(brief.json)을 만든다.
// state/<lang>/words.json은 읽기만 한다. runlog에는 prepared_at만 기록한다.

import { resolveDate } from './lib/dates.js';
import {
  rootPath,
  writeJsonAtomic,
  readWordsState,
  readRunlog,
} from './lib/store.js';
import { LANGS, resolveLang } from './lib/langs.js';

// 언어 중립 상수(언어별 값은 scripts/lib/langs.js가 단일 소스).
const KNOWN_WORDS_FULL_LIMIT = 3000; // 이하면 전체 전달
const KNOWN_WORDS_RECENT_LIMIT = 1000; // 초과 시 최근 추가분만

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

  const brief = {
    date,
    learner_profile: config.learnerProfile,
    new_word_candidates_requested: config.newWordCandidates,
    known_words: collectKnownWords(wordsState),
  };

  const briefPath = rootPath('data', lang, date, 'brief.json');
  writeJsonAtomic(briefPath, brief);

  // runlog에는 prepared_at만 기록(단어 장부 words.json은 settle만 쓴다).
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
  console.log(`이미 학습한 단어(known_words) ${brief.known_words.length}개 전달`);
  console.log(
    `다음 단계: ${config.promptFile} 지침대로 data/${lang}/${date}/content.json 작성 후 settle.js --lang ${lang} 실행`
  );
}

main();
