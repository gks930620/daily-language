// auth.js — 구글 ID 토큰 검증과 우리 세션 토큰 발급/검증.
//
// 흐름:
//   1) 브라우저가 구글에서 받은 ID 토큰을 보낸다
//   2) 구글 공개키(JWKS)로 서명·발급처·대상(aud)·만료를 검증한다  ← 여기가 신원 확인의 전부
//   3) 검증되면 우리 세션 토큰을 발급한다(구글 토큰은 1시간짜리라 그대로 쓰면 매시간 재로그인)
//
// 비밀번호를 저장하지 않으므로 유출 사고의 반경이 작다.

import { createRemoteJWKSet, jwtVerify, SignJWT } from 'jose';
import { config } from './config.js';

/** 구글 공개키. jose가 캐시·갱신을 알아서 한다. */
const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

const sessionKey = () => new TextEncoder().encode(config.sessionSecret);

/**
 * 구글 ID 토큰 검증. 통과하면 { sub, email, name }을 돌려준다.
 * 실패하면 throw — 호출자는 401로 응답한다.
 */
export async function verifyGoogleIdToken(credential) {
  const { payload } = await jwtVerify(credential, GOOGLE_JWKS, {
    issuer: GOOGLE_ISSUERS,
    audience: config.googleClientId, // 다른 앱용으로 발급된 토큰을 거부하는 핵심 검사
  });
  if (!payload.sub) throw new Error('구글 토큰에 sub가 없습니다.');
  if (payload.email_verified === false) throw new Error('이메일이 확인되지 않은 구글 계정입니다.');
  return {
    sub: String(payload.sub),
    email: String(payload.email ?? ''),
    name: payload.name ? String(payload.name) : null,
  };
}

/** 우리 세션 토큰 발급. sub = 우리 DB의 사용자 id. */
export async function issueSession(userId) {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(userId))
    .setIssuedAt()
    .setExpirationTime(`${config.sessionDays}d`)
    .sign(sessionKey());
}

/**
 * Authorization 헤더에서 사용자 id를 꺼낸다. 실패하면 null.
 * **이 값만 신뢰한다** — 요청 본문에 담겨 온 user_id 같은 건 절대 쓰지 않는다.
 */
export async function userIdFromAuthHeader(header) {
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) return null;
  try {
    const { payload } = await jwtVerify(header.slice('Bearer '.length), sessionKey());
    const id = Number(payload.sub);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  } catch {
    return null; // 만료·위조 전부 여기로
  }
}
