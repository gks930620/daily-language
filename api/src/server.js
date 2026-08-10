#!/usr/bin/env node
// server.js — 진도 기록 API. 구글 OAuth(서버 주도) + 진도 저장.
//
//   GET  /health        살아 있는지 (Railway 헬스체크용)
//   GET  /auth/start    구글 로그인 시작 → 구글로 리다이렉트
//   GET  /auth/callback 구글이 돌아오는 곳 → 세션 발급 → 원래 페이지로 리다이렉트
//   POST /auth/logout   세션 해제
//   GET  /auth/me       내가 누구인지 (로그인 상태 확인)
//   PUT  /study         진도 1건 기록 (로그인 필요)
//   GET  /study/me      내 기록 전부 (로그인 필요)
//
// 웹 프레임워크를 쓰지 않는다 — 경로가 7개뿐이라 node:http로 충분하고,
// 이 저장소의 "의존성은 꼭 필요한 것만" 기조를 API에도 유지한다.
// 의존성은 둘뿐: mysql2(프로토콜 구현은 직접 못 한다), jose(JWT 검증은 직접 짜면 위험하다).

import { createServer } from 'node:http';
import { config } from './config.js';
import { ping, upsertUser, recordStudy, listStudy, findUser } from './db.js';
import {
  startLogin,
  verifyTx,
  exchangeCode,
  issueSession,
  userIdFromRequest,
  safeReturnTo,
} from './auth.js';
import { readCookie, serializeCookie, clearCookie } from './cookies.js';
import { validateStudyBody } from './validate.js';

const MAX_BODY_BYTES = 16 * 1024; // 이 API가 받는 것은 작은 JSON뿐
const TX_COOKIE = 'dl_tx'; // 로그인 진행 중에만 쓰는 임시 쿠키
const SESSION_COOKIE = 'dl_session';

function corsHeaders(origin) {
  if (!origin || !config.allowedOrigins.includes(origin)) return {};
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET, PUT, POST, OPTIONS',
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-allow-credentials': 'true', // cookie 모드에서 세션 쿠키를 주고받으려면 필요
    'access-control-max-age': '86400',
    vary: 'Origin',
  };
}

function send(res, status, payload, origin, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
    ...corsHeaders(origin),
    ...extraHeaders,
  });
  res.end(body);
}

function redirect(res, location, extraHeaders = {}) {
  res.writeHead(302, { location, 'cache-control': 'no-store', ...extraHeaders });
  res.end();
}

/** 로그인 실패를 사용자에게 보여 줄 페이지로 되돌린다(에러 사유는 로그에만 남긴다). */
function redirectWithError(res, returnTo, extraHeaders = {}) {
  const url = new URL(returnTo);
  url.searchParams.set('login', 'failed');
  redirect(res, url.toString(), extraHeaders);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('본문이 너무 큽니다.'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      if (chunks.length === 0) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new Error('JSON 파싱 실패'));
      }
    });
    req.on('error', reject);
  });
}

function currentUserId(req) {
  return userIdFromRequest({
    sessionCookie: readCookie(req.headers.cookie, SESSION_COOKIE),
    authorizationHeader: req.headers.authorization,
  });
}

async function requireUser(req, res, origin) {
  const userId = await currentUserId(req);
  if (!userId) {
    send(res, 401, { error: '로그인이 필요합니다.' }, origin);
    return null;
  }
  return userId;
}

