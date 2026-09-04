#!/usr/bin/env node
// publish.js — 생성된 하루치 콘텐츠를 진도 기록 API로 보내 MySQL에 적재한다.
//
// 왜 이 스크립트가 있나:
//   Spring 서버가 이 콘텐츠를 쓰려면 DB에 있어야 한다. 그런데 Spring을 깨우고 싶지 않고
//   (App Sleeping 중), GitHub Actions에 DB 비밀번호를 넣고 싶지도 않다.
//   그래서 이미 DB에 붙어 있는 api/ 서버에 HTTP로 넘긴다 — Spring은 전혀 관여하지 않는다.
//
// 원칙: **저장소가 원본, DB는 다시 만들 수 있는 사본.**
//   서버가 (track, date) 업서트로만 넣으므로 몇 번을 다시 보내도 결과가 같다.
//   그래서 --all로 전량 백필해도 안전하고, DB가 날아가도 저장소에서 복구된다.
//
// 이 스크립트가 실패해도 **학습 페이지 생성에는 영향이 없다**. 워크플로에서 마지막에,
// 실패를 삼키도록 붙인다(적재는 다음 날 백필로 따라잡을 수 있다).
//
// 사용법:
//   node scripts/publish.js --lang en                 오늘분(KST) 1건
//   node scripts/publish.js --lang en --date 2026-09-04
//   node scripts/publish.js --all                     전 트랙·전 날짜 백필
//   node scripts/publish.js --summary                 적재 현황만 확인
//
// 환경변수:
//   PUBLISH_URL    API 주소. 없으면 scripts/lib/site.js의 API_BASE를 쓴다.
//   INGEST_TOKEN   적재 토큰(필수). Actions 시크릿 → 워크플로 env로 전달.

import { readdirSync, existsSync } from 'node:fs';
import { resolveDate, isValidDateString } from './lib/dates.js';
import { rootPath, readJson } from './lib/store.js';
import { LANGS, resolveLang } from './lib/langs.js';
import { API_BASE } from './lib/site.js';

const argv = process.argv.slice(2);
const has = (flag) => argv.includes(flag);

const baseUrl = (process.env.PUBLISH_URL || API_BASE || '').replace(/\/+$/, '');
const token = (process.env.INGEST_TOKEN || '').trim();

function requireConfig() {
  if (!baseUrl) {
    console.error('에러: 보낼 주소가 없습니다. PUBLISH_URL 또는 scripts/lib/site.js의 API_BASE.');
    process.exit(1);
  }
  if (!token) {
    console.error('에러: INGEST_TOKEN이 없습니다. (Actions 시크릿 → 워크플로 env)');
    process.exit(1);
  }
}

/** data/<lang>/ 아래 날짜 폴더 중 content.json이 있는 것만. */
function listDates(lang) {
  const dir = rootPath('data', lang);
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter(
      (d) =>
        d.isDirectory() &&
        isValidDateString(d.name) &&
        existsSync(rootPath('data', lang, d.name, 'content.json'))
    )
    .map((d) => d.name)
    .sort();
}

/** 하루치 한 건 전송. 성공하면 true. */
async function publishOne(lang, date) {
  const content = readJson(rootPath('data', lang, date, 'content.json'));
  if (!content) {
    console.error(`  ✗ ${lang} ${date} — content.json 없음`);
    return false;
  }
  // selected.json은 settle이 만든 최종 선별본(페이지에 실제로 보이는 15개). 없으면 서버가 content.words를 쓴다.
  const selected = readJson(rootPath('data', lang, date, 'selected.json'));

  let res;
  try {
    res = await fetch(`${baseUrl}/content`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ track: lang, date, content, selected }),
    });
  } catch (err) {
    console.error(`  ✗ ${lang} ${date} — 연결 실패: ${err.message}`);
    return false;
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error(`  ✗ ${lang} ${date} — HTTP ${res.status} ${detail.slice(0, 160)}`);
    return false;
  }
  const body = await res.json().catch(() => ({}));
  console.log(`  ✓ ${lang} ${date} — 단어 ${body.words ?? '?'}개`);
  return true;
}

async function showSummary() {
  const res = await fetch(`${baseUrl}/content/summary`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    console.error(`적재 현황 조회 실패: HTTP ${res.status}`);
    process.exit(1);
  }
  const { tracks } = await res.json();
  if (!tracks?.length) {
    console.log('적재된 콘텐츠가 없습니다.');
    return;
  }
  console.log('적재 현황:');
  for (const t of tracks) {
    console.log(
      `  ${String(t.track).padEnd(7)} ${t.days}일  ${t.first_date} ~ ${t.last_date}  단어 ${t.words}개`
    );
  }
}

async function main() {
  requireConfig();

  if (has('--summary')) return showSummary();

  const jobs = [];
  if (has('--all')) {
    for (const lang of Object.keys(LANGS)) {
      for (const date of listDates(lang)) jobs.push([lang, date]);
    }
    console.log(`전량 백필: ${jobs.length}건 → ${baseUrl}`);
  } else {
    const lang = resolveLang(argv);
    const date = resolveDate(argv);
    jobs.push([lang, date]);
    console.log(`적재: ${lang} ${date} → ${baseUrl}`);
  }

  let ok = 0;
  for (const [lang, date] of jobs) {
    if (await publishOne(lang, date)) ok++;
  }

  const failed = jobs.length - ok;
  console.log(`완료: 성공 ${ok}건${failed ? `, 실패 ${failed}건` : ''}`);
  if (failed > 0) process.exit(1);
}

main();
