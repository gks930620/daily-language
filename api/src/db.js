// db.js — MySQL 연결과 질의. 커넥션 풀은 처음 쓸 때 만든다(부팅만으로 DB를 붙잡지 않게).

import mysql from 'mysql2/promise';
import { config } from './config.js';

let pool = null;

function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      uri: config.databaseUrl,
      waitForConnections: true,
      connectionLimit: 5, // 취미 규모 + 인스턴스를 다른 프로젝트와 공유하므로 작게
      queueLimit: 0,
      timezone: 'Z',
      dateStrings: true, // DATE를 "YYYY-MM-DD" 문자열로 — 이 저장소의 날짜 규칙과 맞춘다
    });
  }
  return pool;
}

export async function query(sql, params = []) {
  const [rows] = await getPool().execute(sql, params);
  return rows;
}

/** 연결 확인용(헬스체크). */
export async function ping() {
  await query('SELECT 1');
}

/**
 * 구글 계정으로 사용자를 찾거나 만든다. google_sub이 기준 — 이메일은 바뀔 수 있다.
 * 반환: 사용자 id
 */
export async function upsertUser({ sub, email, name }) {
  await query(
    `INSERT INTO users (google_sub, email, name)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE email = VALUES(email), name = VALUES(name), id = LAST_INSERT_ID(id)`,
    [sub, email, name ?? null]
  );
  const rows = await query('SELECT id FROM users WHERE google_sub = ?', [sub]);
  return rows[0].id;
}

/**
 * 진도 1건 기록. 같은 (사용자, 날짜, 트랙)이면 덮어쓴다 — "나중 기록이 이긴다".
 * user_id는 **호출자가 토큰에서 꺼낸 값**이다. 클라이언트가 보낸 값을 쓰면 안 된다.
 */
export async function recordStudy(userId, { date, track, level }) {
  await query(
    `INSERT INTO study_log (user_id, study_date, track, level)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE level = VALUES(level)`,
    [userId, date, track, level]
  );
}

/**
 * 내 기록 전부. 브라우저의 studylog.js가 그대로 먹을 수 있는 모양으로 돌려준다:
 *   { "2026-08-10": { "en": "full", "ja-n1": "half" } }
 */
export async function listStudy(userId) {
  const rows = await query(
    'SELECT study_date, track, level FROM study_log WHERE user_id = ? ORDER BY study_date',
    [userId]
  );
  const days = {};
  for (const r of rows) {
    (days[r.study_date] ??= {})[r.track] = r.level;
  }
  return days;
}