async function handle(req, res) {
  const origin = req.headers.origin;
  const url = new URL(req.url, config.publicUrl);
  const path = url.pathname.replace(/\/+$/, '') || '/';

  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders(origin));
    res.end();
    return;
  }

  if (req.method === 'GET' && path === '/health') {
    try {
      await ping();
      send(res, 200, { ok: true, authMode: config.authMode }, origin);
    } catch (err) {
      send(res, 503, { ok: false, error: `DB 연결 실패: ${err.message}` }, origin);
    }
    return;
  }

  // ---------------------------------------------------------------- 로그인 시작
  if (req.method === 'GET' && path === '/auth/start') {
    const returnTo = safeReturnTo(url.searchParams.get('return'));
    const { url: googleUrl, tx } = await startLogin(returnTo);
    // 거래 쿠키는 이 API 도메인의 1st-party 쿠키다. 구글에서 돌아오는 것은 top-level 이동이라
    // SameSite=Lax로도 함께 전송된다 — 프런트가 다른 사이트여도 로그인 자체는 문제없다.
    return redirect(res, googleUrl, {
      'set-cookie': serializeCookie(TX_COOKIE, tx, { maxAge: 600, sameSite: 'Lax' }),
    });
  }

  // ---------------------------------------------------------------- 구글이 돌아오는 곳
  if (req.method === 'GET' && path === '/auth/callback') {
    const clearTx = clearCookie(TX_COOKIE);
    const fallbackReturn = safeReturnTo(null);

    if (url.searchParams.get('error')) {
      console.warn('구글 로그인 거부:', url.searchParams.get('error'));
      return redirectWithError(res, fallbackReturn, { 'set-cookie': clearTx });
    }

    let returnTo = fallbackReturn;
    try {
      const tx = await verifyTx(
        readCookie(req.headers.cookie, TX_COOKIE),
        url.searchParams.get('state')
      );
      returnTo = safeReturnTo(tx.returnTo);
      const code = url.searchParams.get('code');
      if (!code) throw new Error('code가 없습니다.');

      const profile = await exchangeCode(code, tx.codeVerifier);
      const userId = await upsertUser(profile);
      const session = await issueSession(userId);

      if (config.authMode === 'cookie') {
        // 가장 안전한 경로 — 토큰이 JS에 노출되지 않는다. 같은 사이트일 때만 쓴다.
        return redirect(res, returnTo, {
          'set-cookie': [
            clearTx,
            serializeCookie(SESSION_COOKIE, session, {
              maxAge: config.sessionDays * 24 * 60 * 60,
              domain: config.cookieDomain || undefined,
              sameSite: 'Lax',
            }),
          ],
        });
      }

      // token 모드 — 프래그먼트(#)로 넘긴다. 프래그먼트는 서버 로그·Referer에 남지 않는다.
      const target = new URL(returnTo);
      target.hash = `token=${encodeURIComponent(session)}`;
      return redirect(res, target.toString(), { 'set-cookie': clearTx });
    } catch (err) {
      console.warn('로그인 콜백 실패:', err.message);
      return redirectWithError(res, returnTo, { 'set-cookie': clearTx });
    }
  }

  // ---------------------------------------------------------------- 로그아웃
  if (req.method === 'POST' && path === '/auth/logout') {
    return send(res, 200, { ok: true }, origin, {
      'set-cookie': clearCookie(SESSION_COOKIE, { domain: config.cookieDomain || undefined }),
    });
  }

  // ---------------------------------------------------------------- 내가 누구인지
  if (req.method === 'GET' && path === '/auth/me') {
    const userId = await currentUserId(req);
    if (!userId) return send(res, 200, { loggedIn: false }, origin);
    const user = await findUser(userId);
    if (!user) return send(res, 200, { loggedIn: false }, origin);
    return send(res, 200, { loggedIn: true, email: user.email, name: user.name }, origin);
  }

  // ---------------------------------------------------------------- 진도 기록
  if (req.method === 'PUT' && path === '/study') {
    const userId = await requireUser(req, res, origin);
    if (!userId) return;
    let body;
    try {
      body = await readJsonBody(req);
    } catch (err) {
      return send(res, 400, { error: err.message }, origin);
    }
    const checked = validateStudyBody(body);
    if (!checked.ok) return send(res, 400, { error: checked.error }, origin);
    await recordStudy(userId, checked.value); // user_id는 세션에서 나온 값만 쓴다
    return send(res, 200, { ok: true, ...checked.value }, origin);
  }

  // ---------------------------------------------------------------- 내 기록 전부
  if (req.method === 'GET' && path === '/study/me') {
    const userId = await requireUser(req, res, origin);
    if (!userId) return;
    return send(res, 200, { schema_version: 1, days: await listStudy(userId) }, origin);
  }

  send(res, 404, { error: '없는 경로입니다.' }, origin);
}

const server = createServer((req, res) => {
  handle(req, res).catch((err) => {
    console.error('처리 중 오류:', err);
    if (!res.headersSent) {
      send(res, 500, { error: '서버 오류' }, req.headers.origin);
    } else {
      res.end();
    }
  });
});

server.listen(config.port, () => {
  console.log(`진도 기록 API 시작 — 포트 ${config.port} · 세션 방식 ${config.authMode}`);
  console.log(`허용 출처: ${config.allowedOrigins.join(', ')}`);
});

// Railway가 컨테이너를 교체할 때 진행 중인 요청을 끊지 않게.
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    console.log(`${sig} 수신 — 종료합니다.`);
    server.close(() => process.exit(0));
  });
}
