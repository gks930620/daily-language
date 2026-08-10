#!/usr/bin/env node
// server.js — 진도 기록 API. 엔드포인트 4개짜리 작은 HTTP 서버.
//
//   GET  /health       살아 있는지 (Railway 헬스체크용)
//   POST /auth/google  구글 ID 토큰 → 사용자 등록/조회 → 우리 세션 토큰 발급
//   PUT  /study        진도 1건 기록 (로그인 필요)
//   GET  /study/me     내 기록 전부 (로그인 필요)
//
// 웹 프레임워크를 쓰지 않는다 — 경로가 4개뿐이라 node:http로 충분하고,
// 이 저장소의 "의존성은 꼭 필요한 것만" 기조를 API에도 유지한다.
// 남은 의존성은 둘뿐: mysql2(프로토콜 구현은 직접 못 한다), jose(JWT 검증은 직접 짜면 위험하다).

import { createServer } from 'node:http';
import { config } from './config.js';
import { ping, upsertUser, recordStudy, listStudy } from './db.js';
import { verifyGoogleIdToken, issueSession, userIdFromAuthHeader } from './auth.js';
import { validateStudyBody } from './validate.js';

const MAX_BODY_BYTES = 16 * 1024; // 이 API가 받는 것은 작은 JSON뿐

function send(res, status, payload, origin) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
    ...corsHeaders(origin),
  });
  res.end(body);
}

/** 허용 목록에 있는 출처에만 CORS를 열어 준다. */
function corsHeaders(origin) {
  if (!origin || !config.allowedOrigins.includes(origin)) return {};
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET, PUT, POST, OPTIONS',
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-max-age': '86400',
    vary: 'Origin',
  };
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

/** 로그인 확인. 실패하면 401을 보내고 null을 돌려준다. */
async function requireUser(req, res, origin) {
  const userId = await userIdFromAuthHeader(req.headers.authorization);
  if (!userId) {
    send(res, 401, { error: '로그인이 필요합니다.' }, origin);
    return null;
  }
  return userId;
}

async function handle(req, res) {
  const origin = req.headers.origin;
  const url = new URL(req.url, 'http://localhost');
  const path = url.pathname.replace(/\/+$/, '') || '/';

  // CORS 사전 요청
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders(origin));
    res.end();
    return;
  }

  if (req.method === 'GET' && path === '/health') {
    try {
      await ping();
      send(res, 200, { ok: true }, origin);
    } catch (err) {
      send(res, 503, { ok: false, error: `DB 연결 실패: ${err.message}` }, origin);
    }
    return;
  }

  // 구글 로그인 → 우리 세션 토큰
  if (req.method === 'POST' && path === '/auth/google') {
    let body;
    try {
      body = await readJsonBody(req);
    } catch (err) {
      return send(res, 400, { error: err.message }, origin);
    }
    if (typeof body.credential !== 'string' || !body.credential) {
      return send(res, 400, { error: 'credential(구글 ID 토큰)이 필요합니다.' }, origin);
    }
    let profile;
    try {
      profile = await verifyGoogleIdToken(body.credential);
    } catch (err) {
      // 위조·만료·다른 앱용 토큰 전부 여기로. 이유를 자세히 알려 주지 않는다.
      console.warn('구글 토큰 검증 실패:', err.message);
      return send(res, 401, { error: '구글 인증에 실패했습니다.' }, origin);
    }
    const userId = await upsertUser(profile);
    const token = await issueSession(userId);
    return send(res, 200, { token, email: profile.email, name: profile.name }, origin);
  }

  // 진도 기록
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
    await recordStudy(userId, checked.value); // user_id는 토큰에서 나온 값만 쓴다
    return send(res, 200, { ok: true, ...checked.value }, origin);
  }

  // 내 기록 전부
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
  console.log(`진도 기록 API 시작 — 포트 ${config.port}`);
  console.log(`허용 출처: ${config.allowedOrigins.join(', ')}`);
});

// Railway가 컨테이너를 교체할 때 진행 중인 요청을 끊지 않게.
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    console.log(`${sig} 수신 — 종료합니다.`);
    server.close(() => process.exit(0));
  });
}
