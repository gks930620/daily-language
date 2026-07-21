# 매일 언어 학습 (daily-language)

매일 아침 GitHub Actions가 이 저장소에서 **그날의 학습 페이지를 자동 생성**하고 GitHub Pages에 게시하는 개인 학습 파이프라인입니다. 언어 트랙은 **영어(en)와 일본어(ja)** 두 개이고, 각각 독립된 SRS 상태로 돌아갑니다. AI는 콘텐츠(문장·단어·회화)만 만들고, 복습 간격 계산(Leitner SRS)·상태 관리·HTML 빌드는 전부 Node 스크립트가 결정론적으로 처리합니다.

## 매일 아침 무엇이 생기나

매일 06:00 KST쯤 새 페이지가 올라옵니다. URL 구조:

- 허브(언어 선택): `https://gks930620.github.io/daily-language/`
- 영어: `https://gks930620.github.io/daily-language/en/`
- 일본어: `https://gks930620.github.io/daily-language/ja/`

하루치 페이지 구성(두 언어 공통):

1. **오늘의 문장 5개** — 원문을 먼저 읽고, 접힌 부분을 열면 한국어 해석과 끊어읽기·문법 구문분석이 나옵니다(일본어는 전문 히라가나 reading도 함께).
2. **오늘의 단어 20개** — 뜻, 예문 표(일본어는 히라가나 읽기 포함). AI가 낸 후보 25개 중 스크립트가 새 단어 20개를 선별해 싣고, 실린 단어만 복습 퀴즈로 돌아온다(중복 등으로 20개에 못 미치는 날도 있음).
3. **오늘의 회화 한 문단** — 생활 주제 하나로 A/B 대화 8~12줄. 문장을 누르면 해석이 열립니다.
4. **복습 퀴즈** — 오늘 복습 주기가 돌아온 단어들. 단어와 예문만 보이고, "정답"을 눌러야 뜻이 나옵니다. 간격은 1·3·7·14·30·60일(6박스 Leitner).
5. **복습 문장 1개** — 3~10일 전에 배운 문장 중 하나를 다시 풀어봅니다.

### 언어별 학습자 프로필

| 트랙 | 프로필(기본 가정) | 난이도 |
|---|---|---|
| 영어(en) | 토익 700, 수능 2등급(10년 전), 회화 초급 | 토익 700→900 구간·수능 고난도·시사 |
| 일본어(ja) | 입문~초급, 히라가나·가타카나 읽기 가능 | JLPT N5~N4 문장, 목표 N4→N3·기초 회화 |

프로필을 조정하려면 `scripts/lib/langs.js`의 해당 언어 `learnerProfile` 한 줄만 고치면 됩니다(프롬프트에는 프로필이 없고 brief.json으로 전달됨).

## 사용법

그냥 페이지를 엽니다. 그게 전부입니다.

- 아침에 페이지 열기 → 문장 5개 해석해 보기 → 정답 확인 → 단어 훑기 → 회화 소리 내어 읽기 → 복습 퀴즈 풀기.
- 어제 것을 못 했으면 하단/상단의 날짜 내비게이션이나 index의 아카이브에서 이동하면 됩니다. 페이지는 전부 정적 HTML이라 폰에서도 즉시 열립니다.

## 최초 설정 절차

1. **GitHub public 저장소 생성** — 이름 `daily-language` (Pages 무료 사용을 위해 public). *(완료: `gks930620/daily-language`)*
2. **이 폴더를 push**
   ```bash
   git init
   git add -A
   git commit -m "initial"
   git branch -M main
   git remote add origin https://github.com/gks930620/daily-language.git
   git push -u origin main
   ```
