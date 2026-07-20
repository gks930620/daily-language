// store.js — JSON 파일의 안전한 읽기/쓰기.
// 쓰기는 항상 원자적(tmp 파일에 쓴 뒤 rename)으로 수행한다.

import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** 저장소 루트 절대 경로 (scripts/lib/ 기준 두 단계 위). */
export const ROOT = fileURLToPath(new URL('../..', import.meta.url));

/** 루트 기준 상대 경로를 절대 경로로. */
export function rootPath(...segments) {
  return join(ROOT, ...segments);
}

/** JSON 파일을 읽는다. 없으면 fallback을 돌려준다(기본 null). */
export function readJson(filePath, fallback = null) {
  if (!existsSync(filePath)) return fallback;
  const raw = readFileSync(filePath, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`JSON 파싱 실패: ${filePath} — ${err.message}`);
  }
}

/** JSON을 원자적으로 쓴다: <path>.tmp에 쓰고 rename. 디렉터리는 자동 생성. */
export function writeJsonAtomic(filePath, data) {
  mkdirSync(dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', 'utf8');
  renameSync(tmp, filePath);
}

/** 텍스트 파일을 원자적으로 쓴다(HTML 빌드용). */
export function writeTextAtomic(filePath, text) {
  mkdirSync(dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp`;
  writeFileSync(tmp, text, 'utf8');
  renameSync(tmp, filePath);
}

/** state/words.json의 초기(빈) 구조. */
export function emptyWordsState() {
  return {
    schema_version: 1,
    intervals: [1, 3, 7, 14, 30, 60],
    words: {},
  };
}

/** state/runlog.json의 초기(빈) 구조. */
export function emptyRunlog() {
  return { schema_version: 1, runs: {} };
}

/** state/words.json 읽기(없으면 빈 구조). */
export function readWordsState() {
  return readJson(rootPath('state', 'words.json'), emptyWordsState());
}

/** state/runlog.json 읽기(없으면 빈 구조). */
export function readRunlog() {
  return readJson(rootPath('state', 'runlog.json'), emptyRunlog());
}
