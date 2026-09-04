// db.js — MySQL 연결과 질의. 커넥션 풀은 처음 쓸 때 만든다(부팅만으로 DB를 붙잡지 않게).

import mysql from 'mysql2/promise';
import { config } from './config.js';

let pool = null;

function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      ...config.db, // 항목별(host/user/password/…) 또는 { uri } — config.js가 정리해 준다
      waitForConnections: true,
      // 이 MySQL 인스턴스는 다른 프로젝트와 함께 쓴다. 커넥션 하나하나가 DB 쪽 메모리를
      // 잡아먹으므로 최소한만 열고, 놀고 있는 커넥션은 빨리 돌려준다.
      connectionLimit: 5, // 동시 처리 상한(취미 규모에는 넉넉하다)
      maxIdle: 1, // 유휴 상태로 붙들고 있을 커넥션 수(기본값은 connectionLimit이라 5개를 물고 있는다)
      idleTimeout: 30000, // 30초 놀면 끊는다
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

/** DDL 전용. prepared statement(execute)로는 못 돌리는 문장이 있어 분리한다. */
async function ddl(sql) {
  await getPool().query(sql);
}

/**
 * 데이터베이스가 없으면 만든다 — Spring의 JDBC 옵션 `createDatabaseIfNotExist=true`와 같은 일.
 * mysql2에는 그 옵션이 없어서 직접 한다.
 *
 * - **root로 접속하면** 여기서 데이터베이스가 자동으로 생긴다 → 손으로 실행할 SQL이 하나도 없다.
 * - **전용 계정으로 접속하면** CREATE 권한이 없어 실패하는데, 그 경우엔 이미 데이터베이스가
 *   만들어져 있는 상황(SETUP.md 1단계)이라 조용히 넘어간다.
 *
 * 즉 두 방식 다 이 함수 하나로 동작한다.
 */
async function ensureDatabase() {
  const name = config.db.database;
  if (!name) return; // DATABASE_URL 한 줄 방식 — 이름을 따로 못 꺼내므로 건너뛴다
  if (!/^[A-Za-z0-9_]+$/.test(name)) {
    throw new Error(`DB_NAME이 이상합니다: ${name} (영문·숫자·밑줄만 허용)`);
  }

  let conn;
  try {
    // 아직 없을 수도 있는 데이터베이스는 지정하지 않고 붙는다.
    conn = await mysql.createConnection({ ...config.db, database: undefined });
    await conn.query(
      'CREATE DATABASE IF NOT EXISTS `' +
        name +
        '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'
    );
    console.log(`데이터베이스 확인 완료(${name})`);
  } catch (err) {
    // 권한이 없으면 여기로 온다 — 전용 계정을 쓰는 정상 경로다.
    console.log(`데이터베이스 생성 건너뜀(${err.code ?? err.message}) — 이미 있으면 문제없다.`);
  } finally {
    if (conn) await conn.end().catch(() => {});
  }
}

/**
 * 데이터베이스·테이블을 준비한다. 기동할 때 한 번 호출한다(여러 번 돌려도 안전).
 * 계정(CREATE USER)은 만들지 않는다 — 전용 계정을 쓸 때는 사람이 한 번 만들어야 한다.
 */
