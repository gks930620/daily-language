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

/**
 * POST /content 본문 검증.
 * 저장소의 scripts/lib/validate.js가 이미 엄격히 검사한 뒤 보내는 것이라
 * 여기서는 **적재에 필요한 최소한**만 본다(트랙·날짜·구조). 규칙을 두 벌 유지하면 어긋난다.
 */
export function validateContentBody(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'JSON 객체가 아닙니다.' };
  }
  const { track, date, content, selected } = body;
  if (!TRACKS.includes(track)) {
    return { ok: false, error: `track은 ${TRACKS.join(', ')} 중 하나여야 합니다.` };
  }
  if (!isValidDate(date)) {
    return { ok: false, error: 'date는 YYYY-MM-DD 형식의 실제 날짜여야 합니다.' };
  }
  if (content === null || typeof content !== 'object' || Array.isArray(content)) {
    return { ok: false, error: 'content가 JSON 객체가 아닙니다.' };
  }
  if (content.lang !== undefined && content.lang !== track) {
    return { ok: false, error: `content.lang(${content.lang})과 track(${track})이 다릅니다.` };
  }
  if (content.date !== undefined && content.date !== date) {
    return { ok: false, error: `content.date(${content.date})와 date(${date})가 다릅니다.` };
  }
  if (!Array.isArray(content.sentences) || !Array.isArray(content.words)) {
    return { ok: false, error: 'content에 sentences·words 배열이 필요합니다.' };
  }
  if (selected !== undefined && selected !== null) {
    if (typeof selected !== 'object' || !Array.isArray(selected.words)) {
      return { ok: false, error: 'selected가 있으면 words 배열을 가져야 합니다.' };
    }
  }
  return { ok: true, value: { track, date, content, selected: selected ?? null } };
}
