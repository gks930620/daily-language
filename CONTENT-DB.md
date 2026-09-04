# CONTENT-DB.md — 학습 콘텐츠를 DB에서 읽는 법 (Spring용)

매일 생성되는 학습 콘텐츠가 `total_mysql`의 **`daily_language` 스키마**에 적재된다.
Spring은 **읽기만** 하면 된다 — 적재에 관여하지 않고, 자고 있어도 행은 쌓인다.

```
GitHub Actions (매일 03:00, 콘텐츠 생성)
      │ POST /content  (verify 통과분만)
      ▼
daily-language API (Node, Railway)
      │ INSERT ... ON DUPLICATE KEY UPDATE
      ▼
total_mysql / daily_language
      ├── daily_content   하루치 1행
      └── daily_word      단어 1개당 1행 (검색·조인용)
                    ▲
                    │ SELECT (사용자가 방문할 때만)
              Spring (계속 Sleeping)
```

> **저장소가 원본, DB는 사본이다.** `(track, study_date)` 업서트로만 넣으므로
> 전량 재적재(백필)가 언제든 안전하다. DB가 날아가도 저장소에서 복구된다.

---

## 테이블

### `daily_content` — 하루치 원본

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `track` | VARCHAR(16) | `en` · `ja-n1` · `ja-n2` |
| `study_date` | DATE | 학습 날짜 (KST 기준) |
| `passage_note` | VARCHAR(255) | 그날 문단의 종류·주제 한 줄 |
| `sentence_count` | SMALLINT | 항상 5 |
| `word_count` | SMALLINT | 보통 15 |
| `content_json` | JSON | **AI 산출물 전문**(무손실) |
| `selected_json` | JSON | 최종 선별본(페이지에 실제로 보이는 단어) |
| `updated_at` | TIMESTAMP | 마지막 적재 시각 |

기본키 `(track, study_date)`.

### `daily_word` — 단어 단위 (검색·조인용)

| 컬럼 | 설명 |
|---|---|
| `track`, `study_date` | 어느 날 어느 트랙에 나온 단어인지 |
| `headword` | 표제어 |
| `reading` | 읽기 (일본어만, 영어는 NULL) |
| `pos` | 품사 |
| `ko` | 뜻 |
| `example`, `example_ko` | 예문과 해석 |
| `note` | 암기를 돕는 지식 한 줄(어원·혼동어 등) |

기본키 `(track, study_date, headword)`, `headword` 인덱스 있음.
`daily_content`에서 **파생**되는 테이블이라 적재할 때마다 그날 것을 지우고 다시 넣는다.

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

-- 그날 단어 목록
SELECT headword, reading, pos, ko, example, note
  FROM daily_language.daily_word
 WHERE track = 'ja-n1' AND study_date = '2026-09-04';

-- JSON 안을 직접 파고들 수도 있다(MySQL 5.7+)
SELECT JSON_EXTRACT(content_json, '$.sentences[0].en') AS first_sentence
  FROM daily_language.daily_content
 WHERE track = 'en' AND study_date = '2026-09-04';
```

`content_json` 구조는 `prompts/generator.en.md`의 스키마 예시와 같다
(`schema_version`, `lang`, `date`, `passage_note`, `sentences[]`, `words[]`).

---

## 진도 기록도 같은 스키마에 있다

Spring에서 학습 콘텐츠와 사용자 진도를 조인할 수 있다.

```sql
SELECT c.study_date, c.passage_note, s.level
  FROM daily_language.daily_content c
  LEFT JOIN daily_language.study_log s
         ON s.track = c.track AND s.study_date = c.study_date AND s.user_id = ?
 WHERE c.track = 'en'
 ORDER BY c.study_date DESC;
```

`users`(구글 계정)와 `study_log`(진도)는 `api/README.md` 참고.

---

## 적재 운영

```bash
# 하루치 (워크플로가 자동으로 함)
INGEST_TOKEN=... node scripts/publish.js --lang en --date 2026-09-04

# 전량 백필 — 처음 켤 때, 또는 DB를 다시 만들었을 때
INGEST_TOKEN=... node scripts/publish.js --all

# 적재 현황
INGEST_TOKEN=... node scripts/publish.js --summary
```

필요한 설정 두 가지:

| 어디 | 이름 | 값 |
|---|---|---|
| Railway (daily-language 서비스) | `INGEST_TOKEN` | 랜덤 문자열. **비워 두면 적재 엔드포인트가 꺼진다** |
| GitHub 저장소 Secrets | `INGEST_TOKEN` | 위와 같은 값 |
| GitHub 저장소 Secrets | `PUBLISH_URL` | (선택) API 주소. 없으면 `site.js`의 `API_BASE`를 쓴다 |

시크릿이 없으면 워크플로가 **적재만 건너뛰고** 학습 페이지 생성은 그대로 진행한다.
적재 스텝은 `continue-on-error`라 실패해도 그날 콘텐츠 커밋에는 영향이 없고,
나중에 `--all` 백필로 따라잡으면 된다.
