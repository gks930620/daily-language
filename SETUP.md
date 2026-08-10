# SETUP.md — 진도 기록 켜기

구글 로그인으로 공부 진도를 기록하는 기능을 켜는 절차. **한 번만** 하면 된다.
서버 코드는 이미 `api/` 폴더에 있다. 여기서 하는 건 계정 만들고 값 채워 넣기뿐이다.

> 이 작업을 안 해도 **학습 페이지는 지금처럼 정상 동작한다.** 매일 03:00 콘텐츠 생성과 완전히
> 분리돼 있어서, 설정 전까지는 진도 기록 기능만 비활성 상태다.

---

## 전체 흐름

| 단계 | 하는 일 | 환경변수 |
|---|---|---|
| 1 | MySQL에 `daily_language` DB·계정 만들기 | — |
| 2 | Railway에 API 서비스 만들고 **주소만** 받기 | **안 넣음** |
| 3~4 | 구글 OAuth 동의 화면·클라이언트 ID 만들기 | — |
| 5 | **환경변수 10개를 한 번에 넣기** | ✅ 여기서 |
| 6 | 동작 확인 | — |
| 7 | 학습 사이트에 주소 연결 | — |

2단계에서 배포가 실패하는 건 정상이다(환경변수가 아직 없어서). 5단계까지 가면 살아난다.

## 진행하면서 여기에 적어 두기

4개뿐이다. 각 단계에서 하나씩 나온다.

```
A. DB 비밀번호        (1단계에서 내가 정한다)   ______________________
B. Railway API 주소   (2단계에서 발급된다)      https://__________.up.railway.app
C. 구글 클라이언트 ID  (4단계에서 나온다)        __________.apps.googleusercontent.com
D. 구글 보안 비밀번호  (4단계에서 나온다)        GOCSPX-____________________
```

E(세션 키)는 5단계에서 바로 만들어 바로 넣으므로 적어 둘 필요 없다.

⚠️ **A·D는 저장소에 커밋하지 않는다.** Railway 환경변수에만 넣는다.

---

## 1단계 · MySQL에 `daily_language` 데이터베이스 만들기

MySQL 서비스를 새로 만들지 않는다. 지금 쓰는 `total_mysql` 인스턴스에 데이터베이스 하나를 더 만든다.

```
total_mysql 인스턴스 (기존)
├── railway            ← Railway 기본
├── businesscard_qr    ← 기존 Spring 프로젝트 (그대로 둔다)
└── daily_language     ← 이번에 추가
```

### (1) 비밀번호 정하기

이 프로젝트 전용 DB 계정에 쓸 비밀번호를 정한다. **이게 값 A다.** 위 메모칸에 적어 둔다.

예: `DlStudy2026Pass` — 특수문자를 써도 되지만 헷갈리면 영문+숫자만 쓴다.

### (2) SQL 실행

Railway 대시보드 → **total_mysql 서비스 → Data 탭**에서 아래를 실행한다.
(Data 탭에서 쿼리가 안 되면 MySQL Workbench 등으로 `MYSQL_PUBLIC_URL` 주소에 접속해서 실행한다.)

**`여기에_값_A를_넣는다` 부분만 바꿔서** 통째로 붙여넣으면 된다:

```sql
CREATE DATABASE IF NOT EXISTS daily_language
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'daily_language'@'%' IDENTIFIED BY '여기에_값_A를_넣는다';
GRANT SELECT, INSERT, UPDATE, DELETE ON daily_language.* TO 'daily_language'@'%';
FLUSH PRIVILEGES;

USE daily_language;

CREATE TABLE IF NOT EXISTS users (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  google_sub   VARCHAR(64)  NOT NULL,
  email        VARCHAR(255) NOT NULL,
  name         VARCHAR(100) NULL,
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_google_sub (google_sub)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS study_log (
  user_id    BIGINT UNSIGNED NOT NULL,
  study_date DATE            NOT NULL,
  track      VARCHAR(16)     NOT NULL,
  level      ENUM('little','half','full') NOT NULL,
  updated_at TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, study_date, track),
  KEY idx_date (study_date),
  CONSTRAINT fk_study_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
```

