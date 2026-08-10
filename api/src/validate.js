// validate.js — 요청 본문 검증. 순수 함수(테스트 가능), 실패하면 이유 문자열을 돌려준다.

import { TRACKS, LEVELS } from './config.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** "YYYY-MM-DD"이면서 실제 존재하는 날짜인가. (scripts/lib/dates.js와 같은 규칙) */
export function isValidDate(s) {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/**
 * PUT /study 본문 검증.
 * 통과하면 { ok: true, value }, 실패하면 { ok: false, error }.
 */
export function validateStudyBody(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'JSON 객체가 아닙니다.' };
  }
  const { date, track, level } = body;
  if (!isValidDate(date)) {
    return { ok: false, error: 'date는 YYYY-MM-DD 형식의 실제 날짜여야 합니다.' };
  }
  if (!TRACKS.includes(track)) {
    return { ok: false, error: `track은 ${TRACKS.join(', ')} 중 하나여야 합니다.` };
  }
  if (!LEVELS.includes(level)) {
    return { ok: false, error: `level은 ${LEVELS.join(', ')} 중 하나여야 합니다.` };
  }
  return { ok: true, value: { date, track, level } };
}
