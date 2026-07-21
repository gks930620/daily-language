import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { LANGS, resolveLang } from '../scripts/lib/langs.js';
import { rootPath } from '../scripts/lib/store.js';

test('resolveLang: --lang 미지정이면 throw', () => {
  assert.throws(() => resolveLang([]), /--lang 필수/);
  assert.throws(() => resolveLang(['--date', '2026-07-20']), /--lang 필수/);
  assert.throws(() => resolveLang(['--lang']), /--lang 필수/); // 값 없음
});

test('resolveLang: 미등록 트랙이면 throw', () => {
  assert.throws(() => resolveLang(['--lang', 'fr']), /--lang 값이 잘못됨/);
  assert.throws(() => resolveLang(['--lang=xx']), /--lang 값이 잘못됨/);
  // 트랙 재편 이전의 값 — 이제 미등록이다(ja-n1/ja-n2로 분리됨)
  assert.throws(() => resolveLang(['--lang', 'ja']), /--lang 값이 잘못됨/);
});

test('resolveLang: 정상 — 두 형태 모두 허용', () => {
  assert.equal(resolveLang(['--lang', 'en']), 'en');
  assert.equal(resolveLang(['--lang=ja-n1']), 'ja-n1');
  assert.equal(resolveLang(['--date', '2026-07-20', '--lang', 'ja-n2']), 'ja-n2');
});

test('LANGS: 등록된 모든 트랙에 필수 키가 완비돼 있다', () => {
  const requiredString = ['label', 'pageTitle', 'learnerProfile', 'promptFile', 'fixtureFile'];
  const requiredNumber = ['newWordCandidates', 'maxNewWords'];
  assert.deepEqual(Object.keys(LANGS).sort(), ['en', 'ja-n1', 'ja-n2']);
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
    // 프롬프트·픽스처는 트랙 간 공유 가능(ja-n1/ja-n2) — 파일명 규약 대신 실존만 검사
    assert.ok(existsSync(rootPath(config.promptFile)), `${lang}.promptFile 실존: ${config.promptFile}`);
    assert.ok(existsSync(rootPath(config.fixtureFile)), `${lang}.fixtureFile 실존: ${config.fixtureFile}`);
  }
});

test('LANGS: ja 트랙은 reading 필수, en은 아님', () => {
  assert.equal(LANGS.en.requiresReading, false);
  assert.equal(LANGS['ja-n1'].requiresReading, true);
  assert.equal(LANGS['ja-n2'].requiresReading, true);
});
