// auth.js — 구글 OAuth 2.0 (Authorization Code + PKCE)와 우리 세션 토큰.
//
// 흐름 (전부 서버가 주도한다 — 브라우저는 구글 SDK를 쓰지 않는다):
//   1) /auth/start    state·PKCE 생성 → 짧은 수명의 서명 쿠키에 담고 구글로 보낸다
//   2) 구글 로그인
//   3) /auth/callback code + client_secret + code_verifier로 토큰 교환(서버↔구글 직접)
//   4) 받은 id_token을 구글 공개키로 검증 → 사용자 등록 → 우리 세션 발급
//
// client_secret은 서버에만 있고 브라우저로 나가지 않는다.
// PKCE는 secret이 있어도 같이 쓴다 — code가 새어도 verifier 없이는 못 쓰기 때문(방어 이중화).

import { createHash, randomBytes } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify, SignJWT } from 'jose';
import { config, REDIRECT_URI } from './config.js';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

/** 구글 공개키. jose가 캐시·갱신을 알아서 한다. */
const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

const key = () => new TextEncoder().encode(config.sessionSecret);
const b64url = (buf) => buf.toString('base64url');

// ---------------------------------------------------------------- 로그인 시작

/**
 * 로그인 거래(transaction) 하나를 만든다.
 * 반환: { url, tx } — url로 보내고, tx는 쿠키에 담아 콜백에서 대조한다.
 *
 * returnTo는 **호출자가 이미 허용 목록으로 검증한 값**이어야 한다(열린 리다이렉트 방지).
 */
export async function startLogin(returnTo) {
  const state = b64url(randomBytes(16));
  const codeVerifier = b64url(randomBytes(32));
  const codeChallenge = b64url(createHash('sha256').update(codeVerifier).digest());

  const url = new URL(GOOGLE_AUTH_URL);
  url.search = new URLSearchParams({
    client_id: config.googleClientId,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    // 계정 선택 화면을 항상 보여 준다(여러 구글 계정을 쓰는 사람 배려).
    prompt: 'select_account',
  }).toString();

  // 거래 정보는 서버 메모리가 아니라 **서명된 짧은 쿠키**에 둔다.
  // 인스턴스가 재시작되거나 여러 개여도 로그인이 깨지지 않는다.
  const tx = await new SignJWT({ state, codeVerifier, returnTo })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('10m')
    .sign(key());

  return { url: url.toString(), tx };
}

/** 거래 쿠키를 검증하고 state가 일치하는지 확인한다. 실패하면 throw(CSRF 차단). */
export async function verifyTx(txCookie, stateFromQuery) {
  if (!txCookie) throw new Error('로그인 거래 정보가 없습니다(쿠키 만료 또는 차단).');
  const { payload } = await jwtVerify(txCookie, key());
  if (!payload.state || payload.state !== stateFromQuery) {
    throw new Error('state가 일치하지 않습니다.');
  }
  return { codeVerifier: String(payload.codeVerifier), returnTo: String(payload.returnTo) };
}

// ---------------------------------------------------------------- 토큰 교환

/**
 * code를 구글 토큰으로 바꾸고, 안에 든 id_token을 검증한다.
 * 반환: { sub, email, name }
 */
export async function exchangeCode(code, codeVerifier) {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.googleClientId,
      client_secret: config.googleClientSecret, // 서버에서만 쓰인다
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
      code_verifier: codeVerifier,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`구글 토큰 교환 실패 (${res.status}): ${detail.slice(0, 200)}`);
  }
  const tokens = await res.json();
  if (!tokens.id_token) throw new Error('구글 응답에 id_token이 없습니다.');
  return verifyGoogleIdToken(tokens.id_token);
}

/** 구글 ID 토큰 검증. 서명·발급처·대상(aud)·만료를 모두 확인한다. */
export async function verifyGoogleIdToken(idToken) {
  const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
    issuer: GOOGLE_ISSUERS,
    audience: config.googleClientId, // 다른 앱용 토큰을 거부하는 핵심 검사
  });
  if (!payload.sub) throw new Error('구글 토큰에 sub가 없습니다.');
  if (payload.email_verified === false) throw new Error('이메일이 확인되지 않은 구글 계정입니다.');
  return {
    sub: String(payload.sub),
    email: String(payload.email ?? ''),
    name: payload.name ? String(payload.name) : null,
  };
}

// ---------------------------------------------------------------- 우리 세션

/** 우리 세션 토큰 발급. sub = 우리 DB의 사용자 id. */
export async function issueSession(userId) {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(userId))
    .setIssuedAt()
    .setExpirationTime(`${config.sessionDays}d`)
    .sign(key());
}

async function userIdFromToken(token) {
  try {
    const { payload } = await jwtVerify(token, key());
    const id = Number(payload.sub);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  } catch {
    return null; // 만료·위조 전부 여기로
  }
}

/**
 * 요청에서 사용자 id를 꺼낸다. 쿠키(cookie 모드)와 Authorization 헤더(token 모드) 둘 다 받는다.
 * **이 값만 신뢰한다** — 요청 본문에 담겨 온 user_id 같은 건 절대 쓰지 않는다.
 */
export async function userIdFromRequest({ sessionCookie, authorizationHeader }) {
  if (sessionCookie) {
    const id = await userIdFromToken(sessionCookie);
    if (id) return id;
  }
  if (typeof authorizationHeader === 'string' && authorizationHeader.startsWith('Bearer ')) {
    return userIdFromToken(authorizationHeader.slice('Bearer '.length));
  }
  return null;
}

/**
 * 돌아갈 주소가 허용 목록 안인지 검사한다. 아니면 null.
 * 이 검사가 없으면 로그인 링크가 아무 사이트로나 되돌려 보내는 피싱 도구가 된다.
 */
export function safeReturnTo(raw) {
  const fallback = `${config.allowedOrigins[0]}/`;
  if (!raw) return fallback;
  let url;
  try {
    url = new URL(raw);
  } catch {
    return fallback;
  }
  return config.allowedOrigins.includes(url.origin) ? url.toString() : fallback;
}