(같은 내용이 `api/schema.sql`에도 있다.)

### (3) 확인

```sql
SHOW DATABASES;                    -- railway, businesscard_qr, daily_language 가 보이면 성공
SHOW TABLES IN daily_language;     -- users, study_log
```

- [ ] `daily_language` 데이터베이스 생성됨
- [ ] `daily_language` 계정 생성됨
- [ ] 테이블 2개 생성됨
- [ ] 값 A(비밀번호)를 메모칸에 적어 둠

> **왜 root를 안 쓰나**: Railway가 준 `MYSQLUSER`는 `root`고 인스턴스 전체 권한을 갖는다.
> 그걸 이 API에 넣으면 여기가 뚫렸을 때 `businesscard_qr`까지 열린다.
> 전용 계정은 `daily_language`에만 권한이 있어 사고 반경이 갇힌다. root는 위 SQL 실행할 때만 쓴다.

---

## 2단계 · Railway에 API 서비스 만들기

> ### 🚨 이 단계에서 환경변수는 **하나도 넣지 않는다**
> 구글 값 2개가 4단계에서야 나오기 때문에, 환경변수는 **5단계에서 10개를 한 번에** 넣는다.
> 여기서 할 일은 **서비스 만들고 주소 받기**, 그것뿐이다.
> **배포가 빨간불(실패)로 끝나는 게 정상이다.** 그대로 두고 3단계로 넘어간다.

**total_mysql과 같은 프로젝트, 같은 환경 안에** 서비스를 하나 더 만든다.
(다른 프로젝트에 만들면 나중에 `${{total_mysql.…}}` 참조가 해석되지 않는다.)

1. **New → GitHub Repo → `gks930620/daily-language`** 선택
2. 생성된 서비스 → **Settings**
   - **Root Directory: `api`** ← ⚠️ 꼭 지정한다. 안 하면 저장소 전체를 빌드하려다 실패한다
   - **Health Check Path: `/health`**
   - Start Command는 비워 둔다(`npm start` 자동 감지)
3. **Settings → Networking → Generate Domain** 클릭
   → `https://xxxx.up.railway.app` 이 나온다. **이게 값 B다.** 메모칸에 적는다.

- [ ] Root Directory = `api`
- [ ] total_mysql과 같은 프로젝트·환경에 만듦
- [ ] 도메인 발급받아 값 B 적어 둠
- [ ] **환경변수는 아무것도 안 넣고** 3단계로 넘어감

배포 로그에 이런 게 찍히면 **정상이다.** 5단계에서 해결된다.

```
Error: 환경변수 GOOGLE_CLIENT_ID이(가) 없습니다. Railway 서비스의 Variables에 넣어 주세요.
```

> **DB를 따로 "연결"하는 버튼은 없다.** 기존 Spring이 `${{total_mysql.MYSQLHOST}}` 같은 참조를
> 쓰는 것과 똑같이, 5단계에서 변수에 참조를 적는 것이 곧 연결이다.

---

## 3단계 · 구글 OAuth 동의 화면

