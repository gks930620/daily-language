# SETUP.md — 진도 기록 켜기

> ✅ **2026-08-10 설정 완료.** 아래는 처음부터 다시 하거나 다른 곳에 옮길 때 쓰는 절차다.
> 현재 API 주소: `https://daily-language-production.up.railway.app`

위에서부터 순서대로 따라 하면 된다. **손으로 SQL 실행할 것 없다.**
데이터베이스(`daily_language`)와 테이블은 서버가 처음 켜질 때 자동으로 만든다 —
Spring이 `createDatabaseIfNotExist=true`로 `businesscard_qr`를 만든 것과 같다.

적어 둘 값 3개:

```
B. Railway 주소       https://__________.up.railway.app
C. 구글 클라이언트 ID  __________.apps.googleusercontent.com
D. 구글 보안 비밀번호  GOCSPX-____________________
```

---

## 1단계 · Railway 서비스

**이미 `daily-language` 서비스를 만들었으면 (3)만 확인하고 2단계로.**

1. **New → GitHub Repo → `gks930620/daily-language`** (total_mysql과 같은 프로젝트에)
2. **Settings**
   - **Root Directory: `api`** ← ⚠️ 이것만 꼭
   - Health Check Path: `/health`
3. **Settings → Networking → Generate Domain** → 나온 주소가 **값 B**

지금 배포는 빨간불이 정상이다(환경변수가 아직 없어서). 4단계에서 살아난다.

---

## 2단계 · 구글 동의 화면

[console.cloud.google.com](https://console.cloud.google.com/) → **API 및 서비스 → OAuth 동의 화면**

- User Type: **외부(External)**
- 앱 이름 / 지원 이메일 / 개발자 연락처만 입력
- **테스트 사용자에 내 구글 계정 추가** (안 하면 나중에 로그인이 거부된다)

---

## 3단계 · 구글 클라이언트 ID

**사용자 인증 정보 → 사용자 인증 정보 만들기 → OAuth 클라이언트 ID**

- 애플리케이션 유형: **웹 애플리케이션**
- **승인된 리디렉션 URI**: 값 B 뒤에 `/auth/callback`

  ```
  https://xxxx.up.railway.app/auth/callback
  ```

- **승인된 JavaScript 원본: 비워 둔다** — 브라우저가 구글을 직접 부를 때만 필요한 항목인데,
  이 방식은 브라우저 → 우리 서버 → 구글 순서라 해당 없다. 안 채워도 저장된다.

→ 나오는 **클라이언트 ID = 값 C**, **보안 비밀번호 = 값 D**

---

## 4단계 · 환경변수

Railway → **daily-language 서비스 → Variables → Raw Editor** →
아래 통째로 붙여넣고 **`<>` 3곳만** 바꾼다.

```
GOOGLE_CLIENT_ID=<값 C>
GOOGLE_CLIENT_SECRET=<값 D>
PUBLIC_URL=<값 B>
SESSION_SECRET=k3Jd8fPq2mXn7Lw5Tz9Rb4Yc6Vh1Gs0A
ALLOWED_ORIGINS=https://gks930620.github.io
DB_HOST=${{total_mysql.MYSQLHOST}}
DB_PORT=${{total_mysql.MYSQLPORT}}
DB_USER=${{total_mysql.MYSQLUSER}}
DB_PASSWORD=${{total_mysql.MYSQLPASSWORD}}
DB_NAME=daily_language
```

아래 7줄은 그대로 두면 된다. → **Deploy**

로그에 이게 뜨면 성공:

```
데이터베이스 확인 완료(daily_language)
테이블 확인 완료(users, study_log)
```

---

## 5단계 · 확인

```bash
curl https://xxxx.up.railway.app/health
# {"ok":true,"authMode":"token"}
```

브라우저에서 `https://xxxx.up.railway.app/auth/start` → 구글 로그인 →
`https://gks930620.github.io/`로 돌아오면 성공.

---

## 6단계 · 사이트에 연결

`scripts/lib/site.js` 한 줄:

```js
export const API_BASE = 'https://xxxx.up.railway.app';
```

```bash
node scripts/build.js
git add -A && git commit -m "진도 기록 API 주소 연결" && git push
```

> **값 B만 알려주면 이 단계는 대신 해준다.**

몇 분 뒤 학습 페이지 하단에 진도 버튼이 생기고
[내 기록](https://gks930620.github.io/daily-language/me/)이 채워진다.

---

## 막혔을 때

Railway → daily-language → **Deployments → 로그**를 본다.

| 로그·증상 | 해결 |
|---|---|
| `환경변수 XXX이(가) 없습니다` | 4단계에서 그 줄이 빠졌다 |
| `DB 접속 정보가 없습니다` | `DB_HOST`~`DB_NAME` 5줄 확인 |
| 배포가 계속 실패 | Root Directory가 `api`인지 확인 |
| `${{total_mysql...}}`이 그대로 문자열로 들어감 | total_mysql과 같은 프로젝트인지, 이름이 맞는지 |
| 구글 `redirect_uri_mismatch` | 3단계 URI와 `PUBLIC_URL` + `/auth/callback`이 다르다 |
| 구글 `access_denied` | 2단계에서 테스트 사용자에 내 계정을 안 넣었다 |
| 로그인 후 `?login=failed` | 로그에 사유가 찍힌다. 대개 리디렉션 URI 불일치 |

그 밖의 것(전용 DB 계정으로 바꾸기, AUTH_MODE, sleeping)은 [`api/README.md`](api/README.md)에.

> MySQL의 데이터베이스와 스키마가 왜 같은 말인지, Oracle·PostgreSQL과 어떻게 다른지는
> [DB-SCHEMA.md](DB-SCHEMA.md)에 정리해 뒀다.
