# SETUP.md — 진도 기록 기능 설정 (내가 할 일)

공부 진도를 구글 로그인으로 기록하려면 **한 번만** 해두면 되는 준비 작업이다.
서버 코드는 이미 `api/` 폴더에 있다. 여기서 하는 건 **계정 만들고 값 채워 넣기**뿐이다.

> 이 작업을 안 해도 **학습 페이지는 지금처럼 정상 동작한다.** 매일 03:00 콘텐츠 생성과는
> 완전히 분리돼 있어서, 설정이 끝나기 전까지는 진도 기록 기능만 비활성 상태다.

소요 시간 30분쯤. 순서대로만 하면 왔다 갔다 할 일이 없다.

---

## 먼저 — 채워 나갈 값 5개

진행하면서 아래 값이 하나씩 나온다. 메모장에 적어 두고 마지막에 Railway에 몰아 넣으면 편하다.

| # | 값 | 어디서 나오나 | 어디에 넣나 |
|---|---|---|---|
| ① | **DB 비밀번호** | 내가 직접 정함 (2단계) | `DATABASE_URL` |
| ② | **Railway API 주소** | Railway가 발급 (3단계) | `PUBLIC_URL` + 구글 콘솔 |
| ③ | **구글 클라이언트 ID** | 구글 콘솔 (4단계) | `GOOGLE_CLIENT_ID` |
| ④ | **구글 클라이언트 보안 비밀번호** | 구글 콘솔 (4단계) | `GOOGLE_CLIENT_SECRET` |
| ⑤ | **세션 서명 키** | 내가 생성 (5단계) | `SESSION_SECRET` |

⚠️ **①③④⑤는 절대 저장소에 커밋하지 않는다.** Railway 환경변수에만 넣는다.

---

## 1단계 · DB와 전용 계정 만들기

Railway의 기존 MySQL에 접속한다(Railway 대시보드 → MySQL 서비스 → **Data** 탭 또는 **Connect**).

`api/schema.sql` 파일을 연다. 맨 위쪽 `CHANGE_ME`를 **내가 정한 비밀번호**로 바꾼다 → 이게 **값 ①**.

```sql
CREATE USER IF NOT EXISTS 'daily_language'@'%' IDENTIFIED BY 'CHANGE_ME';
                                                              ^^^^^^^^^ 여기
```

바꾼 내용 전체를 MySQL에 실행한다.

- [ ] `daily_language` 데이터베이스 생성됨
- [ ] `daily_language` 계정 생성됨
- [ ] `users` · `study_log` 테이블 생성됨

> **왜 root를 안 쓰나**: 이 인스턴스에는 다른 프로젝트 DB도 같이 있다. 전용 계정을 쓰면
> 이 프로젝트에 문제가 생겨도 **다른 프로젝트 데이터는 건드릴 수 없다.** root를 재사용하면
> 그 격리가 사라진다.

---

## 2단계 · Railway에 서비스 추가

지금 쓰는 Railway **프로젝트 안에** 서비스를 하나 더 만든다.

1. **New → GitHub Repo → `gks930620/daily-language`** 선택
2. 생성된 서비스 → **Settings**
   - **Root Directory: `api`** ← ⚠️ 이걸 꼭 지정한다. 안 하면 저장소 전체를 빌드하려다 실패한다
   - **Health Check Path: `/health`**
   - Start Command는 비워 두면 된다(`npm start` 자동 감지)
3. **Settings → Networking → Generate Domain** 클릭
   → `https://xxxx.up.railway.app` 주소가 나온다 → 이게 **값 ②**

- [ ] Root Directory가 `api`로 설정됨
- [ ] 도메인 발급받아 값 ② 메모함

> 지금 단계에서 **배포가 실패하는 게 정상이다.** 환경변수가 아직 없어서
> `환경변수 GOOGLE_CLIENT_ID이(가) 없습니다` 같은 로그를 남기고 죽는다. 5단계에서 해결된다.

---

## 3단계 · 구글 OAuth 동의 화면

