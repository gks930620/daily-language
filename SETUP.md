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
| ① | **전용 계정 비밀번호** | 내가 직접 정함 (1단계) | `DB_PASSWORD` |
| ② | **Railway API 주소** | Railway가 발급 (3단계) | `PUBLIC_URL` + 구글 콘솔 |
| ③ | **구글 클라이언트 ID** | 구글 콘솔 (4단계) | `GOOGLE_CLIENT_ID` |
| ④ | **구글 클라이언트 보안 비밀번호** | 구글 콘솔 (4단계) | `GOOGLE_CLIENT_SECRET` |
| ⑤ | **세션 서명 키** | 내가 생성 (5단계) | `SESSION_SECRET` |

⚠️ **①③④⑤는 절대 저장소에 커밋하지 않는다.** Railway 환경변수에만 넣는다.

---

## 1단계 · 기존 MySQL 안에 스키마 나누기

**MySQL 서비스를 새로 만들지 않는다.** 지금 쓰는 인스턴스에 데이터베이스 하나(`daily_language`)를
더 만들어 기존 `railway` 데이터베이스와 나란히 둔다.

```
total_mysql 인스턴스 (기존 — 여러 프로젝트가 이미 나눠 쓰고 있다)
├── railway            ← Railway 기본 데이터베이스
├── businesscard_qr    ← 기존 Spring 프로젝트 (그대로 둔다)
└── daily_language     ← 이번에 추가한다
```

### (1) 접속

내 PC에서 붙을 땐 **공개 프록시** 주소를 쓴다. Railway MySQL 서비스 → **Variables**의
`MYSQL_PUBLIC_URL`이 그 값이다(`RAILWAY_TCP_PROXY_DOMAIN` / `RAILWAY_TCP_PROXY_PORT` 사용).

Railway 대시보드의 MySQL 서비스 → **Data** 탭에서 바로 쿼리를 실행해도 된다.

### (2) 실행

`api/schema.sql`을 연다. 맨 위쪽 `CHANGE_ME`를 **내가 정한 비밀번호**로 바꾼다 → 이게 **값 ①**.

```sql
CREATE USER IF NOT EXISTS 'daily_language'@'%' IDENTIFIED BY 'CHANGE_ME';
                                                              ^^^^^^^^^ 여기
```

바꾼 내용 전체를 실행한다. 기존 `railway` 데이터베이스는 건드리지 않는다.

- [ ] `daily_language` 데이터베이스 생성됨
- [ ] `daily_language` 계정 생성됨 (권한은 이 DB에만)
- [ ] `users` · `study_log` 테이블 생성됨

확인:

```sql
SHOW DATABASES;                     -- railway 와 daily_language 둘 다 보이면 성공
SHOW TABLES IN daily_language;      -- users, study_log
```

> **왜 root를 그대로 안 쓰나**: Railway가 준 `MYSQLUSER`는 `root`이고 인스턴스 전체 권한을 갖는다.
> 그 값을 이 API에 넣으면, 여기서 문제가 생겼을 때 **기존 `railway` 데이터베이스까지 노출된다.**
> 전용 계정은 `daily_language`에만 권한이 있어서 사고 반경이 이 프로젝트 안으로 갇힌다.
> root는 이 스키마를 만들 때 한 번만 쓰고 끝낸다.

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
- [ ] MySQL과 **같은 프로젝트·같은 환경**에 만들었는지 확인

> 지금 단계에서 **배포가 실패하는 게 정상이다.** 환경변수가 아직 없어서
> `환경변수 GOOGLE_CLIENT_ID이(가) 없습니다` 같은 로그를 남기고 죽는다. 5단계에서 해결된다.

### DB 연결 = 참조 변수 (기존 Spring과 같은 방식)

Railway에는 서비스를 묶는 별도의 "연결" 버튼이 없다. **다른 서비스의 값을 `${{서비스이름.변수}}`로
참조하는 것이 곧 연결**이다. 기존 Spring 서비스가 이렇게 하고 있는 것과 같다.

```
SPRING_DATASOURCE_URL="jdbc:mysql://${{total_mysql.MYSQLHOST}}:${{total_mysql.MYSQLPORT}}/businesscard_qr?..."
SPRING_DATASOURCE_USERNAME="${{total_mysql.MYSQLUSER}}"
SPRING_DATASOURCE_PASSWORD="${{total_mysql.MYSQLPASSWORD}}"
```

이 API도 똑같이 **호스트·포트·계정·비밀번호·DB이름을 각각** 넣는다(5단계에 표로 있다).