3. **GitHub Pages 켜기** — 저장소 Settings → Pages → Source: `Deploy from a branch`, Branch: `main`, 폴더 `/docs` → Save.
4. **CI용 구독 토큰 발급·등록** — AI 단계가 Claude Pro/Max **구독 사용량**으로 돌게 하는 토큰(API 토큰당 과금 아님).
   1. 내 PC 터미널에서 `claude setup-token` 실행 → 출력된 URL을 브라우저로 열어 로그인·Authorize.
   2. 브라우저가 보여주는 **코드**(짧음, `#` 포함)를 복사해 **아직 켜져 있는 그 터미널**에 붙여넣고 Enter.
   3. 터미널에 출력되는 **진짜 토큰**(`sk-ant-oat01-...`, 100자+)을 전체 복사. ⚠️ 코드가 아니라 이 토큰이다 — 코드를 넣으면 401.
   4. [저장소 Secrets 페이지](https://github.com/gks930620/daily-language/settings/secrets/actions) → New repository secret → Name: `CLAUDE_CODE_OAUTH_TOKEN`, Secret: 토큰 → Add secret.
   - 토큰은 비밀번호급. Secret 외 어디에도 붙여넣지 않는다. 수명 1년(만료 시 재발급·교체).
   - ⚠️ `ANTHROPIC_API_KEY`는 절대 등록하지 않는다 — 있으면 API가 우선돼 토큰당 과금된다.
5. **첫 수동 실행** — 저장소 Actions 탭 → `daily` 워크플로 → **Run workflow**. 확인할 것: (a) 초록 체크로 끝났는지, (b) `daily: <날짜>` 커밋이 생겼는지, (c) 몇 분 뒤 Pages URL에 오늘 페이지가 뜨는지.

## 문제 해결

| 증상 | 원인/대처 |
|---|---|
| push는 됐는데 페이지가 안 바뀜 | GitHub Pages 반영은 수 분 걸릴 수 있음. 저장소 Actions 탭의 `pages-build-deployment` 완료 후 새로고침(캐시 주의). |
| 워크플로가 실패함 | 그날은 건너뛰어도 됨. 파이프라인은 **날짜 기준 멱등**이고 settle에는 재실행 가드(같은 날 이중 승급·초과 등록 방지)가 있어, 어느 지점에서 죽어도 다음 실행이 안전하게 이어서 처리함. Actions 탭에서 로그 확인. |
| 같은 날 워크플로가 두 번 돎 | `prepare`가 `ALREADY_DONE`을 출력하고 아무것도 하지 않음(정상). |
| generate 단계 401/인증 실패 | Secret에 **코드**를 넣었을 가능성(토큰은 `sk-ant-oat01-` 시작·100자+). 또는 토큰 만료(1년) — `claude setup-token` 재발급 후 Secret 교체. |
| 콘텐츠 검증 실패로 멈춤 | 워크플로가 1회 재생성 후에도 실패하면 그 언어는 커밋 없이 종료(다른 언어 블록은 영향 없음). state는 건드리지 않으므로 다음날 정상 복구. 수동으로 돌리려면 `.claude/skills/daily-run` 절차 참고. |
| 예약 실행이 안 돎 | 공개 저장소는 60일 무활동 시 예약 워크플로 자동 중지(매일 커밋이 생기는 동안은 무관). Actions 탭에서 재활성화. cron은 수 분~수십 분 지연될 수 있음. |

## 실행 구조: GitHub Actions (주 경로)

`.github/workflows/daily.yml`이 매일 21:00 UTC(=06:00 KST)에 실행됩니다. **en 블록 → ja 블록 순서로, 언어별로 커밋**합니다:

1. `prepare.js --lang en`·`prepare.js --lang ja` — 날짜 결정, AI 입력(brief)·퀴즈 동결본(review) 생성. `ALREADY_DONE`인 언어는 해당 블록 전부 생략.
2. (언어별) `claude -p`(헤드리스) — `prompts/generator.<lang>.md` 지침대로 `content.json` 작성. **구독 토큰으로 인증되어 Pro/Max 사용량에서 차감**(API 과금 아님). 허용 도구는 Read/Write/Edit/Glob/Grep뿐 — AI는 git을 만질 수 없음.
3. (언어별) `settle.js --lang <lang>` — 검증·SRS 반영. 검증 실패 시 에러 로그를 주고 content.json만 고치게 해 정확히 1회 재시도.
4. `build.js`(전 언어+허브 재생성) → `verify.js --lang <lang>` — HTML 재생성, 커밋 전 게이트.
5. 그 언어가 전부 성공 시에만 `daily(en): <날짜>` / `daily(ja): <날짜>` 커밋·push (GITHUB_TOKEN, `contents: write`). ja push 직전에는 `git pull --rebase` 보험 1줄.

수동 실행은 Actions 탭의 Run workflow 버튼. 유의: 구독 토큰의 CI 사용은 현재 공식 경로(`claude setup-token`)지만 과금 정책이 바뀔 수 있음 — 그 경우 generate 스텝만 API 키 호출로 교체하면 됨(나머지 파이프라인 불변).

## 예비 경로: claude.ai 클라우드 루틴

Actions가 장기 불안정하면 `prompts/routine.md`의 프롬프트로 claude.ai 루틴(매일 21:00 UTC)을 만들어 같은 파이프라인을 돌릴 수 있습니다. claude.ai의 GitHub 연동(App 설치·저장소 접근 허용)이 필요합니다. 양쪽이 같은 날 겹쳐 돌아도 `ALREADY_DONE` 가드로 안전합니다.
