// site.js — 저장소·사이트 수준 설정의 단일 소스(트랙별 설정은 langs.js가 따로 갖는다).

/** GitHub 저장소 "owner/name". */
export const REPO = 'gks930620/daily-language';

/**
 * 진도 기록 API의 주소(Railway). 끝에 `/` 없이.
 *
 * **비어 있으면 진도 기록 기능이 꺼진 상태로 렌더된다** — 학습 콘텐츠는 그대로 보이고,
 * 진도 영역에만 "설정이 아직 안 끝났습니다" 안내가 나온다.
 * 설정을 마치면(SETUP.md) 여기에 주소를 넣고 `node scripts/build.js`만 다시 돌리면 켜진다.
 *
 * 예: 'https://daily-language-api.up.railway.app'
 */
export const API_BASE = '';

/** 진도 기록 기능을 켤 수 있는 상태인가. */
export function apiConfigured() {
  return typeof API_BASE === 'string' && API_BASE.trim().length > 0;
}
