// app.js — 진도 기록 프런트엔드. docs/의 유일한 JS다.
//
// 학습 콘텐츠(문단·단어)는 여전히 정적 HTML이라 이 파일이 없거나 실패해도 그대로 보인다.
// 여기서 하는 일은 셋뿐이다: 로그인 상태 표시, 진도 저장, 내 기록 계산·표시.
//
// 통계 계산은 studylog.js의 순수 함수를 **서버 쪽과 똑같이** 재사용한다(로직 두 벌 방지).
// 분모(어느 날 콘텐츠가 있었나)는 DB가 모르는 정보라 빌드가 만든 days.json에서 가져온다.

import { API_BASE } from './config.js';
import { LEVELS, trackStats, studyRows, levelOf } from './studylog.js';

const TOKEN_KEY = 'dl_token'; // AUTH_MODE=token일 때만 쓴다(cookie 모드면 비어 있다)

// ---------------------------------------------------------------- 세션

function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return ''; // 프라이빗 모드 등에서 localStorage가 막힌 경우
  }
}

function setToken(v) {
  try {
    if (v) localStorage.setItem(TOKEN_KEY, v);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* 저장 못 해도 쿠키 모드면 그대로 동작한다 */
  }
}

/** 로그인 콜백이 #token=... 으로 돌아왔으면 저장하고 주소창에서 지운다. */
function captureTokenFromUrl() {
  if (!location.hash.startsWith('#token=')) return;
  setToken(decodeURIComponent(location.hash.slice('#token='.length)));
  history.replaceState(null, '', location.pathname + location.search);
}

/** API 호출. 토큰이 있으면 헤더로, 쿠키 모드면 credentials로 신원이 실린다. */
async function api(path, options = {}) {
  const token = getToken();
  const headers = { ...(options.headers || {}) };
  if (options.body) headers['content-type'] = 'application/json';
  if (token) headers.authorization = 'Bearer ' + token;

  const res = await fetch(API_BASE + path, { ...options, credentials: 'include', headers });
  if (res.status === 401) {
    setToken(''); // 만료된 토큰은 버린다
    return { status: 401, data: null };
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* 본문이 없을 수 있다 */
  }
  return { status: res.status, data };
}

function loginUrl() {
  return API_BASE + '/auth/start?return=' + encodeURIComponent(location.href);
}

function el(tag, className, text) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text !== undefined) n.textContent = text;
  return n;
}

function loginLink(text) {
  const a = el('a', 'login-link', text || '구글로 로그인');
  a.href = loginUrl();
  return a;
}

// ---------------------------------------------------------------- 진도 체크인 (day 페이지)

function setStatus(section, text) {
  const node = section.querySelector('[data-role="status"]');
  if (node) node.textContent = text;
}

function setHelp(section, child) {
  const node = section.querySelector('[data-role="help"]');
  if (!node) return;
  node.textContent = '';
  if (child) node.append(child);
}

function markCurrent(section, level) {
  for (const btn of section.querySelectorAll('.checkin-btn')) {
    btn.classList.toggle('checkin-btn--on', btn.dataset.level === level);
  }
}

async function initCheckin(section) {
  const date = section.dataset.date;
  const track = section.dataset.track;
  const buttons = Array.from(section.querySelectorAll('.checkin-btn'));

  if (!API_BASE) {
    setStatus(section, '진도 기록이 아직 설정되지 않았습니다.');
    setHelp(section, document.createTextNode('저장소의 SETUP.md 절차를 마치면 켜집니다.'));
    return;
  }

  const me = await api('/study/me');
  if (me.status === 401 || !me.data) {
    setStatus(section, '기록하려면 로그인이 필요합니다.');
    setHelp(section, loginLink());
    return;
  }

  const current = levelOf(me.data, date, track);
  markCurrent(section, current);
  setStatus(
    section,
    current ? '기록됨: ' + LEVELS[current].label + ' — 다시 누르면 고쳐집니다.' : '아직 기록 없음.'
  );
  setHelp(section, null);

  for (const btn of buttons) {
    btn.disabled = false;
    btn.addEventListener('click', async () => {
      const level = btn.dataset.level;
      for (const b of buttons) b.disabled = true;
      setStatus(section, '저장 중…');

      const r = await api('/study', {
        method: 'PUT',
        body: JSON.stringify({ date, track, level }),
      });

      if (r.status === 200) {
        for (const b of buttons) b.disabled = false;
        markCurrent(section, level);
        setStatus(section, '기록됨: ' + LEVELS[level].label + ' — 다시 누르면 고쳐집니다.');
      } else if (r.status === 401) {
        setStatus(section, '로그인이 풀렸습니다.');
        setHelp(section, loginLink('다시 로그인'));
      } else {
        for (const b of buttons) b.disabled = false;
        const why = (r.data && r.data.error) || r.status;
        setStatus(section, '저장 실패 (' + why + '). 다시 눌러 주세요.');
      }
    });
  }
}

