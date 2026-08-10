// site.js — 저장소·사이트 수준 상수의 단일 소스(트랙별 설정은 langs.js가 따로 갖는다).

/** GitHub 저장소 "owner/name". 공부 진도 체크인 이슈 링크를 만드는 데 쓴다. */
export const REPO = 'gks930620/daily-language';

/**
 * 진도 체크인 이슈 제목 형식. checkin 워크플로가 이 형식만 받아들인다.
 * 예: "study: 2026-08-06 en full"
 */
export function checkinTitle(date, lang, level) {
  return `study: ${date} ${lang} ${level}`;
}

/**
 * 진도 버튼이 여는 GitHub 새 이슈 URL(제목이 미리 채워진다).
 * 사용자는 GitHub 화면에서 Submit만 누르면 되고, 기록·재빌드는 워크플로가 한다.
 */
export function checkinUrl(date, lang, level) {
  return `https://github.com/${REPO}/issues/new?title=${encodeURIComponent(
    checkinTitle(date, lang, level)
  )}`;
}