[Google Cloud Console](https://console.cloud.google.com/) → 프로젝트 만들기(또는 기존 것 선택)
→ **API 및 서비스 → OAuth 동의 화면**

- User Type: **외부(External)**
- 앱 이름, 사용자 지원 이메일, 개발자 연락처만 채운다
- 범위(scope)는 **추가하지 않는다** (기본 `openid`/`email`/`profile`만 쓴다)

**중요 — 누가 로그인할 수 있는지가 여기서 갈린다:**

| 상태 | 누가 로그인되나 |
|---|---|
| **테스트** | "테스트 사용자"에 등록한 계정만 (본인 구글 계정을 꼭 추가) |
| **프로덕션(게시됨)** | 구글 계정 있는 누구나 |

혼자 쓸 거면 테스트 상태로 두고 **본인 계정을 테스트 사용자에 추가**하면 된다.
남들도 쓰게 하려면 **앱 게시**를 누른다.

- [ ] 동의 화면 설정 완료
- [ ] (테스트 상태라면) 내 구글 계정을 테스트 사용자에 추가함

---

## 4단계 · 구글 클라이언트 ID 만들기

**API 및 서비스 → 사용자 인증 정보 → 사용자 인증 정보 만들기 → OAuth 클라이언트 ID**

- 애플리케이션 유형: **웹 애플리케이션**
- **승인된 리디렉션 URI**에 아래를 추가한다 — **값 ②** 뒤에 `/auth/callback`을 붙인 것:

  ```
  https://xxxx.up.railway.app/auth/callback
  ```

  ⚠️ **글자 하나까지 정확해야 한다.** 끝에 `/`를 더 붙이거나 `http`로 쓰면 구글이 로그인을 거부한다.

- "승인된 JavaScript 원본"은 **비워 둔다** (브라우저가 구글을 직접 부르지 않는 방식이라 불필요)

만들면 **클라이언트 ID**(값 ③)와 **클라이언트 보안 비밀번호**(값 ④)가 나온다. 둘 다 메모.

- [ ] 리디렉션 URI 등록함 (값 ② + `/auth/callback`)
- [ ] 값 ③ · ④ 메모함

---

## 5단계 · Railway 환경변수 채우기

**값 ⑤(세션 서명 키)** 를 먼저 만든다. 32자 이상 랜덤 문자열이면 된다.

```bash
openssl rand -base64 32
```

Railway → 2단계에서 만든 서비스 → **Variables** 탭에 아래를 넣는다.

| 이름 | 값 |
|---|---|
| `GOOGLE_CLIENT_ID` | 값 ③ (`....apps.googleusercontent.com`) |
| `GOOGLE_CLIENT_SECRET` | 값 ④ |
| `PUBLIC_URL` | 값 ② — **끝에 `/` 없이** (`https://xxxx.up.railway.app`) |
| `SESSION_SECRET` | 값 ⑤ |
| `DATABASE_URL` | `mysql://daily_language:①@<host>:<port>/daily_language` |
| `ALLOWED_ORIGINS` | `https://gks930620.github.io` |

`DATABASE_URL`의 `<host>`·`<port>`는 Railway MySQL 서비스의 **Variables**나 **Connect** 탭에 있다.
같은 프로젝트 안이면 내부 호스트(`mysql.railway.internal`)를 써도 된다.

> `PORT`는 Railway가 자동으로 넣어 준다. 직접 넣지 않는다.

- [ ] 환경변수 6개 입력함
- [ ] 자동 재배포되어 초록불(Active)로 바뀜

---

## 6단계 · 확인

**(1) 서버가 살아 있나**

```bash
curl https://xxxx.up.railway.app/health
```

```json
{"ok":true,"authMode":"token"}
```

**(2) 로그인이 되나** — 브라우저에서 아래 주소를 연다.

```
https://xxxx.up.railway.app/auth/start
```

구글 로그인 화면이 뜨고 → 로그인하면 → `https://gks930620.github.io/`로 돌아오면 **성공**이다.

- [ ] `/health`가 `{"ok":true}`
- [ ] `/auth/start`로 로그인 후 학습 사이트로 돌아옴

---

## 다 되면 알려줄 것

**Railway API 주소(값 ②)** 하나만 알려주면 된다. 그걸로 학습 페이지에 로그인 버튼과
진도 버튼을 붙인다. (값 ①③④⑤는 알려줄 필요 없다 — 서버 안에만 있으면 된다.)

---

## 막혔을 때

Railway 서비스 → **Deployments → 로그**를 먼저 본다. 원인이 대부분 거기 찍힌다.

| 증상 | 원인·해결 |
|---|---|
| 구글이 **`redirect_uri_mismatch`** 오류 | 구글 콘솔의 리디렉션 URI와 `PUBLIC_URL`+`/auth/callback`이 다르다. `https`인지, 끝에 `/`가 붙지 않았는지 확인 |
| 구글이 **`access_denied`** / 접근 차단 | 동의 화면이 테스트 상태인데 그 계정이 테스트 사용자에 없다. 계정 추가하거나 앱 게시 |
| `/health`가 **`{"ok":false,...}`** | `DATABASE_URL`이 틀렸거나 DB 권한 문제. 비밀번호·호스트·포트 확인, 1단계 SQL이 실제로 실행됐는지 확인 |
| 로그에 **`환경변수 XXX이(가) 없습니다`** | 5단계에서 그 변수가 빠졌다 |
| 배포가 계속 실패 | Root Directory가 `api`인지 확인 (저장소 전체를 빌드하려다 실패하는 경우가 많다) |
| 로그인 후 **`?login=failed`** 로 돌아옴 | 로그에 실제 사유가 찍힌다. 대개 리디렉션 URI 불일치나 쿠키 차단(시크릿 모드에서 재시도) |

---

## 참고

- 서버 설계·엔드포인트·`AUTH_MODE` 설명: [`api/README.md`](api/README.md)
- 나중에 도메인을 붙이면 더 안전한 쿠키 방식으로 올릴 수 있다(사용자·기록 그대로 유지).
  방법은 `api/README.md`의 "AUTH_MODE" 절에 있다.