**딱 하나 다른 점 — 계정은 참조하지 않고 직접 적는다.** Spring이 참조하는
`${{total_mysql.MYSQLUSER}}`·`${{total_mysql.MYSQLPASSWORD}}`는 **root**다. 이 API가 root로 붙으면
여기가 뚫렸을 때 `businesscard_qr`까지 열린다. 그래서 1단계에서 만든 전용 계정
(`daily_language`)을 직접 적어, 사고 반경을 이 프로젝트 데이터베이스 안에 가둔다.

| | 호스트·포트 | 계정·비밀번호 |
|---|---|---|
| 기존 Spring | `${{total_mysql.…}}` 참조 | `${{total_mysql.…}}` 참조 (= root, 인스턴스 전체 권한) |
| 이 API | `${{total_mysql.…}}` 참조 | **전용 계정을 직접 입력** (daily_language DB에만 권한) |

지킬 것 두 가지:

1. **MySQL과 같은 프로젝트, 같은 환경(environment)에 만들 것.** 다른 프로젝트에 만들면 참조가
   해석되지 않는다.
2. **서비스 이름을 정확히 쓸 것** — 지금은 `total_mysql`이다(대소문자 구분). 이름을 바꾸면 참조도
   같이 고쳐야 한다.

직접 타이핑 대신 Variables 화면의 **Add Reference**로 골라도 된다 — 결과는 같은 `${{...}}`다.

> 내부 네트워크는 컨테이너가 뜬 직후 잠깐 준비 중일 수 있다. 이 API는 **첫 질의 때** DB에 붙기
> 때문에(부팅만으로는 붙지 않는다) 그 시점에는 이미 준비가 끝나 있다.

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

Railway → 2단계에서 만든 **API 서비스** → **Variables** 탭에 아래 **10개**를 넣는다.

`${{total_mysql.…}}` 부분은 기존 Spring 서비스와 같은 참조 방식이다(2단계 설명 참고).
`total_mysql`은 지금 MySQL 서비스의 이름이다 — 이름이 다르면 그에 맞게 바꾼다.

**① 구글 로그인**

| 이름 | 값 |
|---|---|
| `GOOGLE_CLIENT_ID` | 값 ③ (`....apps.googleusercontent.com`) |
| `GOOGLE_CLIENT_SECRET` | 값 ④ |

**② 이 서비스 자신**

| 이름 | 값 |
|---|---|
| `PUBLIC_URL` | 값 ② — **끝에 `/` 없이** (`https://xxxx.up.railway.app`) |
| `SESSION_SECRET` | 값 ⑤ (`openssl rand -base64 32`) |
| `ALLOWED_ORIGINS` | `https://gks930620.github.io` |

**③ DB 접속 — 항목별로 나눠 넣는다**

| 이름 | 값 | 설명 |
|---|---|---|
| `DB_HOST` | `${{total_mysql.MYSQLHOST}}` | 참조 — 내부 주소 |
| `DB_PORT` | `${{total_mysql.MYSQLPORT}}` | 참조 — 보통 3306 |
| `DB_USER` | `daily_language` | **직접 입력** (root 아님) |
| `DB_PASSWORD` | 값 ① | **직접 입력** — 1단계에서 정한 비밀번호 |
| `DB_NAME` | `daily_language` | **직접 입력** — `railway`나 `businesscard_qr` 아님 |

비밀번호에 `@ : / ?` 같은 문자가 있어도 괜찮다. 항목별로 받기 때문에 URL 파싱을 거치지 않는다.

> **한 줄로 넣고 싶다면**: `DB_*` 다섯 개 대신 `DATABASE_URL` 하나만 넣어도 된다.
> `mysql://daily_language:비밀번호@${{total_mysql.MYSQLHOST}}:${{total_mysql.MYSQLPORT}}/daily_language`
> 이 경우엔 비밀번호에 특수문자가 있으면 URL이 깨지므로 영문·숫자로만 만든다.
> 둘 다 넣으면 `DB_*`가 우선한다.

⚠️ **기존 MySQL 서비스(`total_mysql`)의 변수는 건드리지 않는다.** 그건 기존 프로젝트가 쓰는 값이다.
여기서 하는 일은 API 서비스 쪽에 변수를 넣는 것뿐이다.

> `PORT`는 Railway가 자동으로 넣어 준다. 직접 넣지 않는다.
> `SESSION_SECRET`을 바꾸면 모든 사용자가 로그아웃된다(기록은 그대로 남는다).

- [ ] 환경변수 10개 입력함 (DB_* 다섯 개 포함)
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

## 7단계 · 학습 사이트에 연결

여기까지 하면 서버는 준비됐다. 마지막으로 학습 사이트가 그 주소를 알게 해준다.

`scripts/lib/site.js`를 열어 **값 ②**를 넣는다. 이 한 줄이 전부다.

```js
export const API_BASE = 'https://xxxx.up.railway.app';
```

