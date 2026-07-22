import test from 'node:test';
import assert from 'node:assert/strict';
import { mdToHtml } from '../scripts/lib/markdown.js';

test('헤딩: #~###### → h1~h6', () => {
  assert.equal(mdToHtml('# 제목'), '<h1>제목</h1>');
  assert.equal(mdToHtml('### 소제목'), '<h3>소제목</h3>');
  assert.equal(mdToHtml('###### 6단계'), '<h6>6단계</h6>');
});

test('GFM 파이프 표 → <table>/<th>/<td>', () => {
  const md = ['| 행 | 뜻 |', '|---|---|', '| あ | 아 |', '| か | 카 |'].join('\n');
  const html = mdToHtml(md);
  assert.match(html, /<table>/);
  assert.match(html, /<thead>[\s\S]*<th>행<\/th><th>뜻<\/th>[\s\S]*<\/thead>/);
  assert.match(html, /<td>あ<\/td><td>아<\/td>/);
  assert.match(html, /<td>か<\/td><td>카<\/td>/);
});

test('표 정렬(:--:)은 text-align 스타일로', () => {
  const md = ['| a | b |', '|:--|--:|', '| 1 | 2 |'].join('\n');
  const html = mdToHtml(md);
  assert.match(html, /text-align:left/);
  assert.match(html, /text-align:right/);
});

test('인라인: **굵게** → <strong>', () => {
  assert.equal(mdToHtml('**강조**'), '<p><strong>강조</strong></p>');
});

test('원시 HTML 패스스루: <details>/<summary>는 그대로', () => {
  const md = ['<details>', '<summary>정답 보기</summary>', '', '**답**입니다.', '', '</details>'].join(
    '\n'
  );
  const html = mdToHtml(md);
  assert.match(html, /<details>/);
  assert.match(html, /<summary>정답 보기<\/summary>/);
  assert.match(html, /<\/details>/);
  // details 안의 마크다운 본문은 렌더된다
  assert.match(html, /<p><strong>답<\/strong>입니다\.<\/p>/);
});

test('.md 링크는 .html로 재작성', () => {
  const html = mdToHtml('[동사편](part3-동사.md)');
  assert.match(html, /href="part3-동사\.html"/);
  assert.doesNotMatch(html, /\.md"/);
});

test('상대경로(../)와 앵커는 유지, .md만 .html로', () => {
  assert.match(mdToHtml('[표현](../book3-expressions/ch01.md)'), /href="\.\.\/book3-expressions\/ch01\.html"/);
  assert.match(mdToHtml('[폴더](book2-grammar/)'), /href="book2-grammar\/"/);
});

test('이스케이프: 텍스트 안의 <는 &lt;', () => {
  const html = mdToHtml('A < B 그리고 & 기호');
  assert.match(html, /&lt;/);
  assert.match(html, /&amp;/);
  assert.doesNotMatch(html, /<p>A < B/);
});

test('펜스 코드 블록: 내부는 이스케이프, 인라인 변환 없음', () => {
  const md = ['```', '[주제]は **です**', '```'].join('\n');
  const html = mdToHtml(md);
  assert.match(html, /<pre><code>/);
  assert.match(html, /\[주제\]は \*\*です\*\*/); // 변환되지 않음
  assert.doesNotMatch(html, /<strong>/);
});
