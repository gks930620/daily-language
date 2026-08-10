import test from 'node:test';
import assert from 'node:assert/strict';

// config.js가 환경변수를 요구하므로 import 전에 채워 둔다(테스트용 더미).
process.env.GOOGLE_CLIENT_ID ??= 'test-client-id.apps.googleusercontent.com';
process.env.GOOGLE_CLIENT_SECRET ??= 'test-client-secret';
process.env.PUBLIC_URL ??= 'https://api.example.com';
process.env.SESSION_SECRET ??= 'test-secret-that-is-long-enough-32-chars';
process.env.DATABASE_URL ??= 'mysql://u:p@localhost:3306/daily_language';
process.env.ALLOWED_ORIGINS ??= 'https://gks930620.github.io,https://study.example.com';

const { validateStudyBody, isValidDate } = await import('../src/validate.js');
const { issueSession, userIdFromRequest, safeReturnTo, startLogin, verifyTx } = await import(
  '../src/auth.js'
);
const { readCookie, serializeCookie, clearCookie } = await import('../src/cookies.js');
const { REDIRECT_URI, resolveDbConfig } = await import('../src/config.js');

// ---------------------------------------------------------------- 입력 검증

test('isValidDate: 실제 존재하는 날짜만 통과', () => {
  assert.ok(isValidDate('2026-08-10'));
  assert.ok(isValidDate('2024-02-29'), '윤년');
  assert.ok(!isValidDate('2026-02-30'), '없는 날짜');
  assert.ok(!isValidDate('2026-8-10'), '한 자리 월');
  assert.ok(!isValidDate(''));
  assert.ok(!isValidDate(null));
});

test('validateStudyBody: 정상 요청은 값을 그대로 돌려준다', () => {
  const r = validateStudyBody({ date: '2026-08-10', track: 'ja-n1', level: 'full' });
  assert.deepEqual(r, { ok: true, value: { date: '2026-08-10', track: 'ja-n1', level: 'full' } });
});

test('validateStudyBody: 등록되지 않은 트랙·단계·날짜는 거부', () => {
  assert.equal(validateStudyBody({ date: '2026-08-10', track: 'ko', level: 'full' }).ok, false);
  assert.equal(validateStudyBody({ date: '2026-08-10', track: 'en', level: 'done' }).ok, false);
  assert.equal(validateStudyBody({ date: '2026-13-01', track: 'en', level: 'full' }).ok, false);
  for (const bad of [null, 'x', 42, ['a']]) assert.equal(validateStudyBody(bad).ok, false);
});

test('validateStudyBody: user_id를 보내도 무시된다 — 신원은 세션에서만 온다', () => {
  const r = validateStudyBody({
    date: '2026-08-10',
    track: 'en',
    level: 'half',
    user_id: 999, // 남의 계정을 노린 값
  });
  assert.ok(r.ok);
  assert.deepEqual(Object.keys(r.value).sort(), ['date', 'level', 'track']);
});

// ---------------------------------------------------------------- 세션

test('세션: 쿠키로도 Authorization 헤더로도 사용자 id가 나온다', async () => {
  const token = await issueSession(42);
  assert.equal(await userIdFromRequest({ sessionCookie: token }), 42, 'cookie 모드');
  assert.equal(
    await userIdFromRequest({ authorizationHeader: `Bearer ${token}` }),
    42,
    'token 모드'
  );
});