그리고 다시 빌드해서 올린다.

```bash
node scripts/build.js
git add -A && git commit -m "진도 기록 API 주소 연결" && git push
```

- [ ] `API_BASE`에 주소 넣음
- [ ] 빌드·push 완료

> 직접 하기 번거로우면 **값 ② 주소만 알려주면 대신 해준다.**
> 비밀값(①③④⑤)은 알려줄 필요 없다 — 서버 안에만 있으면 된다.

몇 분 뒤 GitHub Pages에 반영되면, 학습 페이지 하단의 진도 버튼이 살아나고
[내 기록](https://gks930620.github.io/daily-language/me/) 페이지가 채워진다.

---

## 참고 · App Sleeping은 켜지 않는 걸 권한다

Spring 같은 JVM 앱은 가만히 둬도 GC·JIT 스레드가 돌아 sleeping이 남는 장사지만,
이 API는 성격이 다르다. 실측값:

| | 이 API (Node) | Spring Boot (일반적) |
|---|---|---|
| 유휴 메모리 | **약 55~60 MB** | 300~500 MB |
| 유휴 CPU (30초 측정) | **0초 — 측정 단위 미만** | 계속 돎 |
| 프로세스 기동 | 0.6초 | 수 초 이상 |

요청이 없으면 Node는 이벤트 루프가 OS 수준에서 잠들어 **CPU를 아예 안 쓴다.** 그래서 켜 두는
비용은 사실상 메모리 60MB어치뿐이고, 월 1달러가 안 된다(정확한 단가는 Railway 요금표 확인).

반면 sleeping을 켜면 **손해가 더 크다.** 이 앱의 사용 패턴은 "하루 몇 번, 한 번에 요청 하나"라
몰아치는 구간이 없다. 즉 **거의 모든 요청이 콜드 스타트**를 겪는다. 하필 그 요청이
"진도 버튼 탭"이라 방금 만든 "탭 한 번, 즉시 기록"이 매번 몇 초짜리 대기로 바뀐다.
로그인은 구글을 거쳐 돌아오는 다단계라 중간에 깨어나면 더 어색하다.

**절약액은 커피 한 잔 값이 안 되는데, 대가는 매번 체감된다.** 켜 두는 쪽을 권한다.

다만 DB 커넥션은 아껴 둔다 — MySQL 인스턴스를 기존 프로젝트와 공유하므로, 놀고 있는 커넥션은
30초 뒤 반납하고 최대 1개만 유지한다(`api/src/db.js`). 커넥션 풀은 **첫 질의 때** 만들어지므로,
아무도 안 쓰는 동안에는 DB에 붙지도 않는다.

---

## 막혔을 때

Railway 서비스 → **Deployments → 로그**를 먼저 본다. 원인이 대부분 거기 찍힌다.

| 증상 | 원인·해결 |
|---|---|
| 구글이 **`redirect_uri_mismatch`** 오류 | 구글 콘솔의 리디렉션 URI와 `PUBLIC_URL`+`/auth/callback`이 다르다. `https`인지, 끝에 `/`가 붙지 않았는지 확인 |
| 구글이 **`access_denied`** / 접근 차단 | 동의 화면이 테스트 상태인데 그 계정이 테스트 사용자에 없다. 계정 추가하거나 앱 게시 |
| `/health`가 **`{"ok":false,...}`** | `DATABASE_URL`이 틀렸거나 DB 권한 문제. 비밀번호·호스트·포트 확인, 1단계 SQL이 실제로 실행됐는지 확인 |
| 로그에 **`환경변수 XXX이(가) 없습니다`** | 5단계에서 그 변수가 빠졌다 |
| 로그에 **`DB 접속 정보가 없습니다`** | `DB_HOST`~`DB_NAME` 다섯 개를 넣었는지 확인(또는 `DATABASE_URL` 한 줄) |
| 로그에 **`DB_HOST를 넣었으면 …도 필요합니다`** | 메시지에 적힌 변수가 빠졌다 |
| 배포가 계속 실패 | Root Directory가 `api`인지 확인 (저장소 전체를 빌드하려다 실패하는 경우가 많다) |
| 로그인 후 **`?login=failed`** 로 돌아옴 | 로그에 실제 사유가 찍힌다. 대개 리디렉션 URI 불일치나 쿠키 차단(시크릿 모드에서 재시도) |

---

## 참고

- 서버 설계·엔드포인트·`AUTH_MODE` 설명: [`api/README.md`](api/README.md)
- 나중에 도메인을 붙이면 더 안전한 쿠키 방식으로 올릴 수 있다(사용자·기록 그대로 유지).
  방법은 `api/README.md`의 "AUTH_MODE" 절에 있다.
