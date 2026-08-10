// config.js — 환경변수 읽기와 검증. 값이 빠졌으면 **시작할 때** 죽는다(요청 받고 나서 죽지 않게).
//
// 비밀값은 전부 Railway 환경변수에만 있다. 저장소에도, 브라우저에도 들어가지 않는다.

function required(name) {
  const v = process.env[name];
  if (!v || !v.trim()) {
    throw new Error(
      `환경변수 ${name}이(가) 없습니다. Railway 서비스의 Variables에 넣어 주세요.`
    );
  }
  return v.trim();
}

function optional(name, fallback) {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : fallback;
}

export const config = {
  port: Number(optional('PORT', '8080')),

  /** 구글 OAuth 클라이언트 ID — 브라우저와 서버가 같은 값을 써야 한다(aud 검증). */
  googleClientId: required('GOOGLE_CLIENT_ID'),

  /** 우리 세션 토큰 서명 키. 32자 이상 랜덤 문자열. 바뀌면 전원 로그아웃된다. */
  sessionSecret: required('SESSION_SECRET'),

  /** 세션 유효기간(일). 구글 ID 토큰은 1시간이지만 우리 토큰은 우리가 정한다. */
  sessionDays: Number(optional('SESSION_DAYS', '30')),

  /** mysql://user:pass@host:port/db — Railway MySQL이 주는 값. */
  databaseUrl: required('DATABASE_URL'),

  /**
   * 요청을 허용할 출처. 쉼표로 여러 개.
   * 여기 없는 사이트에서 부르면 브라우저가 막는다.
   */
  allowedOrigins: optional('ALLOWED_ORIGINS', 'https://gks930620.github.io')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
};

/** 기록 가능한 트랙. scripts/lib/langs.js의 키와 같아야 한다(트랙을 늘리면 여기도 추가). */
export const TRACKS = ['en', 'ja-n1', 'ja-n2'];

/** 진도 단계. scripts/lib/studylog.js의 LEVELS 및 study_log.level ENUM과 같아야 한다. */
export const LEVELS = ['little', 'half', 'full'];