test('세션: 위조·형식오류·없음은 전부 null', async () => {
  const token = await issueSession(42);
  const [head, payload, sig] = token.split('.');

  assert.equal(await userIdFromRequest({}), null);
  assert.equal(await userIdFromRequest({ authorizationHeader: token }), null, 'Bearer 없음');
  assert.equal(await userIdFromRequest({ sessionCookie: 'not.a.jwt' }), null);

  // 서명 변조 — 첫 글자를 바꾼다. base64url의 **마지막** 글자는 유효 비트가 2개뿐이라
  // 다른 글자로 바꿔도 같은 바이트로 디코딩될 수 있다(그러면 서명이 그대로라 통과한다).
  // 첫 글자는 6비트를 온전히 담으므로 바꾸면 반드시 다른 서명이 된다.
  const badSig = (sig[0] === 'A' ? 'B' : 'A') + sig.slice(1);
  assert.equal(
    await userIdFromRequest({ sessionCookie: `${head}.${payload}.${badSig}` }),
    null,
    '서명 변조'
  );

  // 페이로드 변조 — 남의 사용자 id로 바꿔치기하고 서명은 그대로 둔 경우
  const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  const forged = Buffer.from(JSON.stringify({ ...claims, sub: '999' })).toString('base64url');
  assert.equal(
    await userIdFromRequest({ sessionCookie: `${head}.${forged}.${sig}` }),
    null,
    '페이로드 변조(남의 id로 바꿔치기)'
  );
});

test('세션: 다른 키로 서명된 토큰은 거부', async () => {
  const { SignJWT } = await import('jose');
  const evil = await new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('1')
    .setExpirationTime('30d')
    .sign(new TextEncoder().encode('공격자가-고른-다른-비밀키-입니다-충분히길게'));
  assert.equal(await userIdFromRequest({ sessionCookie: evil }), null);
});

// ---------------------------------------------------------------- 리다이렉트 안전장치

test('safeReturnTo: 허용 목록 안의 주소만 통과, 나머지는 기본값으로', () => {
  assert.equal(
    safeReturnTo('https://gks930620.github.io/en/days/2026-08-10.html'),
    'https://gks930620.github.io/en/days/2026-08-10.html'
  );
  // 피싱 시도: 로그인 링크로 아무 사이트에 되돌려 보내려는 경우
  const fallback = 'https://gks930620.github.io/';
  assert.equal(safeReturnTo('https://evil.example.com/steal'), fallback);
  assert.equal(safeReturnTo('https://gks930620.github.io.evil.com/'), fallback, '접두어 흉내');
  assert.equal(safeReturnTo('javascript:alert(1)'), fallback);
  assert.equal(safeReturnTo('//evil.example.com'), fallback, '스킴 생략');
  assert.equal(safeReturnTo(null), fallback);
});

// ---------------------------------------------------------------- OAuth 거래

test('startLogin: 구글 URL에 PKCE·state·redirect_uri가 정확히 들어간다', async () => {
  const { url, tx } = await startLogin('https://gks930620.github.io/');
  const u = new URL(url);
  assert.equal(u.origin + u.pathname, 'https://accounts.google.com/o/oauth2/v2/auth');
  assert.equal(u.searchParams.get('response_type'), 'code');
  assert.equal(u.searchParams.get('redirect_uri'), REDIRECT_URI);
  assert.equal(u.searchParams.get('code_challenge_method'), 'S256');
  assert.ok(u.searchParams.get('code_challenge'), 'PKCE challenge 존재');
  assert.ok(u.searchParams.get('state'), 'state 존재');
  // client_secret은 절대 URL에 실리지 않는다(서버↔구글 교환 때만 쓴다)
  assert.ok(!url.includes('test-client-secret'), 'client_secret이 브라우저로 나가면 안 된다');
  assert.ok(tx, '거래 쿠키 값');
});

test('verifyTx: state가 맞으면 verifier와 돌아갈 주소를 돌려준다', async () => {
  const returnTo = 'https://gks930620.github.io/en/index.html';
  const { url, tx } = await startLogin(returnTo);
  const state = new URL(url).searchParams.get('state');
  const got = await verifyTx(tx, state);
  assert.equal(got.returnTo, returnTo);
  assert.ok(got.codeVerifier.length >= 32);
});

test('verifyTx: state가 다르면 거부 — CSRF 차단', async () => {
  const { tx } = await startLogin('https://gks930620.github.io/');
  await assert.rejects(() => verifyTx(tx, 'attacker-state'), /state가 일치하지 않습니다/);
  await assert.rejects(() => verifyTx(null, 'x'), /로그인 거래 정보가 없습니다/);
});

