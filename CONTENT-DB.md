# CONTENT-DB.md — 학습 콘텐츠를 Spring에서 쓰는 법

매일 생성되는 학습 콘텐츠가 `total_mysql`의 **`daily_language` 스키마**로 들어간다.
Spring은 그 테이블을 **소유하고 읽는다**. 이 프로젝트는 **INSERT만** 한다.

```
GitHub Actions (매일 03:00, 콘텐츠 생성)
      │ POST /content  (verify 통과분만)
      ▼
daily-language API (Node, Railway)
      │ INSERT ... ON DUPLICATE KEY UPDATE   ← 넣기만 한다
      ▼
total_mysql / daily_language
      ├── daily_content   ← Spring이 만들고 소유
      └── daily_word      ← Spring이 만들고 소유
                    ▲
                    │ SELECT (사용자가 방문할 때만)
              Spring (계속 Sleeping)
```

---

## 소유권 — 누가 무엇을 만드는가

**테이블을 두 곳에서 만들면 반드시 어긋난다.** 특히 Spring이 JPA 엔티티로 매핑하고
`ddl-auto`가 켜져 있으면 Hibernate가 컬럼을 고치려 든다. 그래서 만드는 쪽을 하나로 못박는다.

| 테이블 | 소유자 | 만드는 방법 |
|---|---|---|
| `users`, `study_log` | **이 프로젝트** | Node API가 기동할 때 자동 생성 |
| `daily_content`, `daily_word` | **Spring** | 아래 DDL 또는 JPA 엔티티 |

> 콘텐츠 테이블이 없으면 적재가 **409**와 함께 안내 문구를 돌려준다
> (조용히 만들어 주지 않는다 — 그러면 소유권이 흐려진다).
> 그날 학습 페이지 생성·커밋에는 영향이 없고, 나중에 백필로 따라잡으면 된다.

---

## Spring이 만들 테이블

### SQL로 만든다면

```sql
CREATE TABLE IF NOT EXISTS daily_content (
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
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS daily_word (
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
) ENGINE=InnoDB;
```

### JPA 엔티티로 만든다면

```java
@Entity
@Table(name = "daily_content")
@IdClass(DailyContentId.class)   // track + studyDate 복합키
public class DailyContent {
    @Id private String track;              // en · ja-n1 · ja-n2
    @Id @Column(name = "study_date") private LocalDate studyDate;

    @Column(name = "passage_note") private String passageNote;
    @Column(name = "sentence_count") private int sentenceCount;
    @Column(name = "word_count") private int wordCount;

    @Column(name = "content_json", columnDefinition = "json")
    private String contentJson;            // AI 산출물 전문(무손실)

    @Column(name = "selected_json", columnDefinition = "json")
    private String selectedJson;           // 페이지에 실제로 보이는 단어

    @Column(name = "updated_at", insertable = false, updatable = false)
    private LocalDateTime updatedAt;
}

@Entity
@Table(name = "daily_word")
@IdClass(DailyWordId.class)      // track + studyDate + headword
public class DailyWord {
    @Id private String track;
    @Id @Column(name = "study_date") private LocalDate studyDate;
    @Id private String headword;

    private String reading;      // 일본어만, 영어는 null
    private String pos;
    private String ko;
    @Lob private String example;
    @Column(name = "example_ko") @Lob private String exampleKo;
    @Lob private String note;    // 암기를 돕는 지식 한 줄(어원·혼동어 등)
}
```

⚠️ **이 프로젝트는 저 컬럼 이름으로 INSERT한다.** 이름을 바꾸면 적재가 깨진다.
바꿔야 하면 `api/src/db.js`의 `upsertContent`도 같이 고쳐야 한다.

---

## 자주 쓸 쿼리

```sql
-- 오늘 영어 콘텐츠 한 건
SELECT passage_note, content_json
  FROM daily_language.daily_content
 WHERE track = 'en' AND study_date = CURDATE();

-- 최근 30일 목록(본문 없이 가볍게)
SELECT track, study_date, passage_note, word_count
  FROM daily_language.daily_content
 WHERE study_date >= CURDATE() - INTERVAL 30 DAY
 ORDER BY study_date DESC;

-- 단어 검색
SELECT track, study_date, headword, ko, note
  FROM daily_language.daily_word
 WHERE headword LIKE 'mit%'
 ORDER BY study_date DESC;

-- 콘텐츠 + 그 사용자의 진도를 조인
SELECT c.study_date, c.passage_note, s.level
  FROM daily_language.daily_content c
  LEFT JOIN daily_language.study_log s
         ON s.track = c.track AND s.study_date = c.study_date AND s.user_id = ?
 WHERE c.track = 'en'
 ORDER BY c.study_date DESC;
```

`content_json` 구조는 `prompts/generator.en.md`의 스키마 예시와 같다
(`schema_version`, `lang`, `date`, `passage_note`, `sentences[]`, `words[]`).

> Spring이 `daily_language` 스키마를 읽으려면 접속 계정에 권한이 있어야 한다.
> 지금은 root(`${{total_mysql.MYSQLUSER}}`)라 이미 된다.

---

## 적재 운영 (이 프로젝트 쪽)

```bash
# 하루치 — 워크플로가 자동으로 한다
INGEST_TOKEN=... node scripts/publish.js --lang en --date 2026-09-04

# 전량 백필 — 처음 켤 때, 또는 테이블을 다시 만들었을 때
INGEST_TOKEN=... node scripts/publish.js --all

# 적재 현황
INGEST_TOKEN=... node scripts/publish.js --summary
```

**저장소가 원본, DB는 다시 만들 수 있는 사본이다.** `(track, study_date)` 업서트로만 넣으므로
재전송·백필·복구가 전부 안전하다. Spring이 테이블 구조를 바꿔도 전량 재적재하면 맞춰진다.

### 필요한 설정

| 어디 | 이름 | 값 |
|---|---|---|
| Railway (daily-language 서비스) | `INGEST_TOKEN` | 랜덤 문자열. **비우면 적재 엔드포인트가 꺼진다** |
| GitHub 저장소 Secrets | `INGEST_TOKEN` | 위와 같은 값 |
| GitHub 저장소 Secrets | `PUBLISH_URL` | (선택) API 주소. 없으면 `site.js`의 `API_BASE` |

시크릿이 없으면 워크플로가 **적재만 건너뛰고** 학습 페이지 생성은 그대로 진행한다.
적재 스텝은 `continue-on-error`라 실패해도 그날 콘텐츠 커밋에는 영향이 없다.

### 적재가 실패할 때

| 응답 | 뜻 |
|---|---|
| `409` + "테이블이 없습니다" | Spring이 아직 테이블을 안 만들었다 |
| `401` | `INGEST_TOKEN`이 양쪽에서 다르다 |
| `503` | Railway에 `INGEST_TOKEN`이 없다(적재 기능 꺼짐) |
| `400` | 본문이 잘못됐다(트랙·날짜·구조) — 메시지에 이유가 있다 |
