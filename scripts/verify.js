#!/usr/bin/env node
// verify.js — 오늘(또는 --date)분 산출물이 온전한지 마지막으로 점검한다.
// 실패 항목을 전부 나열하고 exit 1. 커밋 전 최종 게이트.

import { readFileSync, existsSync } from 'node:fs';
import { resolveDate } from './lib/dates.js';
import { rootPath, readJson, readRunlog } from './lib/store.js';

function countOccurrences(haystack, needle) {
  let count = 0;
  let idx = 0;
  while ((idx = haystack.indexOf(needle, idx)) !== -1) {
    count++;
    idx += needle.length;
  }
  return count;
}

function main() {
  const date = resolveDate(process.argv.slice(2));
  const failures = [];

  // 1) runlog: 오늘분 settled 확인
  const runlog = readRunlog();
  if (!runlog.runs?.[date]?.settled) {
    failures.push(`runlog: ${date}가 settled 상태가 아님`);
  }

  // 2) 입력 파일 존재
  const contentPath = rootPath('data', date, 'content.json');
  const reviewPath = rootPath('data', date, 'review.json');
  const content = readJson(contentPath);
  const review = readJson(reviewPath);
  const selected = readJson(rootPath('data', date, 'selected.json'));
  if (!content) failures.push(`data/${date}/content.json 없음 또는 파싱 불가`);
  if (!review) failures.push(`data/${date}/review.json 없음 또는 파싱 불가`);
  if (!selected) failures.push(`data/${date}/selected.json 없음 또는 파싱 불가 (settle 미실행?)`);

  // 페이지의 "오늘의 단어" 기준: selected.json(없는 과거 데이터만 content.words 폴백)
  const expectedWords = Array.isArray(selected?.words)
    ? selected.words.length
    : content?.words?.length ?? 0;

  // 3) HTML 존재 + 개수 일치
  const dayPath = rootPath('docs', 'days', `${date}.html`);
  const indexPath = rootPath('docs', 'index.html');
  if (!existsSync(indexPath)) failures.push('docs/index.html 없음');
  if (!existsSync(dayPath)) {
    failures.push(`docs/days/${date}.html 없음`);
  } else if (content && review) {
    const html = readFileSync(dayPath, 'utf8');
    const sentenceCount = countOccurrences(html, '<li class="sentence">');
    const wordCount = countOccurrences(html, '<tr class="word-row">');
    const quizCount = countOccurrences(html, '<li class="quiz-item">');
    if (sentenceCount !== 5) {
      failures.push(`문장 개수 불일치: HTML ${sentenceCount}개 (기대: 5개)`);
    }
    if (wordCount !== expectedWords) {
      failures.push(
        `단어 개수 불일치: HTML ${wordCount}개 (기대: ${selected ? 'selected.json' : 'content.json'} ${expectedWords}개)`
      );
    }
    const expectedQuiz = (review.due_words ?? []).length;
    if (quizCount !== expectedQuiz) {
      failures.push(
        `퀴즈 개수 불일치: HTML ${quizCount}개 (기대: review.json due ${expectedQuiz}개)`
      );
    }
  }

  if (failures.length > 0) {
    console.error(`검증 실패(${date}) — ${failures.length}건:`);
    for (const f of failures) console.error(`- ${f}`);
    process.exit(1);
  }
  console.log(
    `검증 통과(${date}): 문장 5, 단어 ${expectedWords}, 퀴즈 ${(review.due_words ?? []).length}, settled OK`
  );
}

main();
