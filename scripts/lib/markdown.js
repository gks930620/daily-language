// markdown.js — 교재(basics/)용 최소 마크다운→HTML 변환기. Node 내장만 사용.
// 지원 범위(교재가 쓰는 GFM 부분집합):
//   - ATX 헤딩(#~######), GFM 파이프 표(정렬 포함), 목록(-/*·1.·1단 중첩),
//     인용(>), 수평선(---/***/___ 단독행), 펜스 코드(```), 문단.
//   - 원시 HTML 패스스루: 트림한 줄이 HTML 태그로 시작하면 그대로 출력(<details>/<summary>).
//   - 인라인: **굵게**·*기울임*·_기울임_·`코드`·[텍스트](url). 나머지 텍스트는 &<> 이스케이프.
//   - 링크 재작성: href가 .md(#앵커 선택)로 끝나면 .html로. 상대경로(../)는 유지.
// JS는 생성하지 않는다(docs JS 0줄 원칙). export: mdToHtml(md) → bodyHtml.

/** 텍스트 노드용 최소 이스케이프(&, <, >). */
function escapeHtml(s) {
  return s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

/** 속성값(href)용 이스케이프. */
function escapeAttr(s) {
  return escapeHtml(s).replaceAll('"', '&quot;');
}

/** href 재작성: .md(선택적 #앵커)로 끝나면 .html로. 그 외(디렉터리·절대·앵커)는 유지. */
function rewriteHref(href) {
  return href.replace(/\.md(#.*)?$/, '.html$1');
}

/** 인라인 마크다운 → HTML. 코드 → 링크 → 굵게 → 기울임 순으로 가장 앞선 토큰을 처리. */
function inline(src) {
  let out = '';
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    // 인라인 코드 `...` — 내부는 이스케이프만(추가 변환 없음).
    if (c === '`') {
      const end = src.indexOf('`', i + 1);
      if (end !== -1) {
        out += `<code>${escapeHtml(src.slice(i + 1, end))}</code>`;
        i = end + 1;
        continue;
      }
    }
    // 링크 [텍스트](url)
    if (c === '[') {
      const m = /^\[([^\]]*)\]\(([^)]*)\)/.exec(src.slice(i));
      if (m) {
        out += `<a href="${escapeAttr(rewriteHref(m[2].trim()))}">${inline(m[1])}</a>`;
        i += m[0].length;
        continue;
      }
    }
    // 굵게 **...**
    if (c === '*' && src[i + 1] === '*') {
      const end = src.indexOf('**', i + 2);
      if (end !== -1) {
        out += `<strong>${inline(src.slice(i + 2, end))}</strong>`;
        i = end + 2;
        continue;
      }
    }
    // 기울임 *...* / _..._
    if (c === '*' || c === '_') {
      const end = src.indexOf(c, i + 1);
      if (end > i + 1) {
        out += `<em>${inline(src.slice(i + 1, end))}</em>`;
        i = end + 1;
        continue;
      }
    }
    out += escapeHtml(c);
    i++;
  }
  return out;
}

/** 표 행을 셀 배열로. 선두/말미 파이프 제거 후 | 로 분리, 각 셀 트림. */
function splitRow(line) {
  let t = line.trim();
  if (t.startsWith('|')) t = t.slice(1);
  if (t.endsWith('|')) t = t.slice(0, -1);
  return t.split('|').map((cell) => cell.trim());
}

/** GFM 표 구분행 여부(|---|:--:| …). 파이프가 있고 모든 셀이 :?-+:? 형태. */
function isDelimiterRow(line) {
  const t = line.trim();
  if (!t.includes('|')) return false;
  const cells = splitRow(t);
  return cells.length > 0 && cells.every((cell) => /^:?-+:?$/.test(cell));
}

/** 구분행에서 열별 정렬(left/right/center/'') 추출. */
function parseAligns(line) {
  return splitRow(line).map((cell) => {
    const left = cell.startsWith(':');
    const right = cell.endsWith(':');
    if (left && right) return 'center';
    if (right) return 'right';
    if (left) return 'left';
    return '';
  });
}

function alignAttr(a) {
  return a ? ` style="text-align:${a}"` : '';
}

/** 헤더·정렬·본문행 → <table>. */
function renderTable(header, aligns, rows) {
  const th = header
    .map((cell, idx) => `<th${alignAttr(aligns[idx])}>${inline(cell)}</th>`)
    .join('');
  const body = rows
    .map((r) => {
      const tds = r
        .map((cell, idx) => `<td${alignAttr(aligns[idx])}>${inline(cell)}</td>`)
        .join('');
      return `<tr>${tds}</tr>`;
    })
    .join('\n');
  return `<table>\n<thead>\n<tr>${th}</tr>\n</thead>\n<tbody>\n${body}\n</tbody>\n</table>`;
}

