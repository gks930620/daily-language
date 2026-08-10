# api/ — 진도 기록 API

학습 콘텐츠 파이프라인(`scripts/`)과 **완전히 분리된** 작은 HTTP 서버다.
매일 03:00 콘텐츠 생성과는 아무 관계가 없고, 이게 죽어도 학습 페이지는 그대로 열린다.

- 하는 일: 구글 로그인(OAuth 2.0)과 진도 기록 저장/조회, 이 둘뿐
- 크론 없음, 상태 없음, 백그라운드 작업 없음 — 한 번 올리면 손댈 일이 거의 없다
- 의존성 둘: `mysql2`(MySQL 프로토콜), `jose`(JWT 검증). 웹 프레임워크는 쓰지 않는다

```
GET  /health        살아 있는지 + DB 연결 확인
GET  /auth/start    로그인 시작 → 구글로 보냄
GET  /auth/callback 구글이 돌아오는 곳 → 세션 발급 → 원래 페이지로
POST /auth/logout   로그아웃
GET  /auth/me       로그인 상태 확인
PUT  /study         진도 1건 기록 (로그인 필요)
GET  /study/me      내 기록 전부 (로그인 필요)
```

**로그인은 서버가 주도한다.** 브라우저는 구글 SDK를 쓰지 않고, `client_secret`은 서버 밖으로
나가지 않는다. state와 PKCE로 CSRF·코드 탈취를 막고, 돌아갈 주소는 허용 목록으로 검사한다.

---

# 설정 방법

**설정 절차는 [SETUP.md](../SETUP.md)에 있다.** 여기 적지 않는다(두 군데에 있으면 어긋난다).

아래는 그 절차를 이미 마친 뒤 참고할 내용이다.

## 환경변수 전체 목록

| 이름 | 값 | 필수 |
|---|---|---|
| `GOOGLE_CLIENT_ID` | 구글 클라이언트 ID (`....apps.googleusercontent.com`) | ✅ |
| `GOOGLE_CLIENT_SECRET` | 구글 클라이언트 보안 비밀번호 | ✅ |
| `PUBLIC_URL` | 이 서비스의 공개 주소 (끝에 `/` 없이) | ✅ |
| `SESSION_SECRET` | 32자 이상 랜덤 문자열 | ✅ |
| `ALLOWED_ORIGINS` | `https://gks930620.github.io` (쉼표로 여러 개) | ✅ |
| `DB_HOST` `DB_PORT` `DB_USER` `DB_PASSWORD` `DB_NAME` | MySQL 접속 정보(항목별 — 권장). 비밀번호에 특수문자가 있어도 안전하다 | ✅ |
| `DATABASE_URL` | 위 다섯 개 대신 한 줄로. 둘 다 있으면 `DB_*`가 이긴다 | ⬜ |
| `AUTH_MODE` | `token`(기본) 또는 `cookie` — 아래 참고 | ⬜ |
| `SESSION_DAYS` | 로그인 유지 일수, 기본 30 | ⬜ |
| `COOKIE_DOMAIN` | `cookie` 모드에서만. 예: `.example.com` | ⬜ |

> `PORT`는 Railway가 알아서 넣어 준다.
> `SESSION_SECRET`을 바꾸면 **모든 사용자가 로그아웃**된다(기록은 그대로 남는다).

---

# `AUTH_MODE` — 지금은 `token`, 도메인이 생기면 `cookie`

세션을 어디에 보관할지 정하는 값이다.

| | `token` (지금) | `cookie` |
|---|---|---|
| 보관 위치 | 브라우저 localStorage | **HttpOnly 쿠키** |
| XSS로 세션 탈취 | 가능 | **불가능**(JS가 못 읽음) |
| 조건 | 없음 | 프런트와 API가 **같은 사이트**여야 함 |

지금은 프런트가 `gks930620.github.io`, API가 `railway.app`이라 **완전히 다른 사이트**다.
이 상태에서 쿠키를 쓰면 Safari가 서드파티 쿠키로 보고 차단하므로 `token`을 쓴다.

나중에 도메인을 하나 붙여서 이렇게 정리하면:

```
study.내도메인.com       → GitHub Pages (커스텀 도메인)
api.study.내도메인.com   → Railway (커스텀 도메인)
```

같은 사이트가 되므로 환경변수만 바꾸면 더 안전한 쿠키 방식으로 올라간다.

