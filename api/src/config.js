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

/**
 * DB 접속 정보. 두 가지 방식을 받는다 — 순수 함수라 테스트할 수 있다.
 *
 *   ① 항목별(권장): DB_HOST · DB_PORT · DB_USER · DB_PASSWORD · DB_NAME
 *      기존 Spring의 SPRING_DATASOURCE_USERNAME/PASSWORD와 같은 방식이고,
 *      **비밀번호에 @ : / ? 같은 문자가 있어도 안전하다**(URL 파싱을 거치지 않는다).
 *   ② 한 줄: DATABASE_URL = mysql://user:pass@host:port/db
 *      이미 이 형태로 갖고 있을 때만 쓴다.
 *
 * 둘 다 있으면 항목별이 이긴다.
 */
export function resolveDbConfig(env = process.env) {
  const pick = (name) => (env[name] ?? '').trim();

  if (pick('DB_HOST')) {
    const missing = ['DB_USER', 'DB_PASSWORD', 'DB_NAME'].filter((n) => !pick(n));
    if (missing.length > 0) {
      throw new Error(
        `DB_HOST를 넣었으면 ${missing.join(', ')}도 필요합니다. (Railway Variables 확인)`
      );
    }
    return {
      host: pick('DB_HOST'),
      port: Number(pick('DB_PORT') || '3306'),
      user: pick('DB_USER'),
      password: pick('DB_PASSWORD'),
      database: pick('DB_NAME'),
    };
  }

  if (pick('DATABASE_URL')) return { uri: pick('DATABASE_URL') };

  throw new Error(
    'DB 접속 정보가 없습니다. DB_HOST·DB_PORT·DB_USER·DB_PASSWORD·DB_NAME를 넣거나, ' +
      'DATABASE_URL 한 줄을 넣어 주세요.'
  );
}

/**
 * 세션을 어디에 보관할지.
 *
 *   cookie — HttpOnly 쿠키. JS가 읽을 수 없어 XSS에도 안 털린다. **가장 안전하다.**
 *            단, 프런트와 API가 **같은 사이트**여야 한다(예: study.example.com ↔ api.study.example.com).
 *   token  — 로그인 후 프런트로 토큰을 넘겨 localStorage에 보관. 어디서나 동작한다.
 *            github.io ↔ railway.app처럼 사이트가 다르면 쿠키가 Safari에서 차단되므로 이쪽을 쓴다.
 *
 * 나중에 도메인을 붙이면 이 값만 cookie로 바꾸면 된다(사용자·기록은 그대로).
 */
const authMode = optional('AUTH_MODE', 'token');
if (!['cookie', 'token'].includes(authMode)) {
  throw new Error(`AUTH_MODE는 cookie 또는 token이어야 합니다 (받은 값: ${authMode})`);
}

export const config = {
  port: Number(optional('PORT', '8080')),

  /** 구글 OAuth 클라이언트 ID·비밀번호. 비밀번호는 **서버에만** 둔다. */
  googleClientId: required('GOOGLE_CLIENT_ID'),
  googleClientSecret: required('GOOGLE_CLIENT_SECRET'),

  /**
   * 이 API가 밖에서 보이는 주소(예: https://xxx.up.railway.app).
   * 구글에 알려줄 redirect_uri를 만드는 데 쓴다 — 구글 콘솔에 등록한 값과 정확히 같아야 한다.
   */
  publicUrl: required('PUBLIC_URL').replace(/\/+$/, ''),

  /** 우리 세션 토큰 서명 키. 32자 이상 랜덤 문자열. 바뀌면 전원 로그아웃된다. */
  sessionSecret: required('SESSION_SECRET'),

  /** 세션 유효기간(일). */
  sessionDays: Number(optional('SESSION_DAYS', '30')),

  authMode,

  /** cookie 모드에서 쿠키를 공유할 도메인(예: .example.com). 비우면 API 호스트 전용. */
  cookieDomain: optional('COOKIE_DOMAIN', ''),

  /**
   * 콘텐츠 적재(POST /content) 전용 토큰. GitHub Actions만 안다.
   * **비워 두면 적재 엔드포인트가 아예 꺼진다**(설정 전 실수로 열리지 않게).
   * 세션 키와 따로 두는 이유: 용도가 다르고, 하나가 새어도 다른 쪽이 안 뚫린다.
   */
  ingestToken: optional('INGEST_TOKEN', ''),

  /** MySQL 접속 정보(항목별 또는 URL). */
  db: resolveDbConfig(),

  /**
   * 로그인 후 돌아갈 수 있는 사이트. 쉼표로 여러 개.
   * CORS 허용 목록이자 **리다이렉트 허용 목록**이다 — 여기 없는 주소로는 절대 되돌려 보내지 않는다
   * (열린 리다이렉트로 피싱에 쓰이는 것을 막는다).
   */
  allowedOrigins: optional('ALLOWED_ORIGINS', 'https://gks930620.github.io')
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean),
};

/** 로그인 후 구글이 돌아올 주소. 구글 콘솔의 "승인된 리디렉션 URI"와 같아야 한다. */
export const REDIRECT_URI = `${config.publicUrl}/auth/callback`;

/** 기록 가능한 트랙. scripts/lib/langs.js의 키와 같아야 한다(트랙을 늘리면 여기도 추가). */
export const TRACKS = ['en', 'ja-n1', 'ja-n2'];

/** 진도 단계. scripts/lib/studylog.js의 LEVELS 및 study_log.level ENUM과 같아야 한다. */
export const LEVELS = ['little', 'half', 'full'];