// ---------------------------------------------------------------- 내 기록 페이지

function statCard(stat, label) {
  const card = el('article', 'stat-card');
  card.append(el('h3', null, label));

  const main = el('p', 'stat-main');
  main.append(el('b', null, stat.avgProgress + '%'), ' ', el('span', 'stat-sub', '평균 진도'));
  card.append(main);

  const bar = el('div', 'bar');
  const fill = el('span', 'bar-fill');
  fill.style.width = stat.avgProgress + '%';
  bar.append(fill);
  card.append(bar);

  const counts = Object.entries(LEVELS)
    .map(([key, v]) => v.label + ' ' + stat.counts[key] + '일')
    .join(' · ');

  card.append(
    el(
      'p',
      'stat-line',
      '기록한 날 ' + stat.recorded + ' / ' + stat.total + '일 (' + stat.recordedPercent + '%)'
    ),
    el('p', 'stat-line', counts),
    el('p', 'stat-line', '연속 ' + stat.currentStreak + '일 · 최장 ' + stat.longestStreak + '일')
  );
  return card;
}

function historyTable(rows, langs, labels) {
  const table = el('table', 'study-table');

  const thead = el('thead');
  const headRow = el('tr');
  headRow.append(el('th', null, '날짜'));
  for (const lang of langs) headRow.append(el('th', null, labels[lang] || lang));
  thead.append(headRow);
  table.append(thead);

  const tbody = el('tbody');
  for (const row of rows) {
    const tr = el('tr');
    tr.append(el('th', 'date-cell', row.date));
    for (const t of row.tracks) {
      const td = el('td', 'cell');
      if (!t.available) {
        td.classList.add('cell--none');
        td.textContent = '—';
      } else {
        td.classList.add(t.level ? 'cell--' + t.level : 'cell--todo');
        const a = el('a', null, t.level ? LEVELS[t.level].dots : '○○○');
        a.href = '../' + t.lang + '/days/' + row.date + '.html';
        a.title = t.level ? LEVELS[t.level].label : '안 함';
        td.append(a);
      }
      tr.append(td);
    }
    tbody.append(tr);
  }
  table.append(tbody);

  const wrap = el('div', 'table-wrap');
  wrap.append(table);
  return wrap;
}

function legend() {
  const p = el('p', 'legend');
  for (const v of Object.values(LEVELS)) {
    p.append(el('span', 'legend-item', v.dots + ' ' + v.label));
  }
  p.append(el('span', 'legend-item', '○○○ 안 함'), el('span', 'legend-item', '— 콘텐츠 없음'));
  return p;
}

async function initMyPage(root) {
  const show = (...nodes) => {
    root.textContent = '';
    root.append(...nodes);
  };

  if (!API_BASE) {
    show(
      el(
        'p',
        'empty',
        '진도 기록이 아직 설정되지 않았습니다. 저장소의 SETUP.md 절차를 마치면 켜집니다.'
      )
    );
    return;
  }

  const [me, daysRes] = await Promise.all([
    api('/study/me'),
    fetch('../days.json')
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null),
  ]);

  if (me.status === 401 || !me.data) {
    const p = el('p', 'empty', '내 기록을 보려면 ');
    p.append(loginLink(), document.createTextNode(' 하세요.'));
    show(p);
    return;
  }
  if (!daysRes) {
    show(el('p', 'empty', '학습 날짜 목록을 불러오지 못했습니다. 새로고침해 주세요.'));
    return;
  }

  const daysByLang = daysRes.daysByLang;
  const labels = daysRes.labels || {};
  const langs = Object.keys(daysByLang);
  const stats = langs.map((lang) => trackStats(me.data, lang, daysByLang[lang] || []));

  const cards = el('div', 'stat-cards');
  for (const s of stats) cards.append(statCard(s, labels[s.lang] || s.lang));

  const history = el('section');
  history.id = 'history';
  history.append(
    el('h2', null, '날짜별 진도'),
    legend(),
    historyTable(studyRows(me.data, daysByLang, langs), langs, labels)
  );

  const logout = el('button', 'logout-btn', '로그아웃');
  logout.type = 'button';
  logout.addEventListener('click', async () => {
    await api('/auth/logout', { method: 'POST' });
    setToken('');
    location.reload();
  });

  show(cards, history, logout);
}

// ---------------------------------------------------------------- 시작

captureTokenFromUrl();

for (const section of document.querySelectorAll('[data-checkin]')) {
  initCheckin(section).catch((err) => {
    console.error(err);
    setStatus(section, '진도 기록 서버에 연결하지 못했습니다.');
  });
}

const mePage = document.querySelector('[data-mypage]');
if (mePage) {
  initMyPage(mePage).catch((err) => {
    console.error(err);
    mePage.textContent = '';
    mePage.append(el('p', 'empty', '진도 기록 서버에 연결하지 못했습니다.'));
  });
}