```
AUTH_MODE=cookie
COOKIE_DOMAIN=.study.내도메인.com
ALLOWED_ORIGINS=https://study.내도메인.com
PUBLIC_URL=https://api.study.내도메인.com
```

**사용자와 기록은 그대로 유지된다** — 구글 계정 식별자(`google_sub`)가 기준이라 마이그레이션이 없다.
(구글 콘솔의 리디렉션 URI도 새 주소로 바꿔 주면 된다.)

---

# 로컬에서 돌려 보기

```bash
cd api
npm install
npm test    # 검증·세션·OAuth 거래 로직 단위 테스트 (DB·네트워크 불필요)

GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... PUBLIC_URL=http://localhost:8080 \
SESSION_SECRET=... DATABASE_URL=mysql://... npm start
```

# 설계 메모

- **신원은 세션에서만 꺼낸다.** 요청 본문에 `user_id`가 들어와도 무시한다 — 남의 기록을 건드릴
  경로가 원천적으로 없다(테스트로 고정돼 있다).
- **비밀번호를 저장하지 않는다.** 구글이 인증을 대신하므로 해싱·재설정·유출 대응이 필요 없다.
- **돌아갈 주소는 허용 목록으로 검증한다**(`safeReturnTo`). 이게 없으면 로그인 링크가 아무 사이트로나
  되돌려 보내는 피싱 도구가 된다.
- **PKCE를 `client_secret`과 같이 쓴다.** 인가 코드가 새어도 `code_verifier` 없이는 못 쓴다(방어 이중화).
- **로그인 거래 정보는 서버 메모리가 아니라 서명된 10분짜리 쿠키에 둔다.** 인스턴스가 재시작되거나
  여러 개여도 로그인이 깨지지 않는다.
- `TRACKS`·`LEVELS`(`src/config.js`)는 `scripts/lib/langs.js`·`scripts/lib/studylog.js`와
  같은 값을 유지해야 한다. 트랙을 늘리면 양쪽 다 고친다.

---

# 전용 DB 계정으로 바꾸기 (선택)

기본 설정(SETUP.md)은 기존 Spring 서비스와 같이 **root로 접속**한다. 간단한 대신 이 API가
뚫리면 같은 인스턴스의 다른 데이터베이스(`businesscard_qr` 등)에도 닿을 수 있다.

권한을 `daily_language` 안으로 가두려면 total_mysql에 root로 붙어 한 번만 실행한다:

```sql
CREATE DATABASE IF NOT EXISTS daily_language
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'daily_language'@'%' IDENTIFIED BY '정한_비밀번호';
GRANT ALL PRIVILEGES ON daily_language.* TO 'daily_language'@'%';
FLUSH PRIVILEGES;
```

그리고 환경변수 두 줄만 바꾼다(나머지 8줄은 그대로):

```
DB_USER=daily_language
DB_PASSWORD=정한_비밀번호
```

테이블은 계속 서버가 알아서 만든다. 기록은 그대로 유지된다.

# 데이터베이스·테이블 자동 생성

`ensureSchema()`가 기동할 때 한 번 돈다(여러 번 돌려도 안전).

1. `CREATE DATABASE IF NOT EXISTS <DB_NAME>` — JDBC의 `createDatabaseIfNotExist=true`와 같은 일.
   mysql2에는 그 옵션이 없어서 직접 한다. **권한이 없으면 조용히 건너뛴다**(전용 계정을 쓰는
   경우엔 이미 데이터베이스가 있으므로 문제없다).
2. `CREATE TABLE IF NOT EXISTS users`, `study_log`

계정(`CREATE USER`)은 만들지 않는다 — 전용 계정을 쓸 때만 사람이 한 번 만든다.

# App Sleeping은 켜지 않는 걸 권한다

실측: 유휴 메모리 55~60MB, 유휴 CPU 30초간 0초(Node는 요청이 없으면 이벤트 루프가 OS 수준에서
잠든다), 기동 0.6초. 켜 두는 비용이 월 1달러가 안 된다.

반면 "하루 몇 번, 한 번에 요청 하나"라는 사용 패턴에서는 몰아치는 구간이 없어 **거의 모든 요청이
콜드 스타트**가 된다. 그 요청이 하필 "진도 버튼 탭"이라 매번 몇 초 대기로 바뀐다.
Spring(300~500MB + 상시 GC/JIT)과는 사정이 다르다.