test('verifyTx: 두 로그인 시도의 state는 서로 다르다', async () => {
  const a = await startLogin('https://gks930620.github.io/');
  const b = await startLogin('https://gks930620.github.io/');
  const sa = new URL(a.url).searchParams.get('state');
  const sb = new URL(b.url).searchParams.get('state');
  assert.notEqual(sa, sb);
  await assert.rejects(() => verifyTx(a.tx, sb), /state가 일치하지 않습니다/);
});

// ---------------------------------------------------------------- 쿠키

test('쿠키: HttpOnly·Secure가 항상 붙는다', () => {
  const c = serializeCookie('dl_session', 'abc', { maxAge: 60 });
  assert.match(c, /^dl_session=abc;/);
  assert.ok(c.includes('HttpOnly'), 'JS가 읽지 못하게');
  assert.ok(c.includes('Secure'), 'HTTPS로만');
  assert.ok(c.includes('SameSite=Lax'));
  assert.ok(c.includes('Max-Age=60'));
});

test('쿠키: 읽기와 삭제', () => {
  assert.equal(readCookie('a=1; dl_session=xyz; b=2', 'dl_session'), 'xyz');
  assert.equal(readCookie('a=1', 'dl_session'), null);
  assert.equal(readCookie(undefined, 'dl_session'), null);
  assert.ok(clearCookie('dl_session').includes('Max-Age=0'));
});

// ---------------------------------------------------------------- DB 접속 정보

test('resolveDbConfig: 항목별 변수(권장) — Spring의 USERNAME/PASSWORD 방식과 같다', () => {
  assert.deepEqual(
    resolveDbConfig({
      DB_HOST: 'mysql.railway.internal',
      DB_PORT: '3306',
      DB_USER: 'daily_language',
      DB_PASSWORD: 'secret',
      DB_NAME: 'daily_language',
    }),
    {
      host: 'mysql.railway.internal',
      port: 3306,
      user: 'daily_language',
      password: 'secret',
      database: 'daily_language',
    }
  );
});

test('resolveDbConfig: 비밀번호의 @ : / ? 가 깨지지 않는다 — URL을 거치지 않기 때문', () => {
  const password = 'p@ss:w/rd?#!';
  const got = resolveDbConfig({
    DB_HOST: 'h',
    DB_USER: 'u',
    DB_PASSWORD: password,
    DB_NAME: 'd',
  });
  assert.equal(got.password, password, '특수문자가 그대로 살아 있어야 한다');
  assert.equal(got.port, 3306, 'DB_PORT 생략 시 기본값');
});

test('resolveDbConfig: DATABASE_URL 한 줄도 받는다(둘 다 있으면 항목별이 이긴다)', () => {
  assert.deepEqual(resolveDbConfig({ DATABASE_URL: 'mysql://u:p@h:3306/d' }), {
    uri: 'mysql://u:p@h:3306/d',
  });
  const both = resolveDbConfig({
    DATABASE_URL: 'mysql://old:old@old:3306/old',
    DB_HOST: 'h',
    DB_USER: 'u',
    DB_PASSWORD: 'p',
    DB_NAME: 'd',
  });
  assert.equal(both.host, 'h');
  assert.equal(both.uri, undefined);
});

test('resolveDbConfig: 빠진 값이 있으면 무엇이 빠졌는지 알려 준다', () => {
  assert.throws(() => resolveDbConfig({ DB_HOST: 'h' }), /DB_USER, DB_PASSWORD, DB_NAME/);
  assert.throws(() => resolveDbConfig({ DB_HOST: 'h', DB_USER: 'u' }), /DB_PASSWORD, DB_NAME/);
  assert.throws(() => resolveDbConfig({}), /DB 접속 정보가 없습니다/);
});
