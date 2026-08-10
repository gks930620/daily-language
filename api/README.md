# api/ — 진도 기록 API

학습 콘텐츠 파이프라인(`scripts/`)과 **완전히 분리된** 작은 HTTP 서버다.
매일 03:00 콘텐츠 생성과는 아무 관계가 없고, 이게 죽어도 학습 페이지는 그대로 열린다.

- 하는 일: 구글 로그인 검증 + 진도 기록 저장/조회, 이 둘뿐
- 크론 없음, 상태 없음, 백그라운드 작업 없음 — 한 번 올리면 손댈 일이 거의 없다
- 의존성 둘: `mysql2`(MySQL 프로토콜), `jose`(JWT 검증). 웹 프레임워크는 쓰지 않는다(경로가 4개뿐)

```
GET  /health       살아 있는지 + DB 연결 확인
POST /auth/google  구글 ID 토큰 → 사용자 등록/조회 → 우리 세션 토큰 발급
PUT  /study        진도 1건 기록 (로그인 필요)
GET  /study/me     내 기록 전부 (로그인 필요)
```

## 설정 순서

### 1. 구글 OAuth 클라이언트 ID 발급

[Google Cloud Console](https://console.cloud.google.com/) → **API 및 서비스 → 사용자 인증 정보**
→ **사용자 인증 정보 만들기 → OAuth 클라이언트 ID** → 유형 **웹 애플리케이션**.

**승인된 JavaScript 원본**에 아래를 등록한다(여기 없는 곳에서는 로그인 버튼이 동작하지 않는다):

```
https://gks930620.github.io
```

발급된 클라이언트 ID(`....apps.googleusercontent.com`)를 받아 둔다. **이 값은 공개돼도 되는 값**이라
프런트엔드 소스에도 들어간다. 같이 나오는 클라이언트 **보안 비밀번호는 이 구성에서 쓰지 않는다.**

> 처음이라면 **OAuth 동의 화면**을 먼저 설정해야 한다. 외부(External) + 테스트 상태로 두면
> 등록한 테스트 사용자만 로그인할 수 있고, 게시(Published)하면 누구나 로그인할 수 있다.

### 2. DB와 전용 계정 만들기

Railway MySQL에 접속해 [`schema.sql`](schema.sql)을 실행한다. 실행 전에 `CHANGE_ME`를 실제
비밀번호로 바꾼다.

기존 프로젝트와 **같은 인스턴스를 쓰되 데이터베이스와 계정을 나눈다.** 이 프로젝트에 문제가
생겨도 다른 프로젝트 데이터는 건드릴 수 없게 하는 것이 목적이므로, root 계정을 재사용하지 않는다.

### 3. Railway에 서비스 추가

같은 저장소를 쓰되 **Root Directory를 `api`로** 지정한다(그래야 이 폴더만 빌드·배포된다).

- Build: 자동 감지(`npm install`)
- Start: `npm start`
- Health check path: `/health`

환경변수(Variables):

| 이름 | 값 |
|---|---|
| `GOOGLE_CLIENT_ID` | 1번에서 받은 `....apps.googleusercontent.com` |
| `SESSION_SECRET` | 32자 이상 랜덤 문자열. `openssl rand -base64 32` 등으로 생성 |
| `DATABASE_URL` | `mysql://daily_language:<비밀번호>@<host>:<port>/daily_language` |
| `ALLOWED_ORIGINS` | `https://gks930620.github.io` (쉼표로 여러 개 가능) |
| `SESSION_DAYS` | (선택) 기본 30 |

`PORT`는 Railway가 자동으로 넣어 준다.

> `SESSION_SECRET`을 바꾸면 **모든 사용자가 로그아웃**된다(기록은 그대로 남는다).
> `DATABASE_URL`의 비밀번호는 저장소에 절대 커밋하지 않는다.

### 4. 확인

```bash
curl https://<배포된-주소>/health
# {"ok":true}
```

`{"ok":false,...}`가 나오면 `DATABASE_URL`이나 DB 권한 문제다.

## 로컬에서 돌려 보기

```bash
cd api
npm install
GOOGLE_CLIENT_ID=... SESSION_SECRET=... DATABASE_URL=mysql://... npm start
npm test          # 검증·토큰 로직 단위 테스트 (DB·네트워크 불필요)
```

## 설계 메모

- **신원은 토큰에서만 꺼낸다.** 요청 본문에 `user_id`가 들어와도 무시한다. 남의 기록을 건드릴 수
  있는 경로가 원천적으로 없다(`test/validate.test.js`가 이걸 검사한다).
- **비밀번호를 저장하지 않는다.** 구글이 인증을 대신하므로 해싱·재설정·유출 대응이 필요 없다.
- **구글 토큰은 1시간짜리라 그대로 쓰지 않는다.** 검증 후 우리 세션 토큰(기본 30일)을 발급해
  매시간 재로그인하는 일을 없앤다.
- **`study_log`의 기본키가 (사용자, 날짜, 트랙)**이라 같은 걸 다시 눌러도 덮어쓰기가 된다 —
  저장소의 "나중 기록이 이긴다" 규칙과 같다.
- `TRACKS`·`LEVELS`(`src/config.js`)는 `scripts/lib/langs.js`·`scripts/lib/studylog.js`와
  같은 값을 유지해야 한다. 트랙을 늘리면 양쪽 다 고친다.
