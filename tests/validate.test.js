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

test('note 누락(en)은 words[i].note 경로 에러', () => {
  const content = loadFixture('en');
  delete content.words[2].note;
  const errors = validateContent(content, DATE, 'en');
  assert.equal(errors.length, 1);
  assert.match(errors[0], /^words\[2\]\.note: /);
});

test('note 공백(ja)도 words[i].note 경로 에러', () => {
  const content = loadFixture('ja');
  content.words[5].note = '   ';
  const errors = validateContent(content, DATE, 'ja-n2');
  assert.ok(errors.some((e) => e.startsWith('words[5].note:')), errors.join('\n'));
});

test('family 항목의 필수 키(word·ko) 위반은 항목 경로 에러', () => {
  const content = loadFixture('en');
  const i = content.words.findIndex((w) => Array.isArray(w.family) && w.family.length > 0);
  assert.ok(i >= 0, 'en 픽스처에 family를 가진 단어가 있어야 한다');
  content.words[i].family[0].word = '';
  delete content.words[i].family[0].ko;
  const errors = validateContent(content, DATE, 'en');
  assert.ok(errors.some((e) => e.startsWith(`words[${i}].family[0].word:`)), errors.join('\n'));
  assert.ok(errors.some((e) => e.startsWith(`words[${i}].family[0].ko:`)), errors.join('\n'));
});

test('related 항목의 필수 키(word·note) 위반과 배열 아님 에러', () => {
  const content = loadFixture('en');
  const i = content.words.findIndex((w) => Array.isArray(w.related) && w.related.length > 0);
  assert.ok(i >= 0, 'en 픽스처에 related를 가진 단어가 있어야 한다');
  delete content.words[i].related[0].note;
  const errors = validateContent(content, DATE, 'en');
  assert.ok(errors.some((e) => e.startsWith(`words[${i}].related[0].note:`)), errors.join('\n'));

  const content2 = loadFixture('ja');
  content2.words[0].related = '天候';
  const errors2 = validateContent(content2, DATE, 'ja-n2');
  assert.ok(errors2.some((e) => e.startsWith('words[0].related:')), errors2.join('\n'));
});

test('family/related 없는 단어(선택 필드)는 여전히 통과한다', () => {
  const content = loadFixture('en');
  const i = content.words.findIndex((w) => w.family === undefined && w.related === undefined);
  assert.ok(i >= 0, 'en 픽스처에 note만 있는 단어도 있어야 한다(있으면 렌더 원칙 확인용)');
  assert.deepEqual(validateContent(content, DATE, 'en'), []);
});
