-- schema.sql — 진도 기록용 스키마. Railway MySQL에 한 번만 실행한다.
--
-- total_mysql 인스턴스를 그대로 쓰되 **데이터베이스와 계정을 분리**한다.
-- 이 인스턴스에는 이미 railway·businesscard_qr(기존 Spring 프로젝트)가 들어 있고,
-- 그 옆에 daily_language를 추가하는 것이다. 기존 데이터베이스는 건드리지 않는다.
-- 계정도 나눈다 — root를 재사용하면 이 API가 뚫렸을 때 businesscard_qr까지 노출된다.

CREATE DATABASE IF NOT EXISTS daily_language
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 전용 계정 — 비밀번호는 실행 전에 바꿔서 쓰고, Railway 환경변수에만 보관한다.
CREATE USER IF NOT EXISTS 'daily_language'@'%' IDENTIFIED BY 'CHANGE_ME';
GRANT SELECT, INSERT, UPDATE, DELETE ON daily_language.* TO 'daily_language'@'%';
FLUSH PRIVILEGES;

USE daily_language;

-- 사용자 — 구글 계정 하나당 한 행. 비밀번호는 저장하지 않는다(구글이 인증을 대신한다).
CREATE TABLE IF NOT EXISTS users (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  google_sub  VARCHAR(64)  NOT NULL,            -- 구글 계정 고유 ID(이메일과 달리 절대 안 바뀜)
  email       VARCHAR(255) NOT NULL,
  name        VARCHAR(100) NULL,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_google_sub (google_sub)
) ENGINE=InnoDB;

-- 진도 기록 — (사용자, 날짜, 트랙)이 기본키라서 같은 걸 다시 눌러도 덮어쓰기가 된다.
-- 이 저장소의 규칙 그대로: "나중 기록이 이긴다".
CREATE TABLE IF NOT EXISTS study_log (
  user_id    BIGINT UNSIGNED NOT NULL,
  study_date DATE            NOT NULL,
  track      VARCHAR(16)     NOT NULL,          -- en · ja-n1 · ja-n2 (scripts/lib/langs.js와 같은 값)
  level      ENUM('little','half','full') NOT NULL,
  updated_at TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, study_date, track),
  KEY idx_date (study_date),                    -- 나중에 전체 통계 낼 때
  CONSTRAINT fk_study_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
