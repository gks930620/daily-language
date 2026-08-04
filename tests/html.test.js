import test from 'node:test';
import assert from 'node:assert/strict';
import { page, renderWords, renderDaySections, ttsUrl } from '../scripts/lib/html.js';

const WORD = {
  headword: 'mitigate',
  pos: 'v.',
  ko: '완화하다',
  example_en: 'Steps to mitigate the damage began at once.',
  example_ko: '피해를 완화하려는 조치가 즉시 시작됐다.',
  note: 'mit(보내다) + -igate — 부드럽게 보내 버린다는 감각.',
};

const CONTENT = {
  passage_note: '공중 보건 사설의 도입 문단',
  sentences: [{ en: 'A.', ko: 'ㄱ.', structure: '· 단문' }],
  words: [WORD],
};

test('ttsUrl: 단어를 인코딩해 붙이고 언어 코드를 담는다', () => {
  const url = ttsUrl('mitigate', 'en');
  assert.match(url, /[?&]q=mitigate(&|$)/);
  assert.match(url, /[?&]tl=en(&|$)/);
  // 공백·특수문자가 있는 표제어도 URL이 깨지지 않는다
  assert.match(ttsUrl('take off', 'en'), /[?&]q=take%20off(&|$)/);
});

test('renderWords: ttsLang이 있으면 표제어당 발음 음성이 정확히 1개', () => {
  const html = renderWords([WORD, { ...WORD, headword: 'deter' }], 'en');
  const audios = html.match(/<audio class="say"/g) ?? [];
  assert.equal(audios.length, 2);
  // 표제어 뒤·품사 앞에 붙는다
  assert.match(html, /<b class="en">mitigate<\/b> <audio class="say"[^>]*><\/audio> <span class="pos">/);
  // 페이지 로드 시 음성을 미리 받지 않는다
  assert.match(html, /preload="none"/);
  // HTML 속성값이므로 &는 이스케이프돼야 한다
  assert.ok(html.includes('&amp;client=tw-ob'), 'URL의 &가 &amp;로 이스케이프됨');
  assert.ok(!/src="[^"]*&(?!amp;)/.test(html), 'src 안에 raw &가 남아 있으면 안 된다');
});

test('renderWords: ttsLang이 없으면(ja 트랙) 발음 음성을 렌더하지 않는다', () => {
  assert.ok(!renderWords([WORD]).includes('<audio'));
  assert.ok(!renderWords([WORD], null).includes('<audio'));
});

test('renderWords: 예문에는 음성을 붙이지 않는다 — 표제어 하나만', () => {
  const html = renderWords([WORD], 'en');
  const exampleBlock = html.slice(html.indexOf('<p class="word-ex">'));
  assert.ok(!exampleBlock.includes('<audio'));
});

test('renderDaySections: ttsLang을 단어 섹션까지 전달한다', () => {
  assert.ok(renderDaySections(CONTENT, null, 'en').includes('<audio class="say"'));
  assert.ok(!renderDaySections(CONTENT, null).includes('<audio'));
});

test('page: TTS가 404를 주지 않도록 no-referrer 메타를 넣는다', () => {
  assert.match(page({ title: 't', body: '' }), /<meta name="referrer" content="no-referrer">/);
});

test('renderWords: 단어 마커(word-item)는 음성 추가 후에도 단어당 1개 — verify 호환', () => {
  const html = renderWords([WORD, { ...WORD, headword: 'deter' }], 'en');
  assert.equal((html.match(/<article class="word-item">/g) ?? []).length, 2);
});