[Google Cloud Console](https://console.cloud.google.com/) → 프로젝트 선택(또는 새로 만들기)
→ **API 및 서비스 → OAuth 동의 화면**

- User Type: **외부(External)**
- 앱 이름 / 사용자 지원 이메일 / 개발자 연락처만 채운다
- 범위(scope)는 **추가하지 않는다**

**누가 로그인할 수 있는지가 여기서 갈린다:**

| 상태 | 로그인 가능한 사람 |
|---|---|
| **테스트** | "테스트 사용자"에 등록한 계정만 |
| **프로덕션(게시됨)** | 구글 계정 있는 누구나 |

혼자 쓸 거면 테스트 상태로 두고 **본인 구글 계정을 테스트 사용자에 추가**한다.

- [ ] 동의 화면 저장됨
- [ ] (테스트 상태면) 내 계정을 테스트 사용자에 추가함

---

## 4단계 · 구글 클라이언트 ID 만들기

**API 및 서비스 → 사용자 인증 정보 → 사용자 인증 정보 만들기 → OAuth 클라이언트 ID**

- 애플리케이션 유형: **웹 애플리케이션**
- **승인된 리디렉션 URI**에 아래를 추가한다. **값 B 뒤에 `/auth/callback`을 붙인 것**이다:

  ```
  https://xxxx.up.railway.app/auth/callback
  ```

  ⚠️ 글자 하나까지 정확해야 한다. `http`로 쓰거나 끝에 `/`를 더 붙이면 구글이 거부한다.

- **승인된 JavaScript 원본은 비워 둔다** (브라우저가 구글을 직접 부르지 않는 방식이라 불필요)

만들면 두 값이 나온다:
- **클라이언트 ID** (`....apps.googleusercontent.com`) → **값 C**
- **클라이언트 보안 비밀번호** (`GOCSPX-...`) → **값 D**

- [ ] 리디렉션 URI 등록함
- [ ] 값 C·D 메모칸에 적어 둠

---

## 5단계 · Railway 환경변수 10개 넣기

먼저 **세션 서명 키**를 만든다(값 E). 아무 32자 이상 랜덤 문자열이면 된다.

```bash
openssl rand -base64 32
```

만들기 귀찮으면 아무렇게나 길게 쳐도 된다: `k3Jd8fPq2mXn7Lw5Tz9Rb4Yc6Vh1Gs0A`

### Raw Editor에 한 번에 붙여넣기 (권장)

Railway → **API 서비스** → **Variables** → 우측 상단 **Raw Editor**.
아래를 통째로 붙여넣고 `<>` 부분 5곳만 실제 값으로 바꾼다.

```
GOOGLE_CLIENT_ID=<값 C — ....apps.googleusercontent.com>
GOOGLE_CLIENT_SECRET=<값 D — GOCSPX-...>
PUBLIC_URL=<값 B — https://xxxx.up.railway.app>
SESSION_SECRET=<값 E — 방금 만든 랜덤 문자열>
ALLOWED_ORIGINS=https://gks930620.github.io
DB_HOST=${{total_mysql.MYSQLHOST}}
DB_PORT=${{total_mysql.MYSQLPORT}}
DB_USER=daily_language
DB_PASSWORD=<값 A — 1단계에서 정한 DB 비밀번호>
DB_NAME=daily_language
```

아래 5줄(`ALLOWED_ORIGINS`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_NAME`)은 **그대로 두면 된다.**
바꿀 곳은 `<>`가 있는 5곳뿐이다.

### 표로 보기

| 이름 | 넣을 값 | 출처 |
|---|---|---|
| `GOOGLE_CLIENT_ID` | `1234-abcd.apps.googleusercontent.com` | 값 C (4단계) |
| `GOOGLE_CLIENT_SECRET` | `GOCSPX-xxxxxxxx` | 값 D (4단계) |
| `PUBLIC_URL` | `https://xxxx.up.railway.app` (끝에 `/` 없이) | 값 B (2단계) |
| `SESSION_SECRET` | 랜덤 32자 이상 | 값 E (지금 만듦) |
| `ALLOWED_ORIGINS` | `https://gks930620.github.io` | 고정 |
| `DB_HOST` | `${{total_mysql.MYSQLHOST}}` | 고정 (참조) |
| `DB_PORT` | `${{total_mysql.MYSQLPORT}}` | 고정 (참조) |
| `DB_USER` | `daily_language` | 고정 |
| `DB_PASSWORD` | 1단계에서 정한 비밀번호 | 값 A (1단계) |
| `DB_NAME` | `daily_language` | 고정 |

- [ ] 10개 다 넣음
- [ ] 자동 재배포되어 초록불(Active)

> `PORT`는 Railway가 자동으로 넣는다. 직접 넣지 않는다.
> **total_mysql 서비스의 변수는 건드리지 않는다.** 여기서 하는 건 API 서비스 쪽 설정뿐이다.
> 비밀번호에 `@ : / ?` 가 있어도 괜찮다 — 항목별로 받아서 URL 파싱을 거치지 않는다.

---

## 6단계 · 확인

**(1) 서버가 살아 있나**

```bash
curl https://xxxx.up.railway.app/health
```

```json
{"ok":true,"authMode":"token"}
```

**(2) 로그인이 되나** — 브라우저에서 아래를 연다.

```
https://xxxx.up.railway.app/auth/start
```

구글 로그인 화면 → 로그인 → `https://gks930620.github.io/`로 돌아오면 **성공**이다.

- [ ] `/health`가 `{"ok":true}`
- [ ] `/auth/start`로 로그인 후 학습 사이트로 돌아옴

---

## 7단계 · 학습 사이트에 연결

`scripts/lib/site.js`를 열어 값 B를 넣는다. 이 한 줄이 전부다.

```js
export const API_BASE = 'https://xxxx.up.railway.app';
```

```bash
node scripts/build.js
git add -A && git commit -m "진도 기록 API 주소 연결" && git push
```

- [ ] `API_BASE`에 값 B 넣음
- [ ] 빌드·push 완료

> 번거로우면 **값 B 주소만 알려주면 대신 해준다.** 비밀값(A·D·E)은 알려줄 필요 없다.

몇 분 뒤 Pages에 반영되면 학습 페이지 하단의 진도 버튼이 살아나고
[내 기록](https://gks930620.github.io/daily-language/me/)이 채워진다.

---

## 막혔을 때

Railway → API 서비스 → **Deployments → 로그**를 먼저 본다. 원인이 대부분 거기 찍힌다.

| 증상 | 원인·해결 |
|---|---|
| 로그: `환경변수 XXX이(가) 없습니다` | 5단계에서 그 변수가 빠졌다 |
| 로그: `DB 접속 정보가 없습니다` | `DB_HOST`~`DB_NAME` 5개를 확인 |
| 로그: `DB_HOST를 넣었으면 …도 필요합니다` | 메시지에 적힌 변수가 빠졌다 |
| 배포가 계속 실패 | Root Directory가 `api`인지 확인 |
| `/health`가 `{"ok":false}` | DB 문제. 값 A(비밀번호)·1단계 SQL 실행 여부·`DB_NAME=daily_language` 확인 |
| `${{total_mysql...}}`이 그대로 문자열로 들어감 | 서비스 이름이 `total_mysql`이 맞는지, 같은 프로젝트·환경인지 확인 |
| 구글: `redirect_uri_mismatch` | 4단계 URI와 `PUBLIC_URL`+`/auth/callback`이 다르다. `https`인지, 끝에 `/`가 없는지 |
| 구글: `access_denied` / 접근 차단 | 동의 화면이 테스트 상태인데 그 계정이 테스트 사용자에 없다 |
| 로그인 후 `?login=failed` | 로그에 실제 사유가 찍힌다. 대개 리디렉션 URI 불일치 |
| `Access denied for user 'daily_language'` | 1단계 SQL이 실행 안 됐거나 값 A가 다르다 |

---

## 참고

- 서버 설계·엔드포인트·`AUTH_MODE`: [`api/README.md`](api/README.md)
- **App Sleeping은 켜지 않는 걸 권한다.** 이 API는 유휴 메모리 55~60MB에 유휴 CPU가 0이라
  (Node는 요청이 없으면 이벤트 루프가 잠든다) 켜 두는 비용이 월 1달러가 안 된다.
  반면 사용 패턴이 "하루 몇 번, 요청 하나"라 sleeping을 켜면 거의 모든 요청이 콜드 스타트가 되어
  "탭 한 번, 즉시 기록"이 매번 몇 초 대기로 바뀐다. Spring(300~500MB + 상시 GC)과는 사정이 다르다.
- 나중에 도메인을 붙이면 `AUTH_MODE=cookie`로 올릴 수 있다(기록 마이그레이션 없음).
  방법은 `api/README.md`의 AUTH_MODE 절에.
