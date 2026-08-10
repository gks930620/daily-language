import test from 'node:test';
import assert from 'node:assert/strict';

// config.js가 환경변수를 요구하므로 import 전에 채워 둔다(테스트용 더미).
process.env.GOOGLE_CLIENT_ID ??= 'test-client-id.apps.googleusercontent.com';
process.env.SESSION_SECRET ??= 'test-secret-that-is-long-enough-32-chars';
process.env.DATABASE_URL ??= 'mysql://u:p@localhost:3306/daily_language';

const { validateStudyBody, isValidDate } = await import('../src/validate.js');
const { issueSession, userIdFromAuthHeader } = await import('../src/auth.js');

test('isValidDate: 실제 존재하는 날짜만 통과', () => {
  assert.ok(isValidDate('2026-08-10'));
  assert.ok(isValidDate('2024-02-29'), '윤년');
  assert.ok(!isValidDate('2026-02-30'), '없는 날짜');
  assert.ok(!isValidDate('2026-8-10'), '한 자리 월');
  assert.ok(!isValidDate('20260810'));
  assert.ok(!isValidDate(''));
  assert.ok(!isValidDate(null));
});

test('validateStudyBody: 정상 요청은 값을 그대로 돌려준다', () => {
  const r = validateStudyBody({ date: '2026-08-10', track: 'ja-n1', level: 'full' });
  assert.deepEqual(r, { ok: true, value: { date: '2026-08-10', track: 'ja-n1', level: 'full' } });
});

test('validateStudyBody: 등록되지 않은 트랙·단계는 거부', () => {
  assert.equal(validateStudyBody({ date: '2026-08-10', track: 'ko', level: 'full' }).ok, false);
  assert.equal(validateStudyBody({ date: '2026-08-10', track: 'en', level: 'done' }).ok, false);
  assert.equal(validateStudyBody({ date: '2026-13-01', track: 'en', level: 'full' }).ok, false);
});

test('validateStudyBody: 객체가 아니면 거부', () => {
  for (const bad of [null, 'x', 42, ['a']]) {
    assert.equal(validateStudyBody(bad).ok, false);
  }
});

test('validateStudyBody: user_id를 보내도 무시된다 — 신원은 토큰에서만 온다', () => {
  const r = validateStudyBody({
    date: '2026-08-10',
    track: 'en',
    level: 'half',
    user_id: 999, // 남의 계정을 노린 값
  });
  assert.ok(r.ok);
  assert.deepEqual(Object.keys(r.value).sort(), ['date', 'level', 'track']);
  assert.equal(r.value.user_id, undefined, 'user_id는 통과된 값에 절대 없다');
});

test('세션 토큰: 발급한 것에서 사용자 id가 그대로 나온다', async () => {
  const token = await issueSession(42);
  assert.equal(await userIdFromAuthHeader(`Bearer ${token}`), 42);
});

test('세션 토큰: 위조·형식오류·없음은 전부 null', async () => {
  const token = await issueSession(42);
  assert.equal(await userIdFromAuthHeader(undefined), null);
  assert.equal(await userIdFromAuthHeader('Bearer '), null);
  assert.equal(await userIdFromAuthHeader(token), null, 'Bearer 접두어 없음');
  assert.equal(await userIdFromAuthHeader('Bearer not.a.jwt'), null);
  // 서명 한 글자만 바꿔도 거부
  assert.equal(
    await userIdFromAuthHeader(`Bearer ${token.slice(0, -1)}${token.at(-1) === 'A' ? 'B' : 'A'}`),
    null
  );
});

test('세션 토큰: 다른 키로 서명된 토큰은 거부', async () => {
  const { SignJWT } = await import('jose');
  const evil = await new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('1')
    .setExpirationTime('30d')
    .sign(new TextEncoder().encode('공격자가-고른-다른-비밀키-입니다-충분히길게'));
  assert.equal(await userIdFromAuthHeader(`Bearer ${evil}`), null);
});
