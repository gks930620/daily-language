import test from 'node:test';
import assert from 'node:assert/strict';
import {
  todayKST,
  addDays,
  diffDays,
  resolveDate,
  isValidDateString,
} from '../scripts/lib/dates.js';

test('todayKST: UTC 저녁이면 KST는 다음 날', () => {
  // 2026-07-19 20:00 UTC = 2026-07-20 05:00 KST
  const now = Date.UTC(2026, 6, 19, 20, 0, 0);
  assert.equal(todayKST(now), '2026-07-20');
});

test('todayKST: UTC 낮이면 KST도 같은 날', () => {
  // 2026-07-19 14:00 UTC = 2026-07-19 23:00 KST
  const now = Date.UTC(2026, 6, 19, 14, 0, 0);
  assert.equal(todayKST(now), '2026-07-19');
});

test('todayKST: KST 자정 경계(15:00 UTC)', () => {
  const now = Date.UTC(2026, 6, 19, 15, 0, 0); // = 2026-07-20 00:00 KST
  assert.equal(todayKST(now), '2026-07-20');
});

test('addDays: 기본 가감', () => {
  assert.equal(addDays('2026-07-20', 1), '2026-07-21');
  assert.equal(addDays('2026-07-20', -3), '2026-07-17');
  assert.equal(addDays('2026-07-20', 0), '2026-07-20');
});

test('addDays: 월/연 경계를 넘는다', () => {
  assert.equal(addDays('2026-07-31', 1), '2026-08-01');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-01-01', -1), '2025-12-31');
  assert.equal(addDays('2026-07-20', 60), '2026-09-18');
});

test('addDays: 윤년 처리', () => {
  assert.equal(addDays('2028-02-28', 1), '2028-02-29');
  assert.equal(addDays('2026-02-28', 1), '2026-03-01');
});

test('addDays: 잘못된 입력은 throw', () => {
  assert.throws(() => addDays('2026-7-20', 1));
  assert.throws(() => addDays('2026-13-01', 1));
  assert.throws(() => addDays('nope', 1));
});

test('diffDays', () => {
  assert.equal(diffDays('2026-07-20', '2026-07-24'), 4);
  assert.equal(diffDays('2026-07-24', '2026-07-20'), -4);
  assert.equal(diffDays('2026-07-20', '2026-07-20'), 0);
});

test('resolveDate: --date 오버라이드', () => {
  assert.equal(resolveDate(['--date', '2026-07-01']), '2026-07-01');
  assert.equal(resolveDate(['--date=2026-07-02']), '2026-07-02');
});

test('resolveDate: 인자 없으면 KST 오늘', () => {
  const now = Date.UTC(2026, 6, 19, 20, 0, 0);
  assert.equal(resolveDate([], now), '2026-07-20');
});

test('resolveDate: 잘못된 --date 값은 throw', () => {
  assert.throws(() => resolveDate(['--date', '07-20-2026']));
  assert.throws(() => resolveDate(['--date']));
  assert.throws(() => resolveDate(['--date=2026-02-30']));
});

test('isValidDateString: 존재하지 않는 날짜 거부', () => {
  assert.equal(isValidDateString('2026-07-20'), true);
  assert.equal(isValidDateString('2026-02-30'), false);
  assert.equal(isValidDateString('2026-7-20'), false);
  assert.equal(isValidDateString(20260720), false);
});