export async function ensureSchema() {
  await ensureDatabase();

  await ddl(`CREATE TABLE IF NOT EXISTS users (
    id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    google_sub   VARCHAR(64)  NOT NULL,
    email        VARCHAR(255) NOT NULL,
    name         VARCHAR(100) NULL,
    created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_google_sub (google_sub)
  ) ENGINE=InnoDB`);

  await ddl(`CREATE TABLE IF NOT EXISTS study_log (
    user_id    BIGINT UNSIGNED NOT NULL,
    study_date DATE            NOT NULL,
    track      VARCHAR(16)     NOT NULL,
    level      ENUM('little','half','full') NOT NULL,
    updated_at TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, study_date, track),
    KEY idx_date (study_date),
    CONSTRAINT fk_study_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB`);

  // ── 학습 콘텐츠 — GitHub Actions가 매일 생성한 것을 그대로 담는다 ──
  // 원본은 저장소(data/<트랙>/<날짜>/)이고 이 테이블은 **다시 만들 수 있는 사본**이다.
  // 그래서 (track, study_date) 업서트로만 넣는다 — 몇 번을 다시 보내도 같은 결과다.
  //
  // content_json에 AI 산출물 전문을 그대로 둔다(무손실). 자주 쓸 값만 열로 뽑아
  // Spring이 JSON을 파싱하지 않고도 목록·검색을 할 수 있게 한다.
  await ddl(`CREATE TABLE IF NOT EXISTS daily_content (
    track          VARCHAR(16)  NOT NULL,
    study_date     DATE         NOT NULL,
    passage_note   VARCHAR(255) NULL,
    sentence_count SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    word_count     SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    content_json   JSON         NOT NULL,
    selected_json  JSON         NULL,
    updated_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (track, study_date),
    KEY idx_date (study_date)
  ) ENGINE=InnoDB`);

  // 단어 단위 검색·조인용. daily_content에서 파생되는 값이라 적재 때마다 그날 것만 지우고 다시 넣는다.
  await ddl(`CREATE TABLE IF NOT EXISTS daily_word (
    track      VARCHAR(16)  NOT NULL,
    study_date DATE         NOT NULL,
    headword   VARCHAR(128) NOT NULL,
    reading    VARCHAR(128) NULL,
    pos        VARCHAR(32)  NULL,
    ko         VARCHAR(255) NULL,
    example    TEXT         NULL,
    example_ko TEXT         NULL,
    note       TEXT         NULL,
    PRIMARY KEY (track, study_date, headword),
    KEY idx_headword (headword),
    KEY idx_track_date (track, study_date)
  ) ENGINE=InnoDB`);
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

/** 사용자 1명 조회(로그인 상태 확인용). 없으면 null. */
export async function findUser(userId) {
  const rows = await query('SELECT id, email, name FROM users WHERE id = ?', [userId]);
  return rows[0] ?? null;
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

/**
 * 하루치 학습 콘텐츠를 적재한다. **업서트라 몇 번을 다시 보내도 같은 결과다.**
 *
 * 저장소가 원본이고 이 테이블은 사본이므로, 전량 재적재(백필)로 언제든 복구할 수 있다.
 * daily_word는 파생 테이블이라 그날 것을 지우고 다시 넣는다(단어가 바뀐 경우까지 반영).
 *
 * 트랜잭션으로 묶어 두 테이블이 어긋난 상태로 남지 않게 한다.
 */
export async function upsertContent({ track, date, content, selected }) {
  const words = Array.isArray(selected?.words) ? selected.words : content.words ?? [];
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();

    await conn.execute(
      `INSERT INTO daily_content
         (track, study_date, passage_note, sentence_count, word_count, content_json, selected_json)
       VALUES (?, ?, ?, ?, ?, CAST(? AS JSON), CAST(? AS JSON))
       ON DUPLICATE KEY UPDATE
         passage_note   = VALUES(passage_note),
         sentence_count = VALUES(sentence_count),
         word_count     = VALUES(word_count),
         content_json   = VALUES(content_json),
         selected_json  = VALUES(selected_json)`,
      [
        track,
        date,
        content.passage_note ?? null,
        Array.isArray(content.sentences) ? content.sentences.length : 0,
        words.length,
        JSON.stringify(content),
        selected ? JSON.stringify(selected) : null,
      ]
    );

    await conn.execute('DELETE FROM daily_word WHERE track = ? AND study_date = ?', [track, date]);

    const seen = new Set();
    for (const w of words) {
      const headword = String(w.headword ?? '').trim();
      if (!headword || seen.has(headword)) continue; // 기본키가 (track, date, headword)라 중복 방어
      seen.add(headword);
      await conn.execute(
        `INSERT INTO daily_word
           (track, study_date, headword, reading, pos, ko, example, example_ko, note)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          track,
          date,
          headword,
          w.reading ?? null,
          w.pos ?? null,
          w.ko ?? null,
          w.example_en ?? null,
          w.example_ko ?? null,
          w.note ?? null,
        ]
      );
    }

    await conn.commit();
    return { track, date, words: seen.size };
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }
}

/** 적재 현황 — 트랙별 며칠분이 들어와 있는지. 백필·점검용. */
export async function contentSummary() {
  return query(
    `SELECT track, COUNT(*) AS days, MIN(study_date) AS first_date,
            MAX(study_date) AS last_date, SUM(word_count) AS words
       FROM daily_content GROUP BY track ORDER BY track`
  );
}
