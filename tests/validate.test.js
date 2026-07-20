import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateContent, assertValidContent } from '../scripts/lib/validate.js';

const DATE = '2026-07-20';

function loadFixture() {
  const raw = readFileSync(
    new URL('../fixtures/sample-content.json', import.meta.url),
    'utf8'
  );
  return JSON.parse(raw.replaceAll('{{DATE}}', DATE));
}

test('정상 콘텐츠(픽스처)는 통과한다', () => {
  const content = loadFixture();
  assert.deepEqual(validateContent(content, DATE), []);
  assert.equal(assertValidContent(content, DATE), content);
});

test('문장 4개면 에러 — 경로 포함', () => {
  const content = loadFixture();
  content.sentences.pop();
  const errors = validateContent(content, DATE);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /^sentences: /);
  assert.match(errors[0], /5개/);
});

test('빈 필드는 필드 경로를 찍는 에러', () => {
  const content = loadFixture();
  content.sentences[2].ko = '   ';
  content.words[7].example_en = '';
  const errors = validateContent(content, DATE);
  assert.ok(errors.some((e) => e.startsWith('sentences[2].ko:')), errors.join('\n'));
  assert.ok(errors.some((e) => e.startsWith('words[7].example_en:')), errors.join('\n'));
});

test('date 불일치 에러', () => {
  const content = loadFixture();
  const errors = validateContent(content, '2026-07-21');
  assert.equal(errors.length, 1);
  assert.match(errors[0], /^date: /);
  assert.match(errors[0], /2026-07-21/);
});

test('words 개수 범위(20~25) 검사', () => {
  const content = loadFixture();
  content.words = content.words.slice(0, 19);
  const errors = validateContent(content, DATE);
  assert.ok(errors.some((e) => e.startsWith('words:') && e.includes('20~25')), errors.join('\n'));
});

test('conversation.lines 6개 미만이면 에러', () => {
  const content = loadFixture();
  content.conversation.lines = content.conversation.lines.slice(0, 5);
  const errors = validateContent(content, DATE);
  assert.ok(
    errors.some((e) => e.startsWith('conversation.lines:')),
    errors.join('\n')
  );
});

test('assertValidContent: 실패 시 모든 에러를 담아 throw', () => {
  const content = loadFixture();
  content.sentences.pop();
  content.date = '2000-01-01';
  assert.throws(
    () => assertValidContent(content, DATE),
    (err) => {
      assert.match(err.message, /검증 실패 \(2건\)/);
      assert.equal(err.validationErrors.length, 2);
      return true;
    }
  );
});

test('루트가 객체가 아니면 즉시 에러', () => {
  assert.deepEqual(validateContent(null, DATE), ['(root): JSON 객체가 아님']);
  assert.deepEqual(validateContent([], DATE), ['(root): JSON 객체가 아님']);
});
