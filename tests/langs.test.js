import test from 'node:test';
import assert from 'node:assert/strict';
import { LANGS, resolveLang } from '../scripts/lib/langs.js';

test('resolveLang: --lang 미지정이면 throw', () => {
  assert.throws(() => resolveLang([]), /--lang 필수/);
  assert.throws(() => resolveLang(['--date', '2026-07-20']), /--lang 필수/);
  assert.throws(() => resolveLang(['--lang']), /--lang 필수/); // 값 없음
});

test('resolveLang: 미등록 언어면 throw', () => {
  assert.throws(() => resolveLang(['--lang', 'fr']), /--lang 값이 잘못됨/);
  assert.throws(() => resolveLang(['--lang=xx']), /--lang 값이 잘못됨/);
});

test('resolveLang: 정상 — 두 형태 모두 허용', () => {
  assert.equal(resolveLang(['--lang', 'en']), 'en');
  assert.equal(resolveLang(['--lang=ja']), 'ja');
  assert.equal(resolveLang(['--date', '2026-07-20', '--lang', 'ja']), 'ja');
});

test('LANGS: 등록된 모든 언어에 필수 키가 완비돼 있다', () => {
  const requiredString = ['label', 'pageTitle', 'learnerProfile', 'promptFile', 'fixtureFile'];
  const requiredNumber = ['newWordCandidates', 'maxNewWords'];
  assert.ok(Object.keys(LANGS).length >= 2, 'en·ja 최소 2개 언어');
  for (const [lang, config] of Object.entries(LANGS)) {
    for (const key of requiredString) {
      assert.equal(
        typeof config[key] === 'string' && config[key].length > 0,
        true,
        `${lang}.${key}는 비어 있지 않은 문자열`
      );
    }
    for (const key of requiredNumber) {
      assert.equal(typeof config[key], 'number', `${lang}.${key}는 숫자`);
    }
    assert.equal(typeof config.requiresReading, 'boolean', `${lang}.requiresReading는 불리언`);
    assert.equal(config.promptFile, `prompts/generator.${lang}.md`);
    assert.equal(config.fixtureFile, `fixtures/sample-content.${lang}.json`);
  }
});

test('LANGS: ja는 reading 필수, en은 아님', () => {
  assert.equal(LANGS.en.requiresReading, false);
  assert.equal(LANGS.ja.requiresReading, true);
});
