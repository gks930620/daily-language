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

# 사장님이 하실 일

아래 4단계면 끝난다. **DB 비밀번호나 클라이언트 보안 비밀번호를 저장소에 넣지 않는다** —
전부 Railway 환경변수에만 둔다.

## 1단계 · 구글 OAuth 클라이언트 만들기

[Google Cloud Console](https://console.cloud.google.com/) 접속.

**(1) OAuth 동의 화면** — 처음이면 먼저 설정한다.
- User Type: **외부(External)**
- 앱 이름, 지원 이메일만 채우면 된다
- 범위(scope)는 추가하지 않아도 된다(기본 `openid`/`email`/`profile`만 쓴다)
- **테스트 상태**로 두면 등록한 테스트 사용자만 로그인된다. 남들도 쓰게 하려면 **게시(Published)** 로 바꾼다

**(2) 사용자 인증 정보 → 사용자 인증 정보 만들기 → OAuth 클라이언트 ID**
- 애플리케이션 유형: **웹 애플리케이션**
- **승인된 리디렉션 URI**에 아래를 등록한다. ⚠️ 이 값이 `PUBLIC_URL` + `/auth/callback`과
  **글자 하나까지 정확히** 같아야 한다. 다르면 구글이 로그인을 거부한다.

  ```
  https://<Railway에서-받은-주소>/auth/callback
  ```

  Railway 주소는 3단계에서 정해지므로, **3단계를 먼저 하고 여기로 돌아와도 된다.**

- "승인된 JavaScript 원본"은 **비워 둬도 된다**(브라우저가 구글을 직접 부르지 않는 방식이라 불필요)

만들고 나면 **클라이언트 ID**와 **클라이언트 보안 비밀번호** 두 값이 나온다. 둘 다 필요하다.

## 2단계 · DB와 전용 계정 만들기

Railway MySQL에 접속해 [`schema.sql`](schema.sql)을 실행한다. 실행 전에 파일 안의 `CHANGE_ME`를
직접 정한 비밀번호로 바꾼다.

기존 프로젝트와 **같은 인스턴스를 쓰되 데이터베이스와 계정을 나눈다.** 이 프로젝트에 문제가 생겨도
다른 프로젝트 데이터는 건드릴 수 없게 하는 것이 목적이므로, **root 계정을 재사용하지 않는다.**

## 3단계 · Railway에 서비스 추가

지금 쓰는 Railway 프로젝트에 서비스를 하나 더 만든다. 같은 GitHub 저장소를 연결하되:

- **Root Directory: `api`** ← 이걸 지정해야 이 폴더만 빌드된다
- Start Command: `npm start` (자동 감지되면 그대로 둬도 된다)
- Health Check Path: `/health`
- 배포되면 `https://xxx.up.railway.app` 주소가 나온다 → **1단계의 리디렉션 URI에 등록**하고,
  아래 `PUBLIC_URL`에도 넣는다

### 환경변수 (Variables)

| 이름 | 값 | 필수 |
|---|---|---|
| `GOOGLE_CLIENT_ID` | 1단계의 클라이언트 ID (`....apps.googleusercontent.com`) | ✅ |
| `GOOGLE_CLIENT_SECRET` | 1단계의 클라이언트 보안 비밀번호 | ✅ |
| `PUBLIC_URL` | 이 서비스의 공개 주소 (`https://xxx.up.railway.app`, 끝에 `/` 없이) | ✅ |
| `SESSION_SECRET` | 32자 이상 랜덤 문자열. `openssl rand -base64 32` | ✅ |
| `DATABASE_URL` | `mysql://daily_language:<비밀번호>@<host>:<port>/daily_language` | ✅ |
| `ALLOWED_ORIGINS` | `https://gks930620.github.io` (쉼표로 여러 개) | ✅ |
| `AUTH_MODE` | `token` (기본값) 또는 `cookie` — 아래 설명 참고 | ⬜ |
| `SESSION_DAYS` | 로그인 유지 일수, 기본 30 | ⬜ |
| `COOKIE_DOMAIN` | `cookie` 모드에서만. 예: `.example.com` | ⬜ |

> `PORT`는 Railway가 알아서 넣어 준다.
> `SESSION_SECRET`을 바꾸면 **모든 사용자가 로그아웃**된다(기록은 그대로 남는다).

## 4단계 · 확인

```bash
curl https://<Railway-주소>/health
# {"ok":true,"authMode":"token"}
```

`{"ok":false,...}`가 나오면 `DATABASE_URL`이나 DB 권한 문제다.

그리고 이 주소를 브라우저에서 직접 열어 로그인이 되는지 본다:

```
https://<Railway-주소>/auth/start
```

구글 로그인 화면이 뜨고, 로그인하면 `https://gks930620.github.io/?...`로 돌아오면 성공이다.

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
