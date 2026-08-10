#!/usr/bin/env node
// checkin.js — 공부 진도 기록. state/study-log.json을 쓰는 유일한 스크립트.
// 사용법: node scripts/checkin.js --lang en --level full [--date 2026-08-06]
//
// checkin 워크플로가 이슈 제목("study: <날짜> <트랙> <단계>")을 파싱해 이 명령을 부른다.
// 멱등: 같은 값으로 여러 번 돌려도 결과가 같고, 바뀐 게 없으면 NO_CHANGE를 찍는다.

import { existsSync } from 'node:fs';
import { resolveDate } from './lib/dates.js';
import { rootPath, readJson, writeJsonAtomic } from './lib/store.js';
import { LANGS, resolveLang } from './lib/langs.js';
import {
  emptyStudyLog,
  recordStudy,
  levelOf,
  isLevel,
  LEVELS,
} from './lib/studylog.js';

const LOG_PATH = rootPath('state', 'study-log.json');

function resolveLevel(argv) {
  const idx = argv.indexOf('--level');
  const value =
    idx !== -1
      ? argv[idx + 1]
      : argv.find((a) => a.startsWith('--level='))?.slice('--level='.length);
  if (!isLevel(value)) {
    throw new Error(
      `--level 값이 잘못됨: ${JSON.stringify(value)} (가능: ${Object.keys(LEVELS).join(', ')})`
    );
  }
  return value;
}

function main() {
  const argv = process.argv.slice(2);
  // 인자 오류는 스택 트레이스 대신 한 줄로 — 이 출력이 그대로 이슈 댓글이 된다.
  let lang, level, date;
  try {
    lang = resolveLang(argv);
    level = resolveLevel(argv);
    date = resolveDate(argv);
  } catch (err) {
    console.error(`에러: ${err.message}`);
    process.exit(1);
  }

  // 콘텐츠가 없는 날은 기록하지 않는다 — 분모에 없는 날을 기록하면 통계가 어긋난다.
  if (!existsSync(rootPath('data', lang, date, 'content.json'))) {
    console.error(
      `에러: data/${lang}/${date}/content.json 없음 — 그날 그 트랙 콘텐츠가 없어 기록할 수 없다.`
    );
    process.exit(1);
  }

  const log = readJson(LOG_PATH, emptyStudyLog());
  const before = levelOf(log, date, lang);
  if (before === level) {
    console.log('NO_CHANGE');
    console.log(`이미 같은 기록(${lang}, ${date}, ${LEVELS[level].label}) — 변경 없음.`);
    return;
  }

  writeJsonAtomic(LOG_PATH, recordStudy(log, date, lang, level));
  console.log(
    `기록 완료: ${LANGS[lang].label} ${date} — ${LEVELS[level].label}` +
      (before ? ` (이전: ${LEVELS[before].label} → 덮어씀)` : '')
  );
}

main();