/** start부터 목록 하나를 파싱(1단 중첩 best-effort). [html, nextIndex] 반환. */
function parseList(lines, start) {
  const ordered = /^\d+\.\s+/.test(lines[start].trim());
  const items = [];
  let i = start;
  while (i < lines.length) {
    const raw = lines[i];
    if (raw.trim() === '') break;
    const indent = raw.length - raw.replace(/^\s+/, '').length;
    const m = /^([-*]|\d+\.)\s+(.*)$/.exec(raw.trim());
    if (!m) break;
    const isOrdered = /^\d+\./.test(m[1]);
    if (indent >= 2 && items.length > 0) {
      items[items.length - 1].children.push({ text: m[2], ordered: isOrdered });
    } else {
      items.push({ text: m[2], ordered: isOrdered, children: [] });
    }
    i++;
  }
  const tag = ordered ? 'ol' : 'ul';
  const lis = items
    .map((it) => {
      let inner = inline(it.text);
      if (it.children.length > 0) {
        const childTag = it.children[0].ordered ? 'ol' : 'ul';
        const childLis = it.children
          .map((c) => `<li>${inline(c.text)}</li>`)
          .join('\n');
        inner += `\n<${childTag}>\n${childLis}\n</${childTag}>`;
      }
      return `<li>${inner}</li>`;
    })
    .join('\n');
  return [`<${tag}>\n${lis}\n</${tag}>`, i];
}

/** 한 줄이 새 블록의 시작인지(문단 수집 종료 판단용). */
function startsBlock(lines, i) {
  const t = lines[i].trim();
  if (t === '') return true;
  if (/^```/.test(t)) return true;
  if (/^<\/?[a-zA-Z]/.test(t)) return true;
  if (/^#{1,6}\s+/.test(t)) return true;
  if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) return true;
  if (/^>\s?/.test(t)) return true;
  if (/^[-*]\s+/.test(t) || /^\d+\.\s+/.test(t)) return true;
  if (t.includes('|') && i + 1 < lines.length && isDelimiterRow(lines[i + 1])) return true;
  return false;
}

/** 마크다운 문자열 → 본문 HTML. */
export function mdToHtml(md) {
  const lines = String(md).replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const t = line.trim();

    // 빈 줄
    if (t === '') {
      i++;
      continue;
    }

    // 펜스 코드 블록
    if (/^```/.test(t)) {
      i++;
      const code = [];
      while (i < lines.length && lines[i].trim() !== '```') {
        code.push(lines[i]);
        i++;
      }
      i++; // 닫는 펜스 스킵
      out.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
      continue;
    }

    // 원시 HTML 패스스루(<details>/<summary>/닫는 태그 등)
    if (/^<\/?[a-zA-Z]/.test(t)) {
      out.push(line);
      i++;
      continue;
    }

    // 헤딩
    const h = /^(#{1,6})\s+(.*)$/.exec(t);
    if (h) {
      const level = h[1].length;
      out.push(`<h${level}>${inline(h[2].trim())}</h${level}>`);
      i++;
      continue;
    }

    // 수평선
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) {
      out.push('<hr>');
      i++;
      continue;
    }

    // 표: 현재 줄에 파이프 + 다음 줄이 구분행
    if (t.includes('|') && i + 1 < lines.length && isDelimiterRow(lines[i + 1])) {
      const header = splitRow(t);
      const aligns = parseAligns(lines[i + 1]);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].trim() !== '' && lines[i].includes('|')) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      out.push(renderTable(header, aligns, rows));
      continue;
    }

    // 인용
    if (/^>\s?/.test(t)) {
      const quote = [];
      while (i < lines.length && /^>\s?/.test(lines[i].trim())) {
        quote.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      out.push(`<blockquote>\n${mdToHtml(quote.join('\n'))}\n</blockquote>`);
      continue;
    }

    // 목록
    if (/^[-*]\s+/.test(t) || /^\d+\.\s+/.test(t)) {
      const [html, next] = parseList(lines, i);
      out.push(html);
      i = next;
      continue;
    }

    // 문단: 연속한 일반 텍스트 줄을 모은다
    const para = [];
    while (i < lines.length && lines[i].trim() !== '' && !startsBlock(lines, i)) {
      para.push(lines[i].trim());
      i++;
    }
    if (para.length > 0) {
      out.push(`<p>${inline(para.join(' '))}</p>`);
    } else {
      i++; // 안전장치(무한 루프 방지)
    }
  }
  return out.join('\n');
}
