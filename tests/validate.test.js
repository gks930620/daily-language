import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateContent, assertValidContent } from '../scripts/lib/validate.js';

const DATE = '2026-07-20';

function loadFixture(lang = 'en') {
  const raw = readFileSync(
    new URL(`../fixtures/sample-content.${lang}.json`, import.meta.url),
    'utf8'
  );
  return JSON.parse(raw.replaceAll('{{DATE}}', DATE));
}

test('정상 콘텐츠(en 픽스처)는 통과한다', () => {
  const content = loadFixture('en');
  assert.deepEqual(validateContent(content, DATE, 'en'), []);
  assert.equal(assertValidContent(content, DATE, 'en'), content);
});

test('문장 4개면 에러 — 경로 포함', () => {
  const content = loadFixture('en');
  content.sentences.pop();
  const errors = validateContent(content, DATE, 'en');
  assert.equal(errors.length, 1);
  assert.match(errors[0], /^sentences: /);
  assert.match(errors[0], /5개/);
});

test('빈 필드는 필드 경로를 찍는 에러', () => {
  const content = loadFixture('en');
  content.sentences[2].ko = '   ';
  content.words[7].example_en = '';
  const errors = validateContent(content, DATE, 'en');
  assert.ok(errors.some((e) => e.startsWith('sentences[2].ko:')), errors.join('\n'));
  assert.ok(errors.some((e) => e.startsWith('words[7].example_en:')), errors.join('\n'));
});

test('date 불일치 에러', () => {
  const content = loadFixture('en');
  const errors = validateContent(content, '2026-07-21', 'en');
  assert.equal(errors.length, 1);
  assert.match(errors[0], /^date: /);
  assert.match(errors[0], /2026-07-21/);
});

test('words 개수 범위(20~25) 검사', () => {
  const content = loadFixture('en');
  content.words = content.words.slice(0, 19);
  const errors = validateContent(content, DATE, 'en');
  assert.ok(errors.some((e) => e.startsWith('words:') && e.includes('20~25')), errors.join('\n'));
});

test('conversation.lines 6개 미만이면 에러', () => {
  const content = loadFixture('en');
  content.conversation.lines = content.conversation.lines.slice(0, 5);
  const errors = validateContent(content, DATE, 'en');
  assert.ok(
    errors.some((e) => e.startsWith('conversation.lines:')),
    errors.join('\n')
  );
});

test('assertValidContent: 실패 시 모든 에러를 담아 throw', () => {
  const content = loadFixture('en');
  content.sentences.pop();
  content.date = '2000-01-01';
  assert.throws(
    () => assertValidContent(content, DATE, 'en'),
    (err) => {
      assert.match(err.message, /검증 실패 \(2건\)/);
      assert.equal(err.validationErrors.length, 2);
      return true;
    }
  );
});

test('루트가 객체가 아니면 즉시 에러', () => {
  assert.deepEqual(validateContent(null, DATE, 'en'), ['(root): JSON 객체가 아님']);
  assert.deepEqual(validateContent([], DATE, 'en'), ['(root): JSON 객체가 아님']);
});

test('lang 인자가 없거나 미등록이면 throw (프로그래머 에러)', () => {
  const content = loadFixture('en');
  assert.throws(() => validateContent(content, DATE), /유효한 lang 필수/);
  assert.throws(() => validateContent(content, DATE, 'fr'), /유효한 lang 필수/);
});

test('ja 픽스처는 ja 검증을 통과한다', () => {
  const content = loadFixture('ja');
  assert.deepEqual(validateContent(content, DATE, 'ja-n2'), []);
});

test('ja: reading 누락은 필드 경로를 찍는 에러', () => {
  const content = loadFixture('ja');
  delete content.sentences[1].reading;
  content.words[3].reading = '  ';
  delete content.conversation.lines[2].reading;
  const errors = validateContent(content, DATE, 'ja-n2');
  assert.ok(errors.some((e) => e.startsWith('sentences[1].reading:')), errors.join('\n'));
  assert.ok(errors.some((e) => e.startsWith('words[3].reading:')), errors.join('\n'));
  assert.ok(
    errors.some((e) => e.startsWith('conversation.lines[2].reading:')),
    errors.join('\n')
  );
});

test('ja: en은 reading을 요구하지 않는다 — en 픽스처가 en으로 통과', () => {
  const content = loadFixture('en');
  assert.equal(content.sentences[0].reading, undefined);
  assert.deepEqual(validateContent(content, DATE, 'en'), []);
});

test('content.lang과 --lang 불일치 에러', () => {
  const content = loadFixture('ja');
  content.lang = 'en';
  const errors = validateContent(content, DATE, 'ja-n2');
  assert.ok(
    errors.some((e) => e.startsWith('lang:') && e.includes('"ja-n2"')),
    errors.join('\n')
  );
});

test('content.lang 누락 에러', () => {
  const content = loadFixture('en');
  delete content.lang;
  const errors = validateContent(content, DATE, 'en');
  assert.ok(errors.some((e) => e.startsWith('lang:')), errors.join('\n'));
});
