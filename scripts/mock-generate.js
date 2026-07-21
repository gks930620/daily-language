#!/usr/bin/env node
// mock-generate.js — AI(generate 단계) 대역. 로컬 시뮬레이션 전용. --lang 필수.
// 언어별 픽스처(fixtures/sample-content.<lang>.json)의 {{DATE}}를 치환해
// data/<lang>/<날짜>/content.json을 만든다.
// --unique: headword에 날짜 접미사를 붙여 다일(多日) 시뮬레이션에서 중복을 피한다.

import { readFileSync } from 'node:fs';
import { resolveDate } from './lib/dates.js';
import { rootPath, writeJsonAtomic } from './lib/store.js';
import { LANGS, resolveLang } from './lib/langs.js';

function main() {
  const argv = process.argv.slice(2);
  const lang = resolveLang(argv);
  const config = LANGS[lang];
  const date = resolveDate(argv);
  const unique = argv.includes('--unique');

  const raw = readFileSync(rootPath(config.fixtureFile), 'utf8');
  const content = JSON.parse(raw.replaceAll('{{DATE}}', date));

  if (unique) {
    const suffix = date.replaceAll('-', '');
    for (const w of content.words) {
      w.headword = `${w.headword}-${suffix}`;
    }
  }

  const outPath = rootPath('data', lang, date, 'content.json');
  writeJsonAtomic(outPath, content);
  console.log(`목 콘텐츠 생성: ${outPath}${unique ? ' (--unique)' : ''}`);
}

main();
