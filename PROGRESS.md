# PROGRESS.md — 진행 체크포인트 (세션 끊겨도 여기서 이어받기)

> 갱신 규칙: 작업 단위가 끝날 때마다 이 파일을 갱신하고 커밋·push한다. 새 세션은 이 파일 + `git log --oneline -15`로 상태를 복원한다.

**마지막 갱신**: 2026-08-10

## 최신 (2026-08-10) — 진도 기록을 다중 사용자로: 구글 OAuth + Railway MySQL

**아직 동작하지 않는다.** 서버 코드는 다 있지만 사용자가 구글 콘솔·Railway 설정을 해야 켜진다 → **[SETUP.md](SETUP.md)**. 프런트엔드도 아직 안 붙였다(아래 "다음 할 일").

- **왜**: 사용자가 "회원가입 열되 콘텐츠는 모두 같은 걸 보고 진도 기록만 각자"(B안)를 선택. 기존 GitHub 이슈 체크인은 저장소 주인 전용이라 다중 사용자와 공존이 안 된다.
- **왜 각자의 구글 드라이브가 아니라 중앙 DB인가**: 사용자 판단 — "나중에 통계 낼 거면 내가 관리해야 한다". 드라이브 방식은 데이터가 각자에게 흩어져 **나중에 집계로 갈아탈 수 없다**(남의 드라이브를 읽을 방법이 없다).
- **왜 Supabase가 아니라 Railway인가**: 브라우저는 MySQL에 직접 못 붙는다(TCP 불가 + 자격증명 노출). 어느 쪽이든 "DB 앞의 HTTP API"가 필요한데, Supabase는 그걸 남이 운영해 주는 것뿐이다. Railway MySQL이 이미 있으니 직접 올리면 업체가 안 늘어난다.
- **왜 GIS가 아니라 서버 OAuth인가**: 사용자 지적 — "서버가 생겼으니 거기서 oauth2 하면 되지 않냐". 맞다. GIS를 고른 전제(client_secret 둘 곳이 없음)가 서버가 생기며 사라졌다. 서버 주도로 바꾸니 client_secret이 브라우저에 안 나가고, 나중에 카카오·네이버 확장도 같은 방식으로 된다.
- **AUTH_MODE 두 가지**: 지금은 `token`(localStorage) — github.io ↔ railway.app이 서로 다른 사이트라 쿠키가 Safari에서 차단된다. **도메인을 붙여 같은 사이트로 모으면 `cookie`(HttpOnly)로 승격**하면 되고, `google_sub`가 사용자 기준이라 **기록 마이그레이션이 없다**.
- **보안 장치**: state+PKCE(CSRF·코드 탈취 이중 방어), 로그인 거래는 서명된 10분 쿠키(인스턴스 재시작에도 안 깨짐), `safeReturnTo`로 돌아갈 주소 허용 목록 검증(열린 리다이렉트=피싱 방지), 신원은 세션에서만 — 본문의 user_id는 무시.
- **DB 격리**: 기존 프로젝트와 같은 인스턴스를 쓰되 `daily_language` DB + 전용 계정. root 재사용 금지.
- 검증: API 테스트 14 통과. 로컬 기동해 리다이렉트 URL에 client_secret 없음·악성 return이 허용 목록으로 대체됨·위조 state 차단·구글 거부 처리·미인증 401 확인.

### 다음 할 일 (프런트엔드 — Railway API 주소가 나오면)

1. `docs/assets/app.js` 신규: 로그인 버튼, 진도 버튼 → `PUT /study` fetch, 내 기록 페이지 → `GET /study/me`
2. `build.js`가 `docs/days.json`(트랙별 콘텐츠 날짜) 출력 — **통계 분모**. DB는 어느 날 콘텐츠가 있었는지 모른다
3. `scripts/lib/studylog.js`를 `docs/assets/`로 복사 배포 — 순수 함수라 **브라우저에서 그대로 재사용**(통계 로직 두 벌 방지, 기존 테스트 12개 그대로 유효)
4. 기존 GitHub 이슈 체크인 제거(`checkin.yml`·`scripts/checkin.js`·`state/study-log.json`)
5. `docs/`에 JS 첫 도입 — CLAUDE.md 규칙 5 갱신 필요

## (이전) 2026-08-06 — 공부 진도 기록 기능 추가(GitHub 이슈 방식)

사용자 요구: "이 날 공부했는지 체크하고, 나중에 내 페이지에서 얼마나 했는지 보고 싶다. 회원가입 안 되면 나만 써도 좋음." + 추가 확정: **"단순 방문 여부가 아니라 사용자가 직접 얼마나 했는지 체크하는 식으로."**

- **회원가입은 만들지 않았다.** GitHub Pages는 서버가 없어 로그인·비밀번호 저장이 불가능하고, 혼자 쓰는 데 불필요하다. 대신 **저장소 주인만 기록할 수 있는 구조**로 만들었다(워크플로가 `issue.user.login == repository_owner`를 확인).
- **기록 방식(사용자 선택)**: 브라우저 저장(localStorage)이 아니라 **GitHub 이슈 체크인 → 저장소에 영구 기록**. 근거는 ARCHITECTURE.md [A12] — localStorage는 기기마다 따로 놀고 브라우저 정리하면 사라져 "나중에 얼마나 했나"라는 목적 자체에 안 맞고, docs/에 JS를 처음 들이게 된다. 지금 방식은 **JS 0줄 유지**.
- **기록 단위(사용자 선택)**: 트랙별 × 진도 3단계(조금 30 / 절반 60 / 다 함 100). 방문 여부 아님.
- **흐름**: day 페이지 하단 버튼 3개 → 제목이 채워진 GitHub 이슈 → Submit → `checkin.yml`이 제목 파싱 → `checkin.js`가 `state/study-log.json` 갱신 → `build.js` 재빌드 → 커밋·push → 이슈에 결과 댓글 후 닫기. 1~2분 소요.
- **새 파일**: `scripts/checkin.js`(study-log의 유일한 작성자), `scripts/lib/studylog.js`(순수 함수), `scripts/lib/site.js`(REPO·이슈 제목 형식의 단일 소스 — 워크플로 정규식과 짝), `.github/workflows/checkin.yml`, `docs/me/index.html`(빌드 산출물).
- **내 기록 페이지**: 트랙별 평균 진도(%)·기록한 날·단계별 일수·현재/최장 연속 + 날짜별 표(칸 누르면 그날 페이지). 허브 홈에 "📊 내 기록" 버튼.
- 설계 판단 두 가지: ① 분모는 **콘텐츠가 있던 날**만 센다(파이프라인이 안 돈 날을 게으름으로 세면 기록이 거짓말이 된다). ② 연속은 가장 최근 하루를 유예한다(오늘 콘텐츠가 막 생겼는데 연속이 0으로 보이면 안 된다).
- 같은 날·트랙을 다시 누르면 **나중 기록이 이긴다**(오타 정정, 아침 "조금" → 저녁 "다 함").
- 검증: 테스트 66 통과(studylog 12개 신규), 체크인 CLI 실동작·멱등·정정·거부(콘텐츠 없는 날/잘못된 단계) 확인, 내 기록 페이지 렌더 확인 후 시험 기록 삭제.

## (이전) 2026-08-05 — 사용자 피드백 2건

- **day 페이지 "홈" 링크가 엉뚱한 곳으로 가던 버그 수정**. `../index.html`이라 **그 트랙의 아카이브**(docs/en/index.html)로 갔다. day 페이지는 `docs/<lang>/days/` 아래라 사이트 홈(허브)까지 두 단계를 올라가야 한다 → `../../index.html`. 39개 day 페이지 전부 재생성, 내부 링크 222개 전부 실존 확인. 회귀 테스트 추가(`renderDayNav`).
- **영어 발음 음성은 이미 완성·정상 작동**이었다(2026-08-04 15단어 URL 재확인: HTTP 200 · audio/mpeg). 사용자가 "완성됐는지 모르겠다"고 한 것은 **재생 버튼이 눈에 안 띄어서** — 네이티브 `<audio>`를 2.25×1.75rem으로 줄여 놔 버튼처럼 안 보였다. 2.75×2.1rem으로 키우고 테두리·배경(--border/--surface)을 줘 "누를 수 있는 것"으로 보이게 했다. JS는 여전히 0줄.
- **"항상 커밋·push"가 사용자 지시로 확정**됐다(묻지 말 것). push 전 `git pull --rebase` — 워크플로가 매일 커밋을 올린다.

## (이전) 2026-08-04 — 전체 검토 후 정리

전체 검토에서 **화면(문단 + 단어 15)은 아무도 불만이 없는데 그 뒤에 죽은 기계가 돌고 있다**는 게 드러나 걷어냈다. 사용자 확정: "퀴즈는 필요없어. 별도 복습도 필요없고. 현재 화면이 나쁘지 않다."

- **SRS(간격 반복 복습) 전면 제거** — 최우선 문제였다. 2026-07-22에 복습 퀴즈를 화면에서 뺐는데 `settle`의 승급 로직은 남아, **화면에 보인 적 없는 단어에 `shown` 기록이 매일 쌓이고 box가 올라가고 있었다**(13일 만에 트랙당 195단어 중 180개). 그대로 뒀으면 약 4개월 뒤 아무도 못 본 단어들이 `graduated`로 순환을 마쳤다. 설계 근거는 ARCHITECTURE.md [A10].
  - 남은 단어 규칙은 하나뿐: **한 번 나온 단어는 그 트랙에서 다시 나오지 않는다**(known_words + settle의 코드 dedup).
  - `srs.js` → **`wordbank.js`**(`newWordEntry`·`migrateWordsState`만). `review.json`은 파이프라인에서 제거 + 과거 39개 파일 삭제(렌더에 안 쓰이면서 하루 25~36KB씩 쌓이던 중).
  - **words.json v1 → v2**: `{ added_on }`만 남기고 SRS 필드·card 스냅샷 제거. `settle`이 쓸 때 자동 승격(멱등)이라 **트랙별로 다음 03:00 실행 한 번에 정리된다** — 지금 저장소의 state는 아직 v1이고 그게 정상이다. 크기는 트랙당 184KB → 약 10KB.
- **워크플로 트랙 독립** — 명시적 `if:`가 암묵적으로 `success()`와 AND되는 탓에 **en이 실패하면 ja 두 트랙이 통째로 skip**됐다. 모든 스텝을 `!cancelled() && <자기 트랙 앞 단계>.outcome == 'success'`로 바꿔 트랙 간 의존을 끊고 트랙 내 순서는 유지. en 블록에도 `git pull --rebase` 추가, job에 `timeout-minutes: 90`. 근거는 [A11].
- **죽은 코드·고아 산출물 정리**: prepare의 복습문장 선택·`recent_conversation_topics`(회화 제거 후 13일 내내 빈 배열이었다), html.js의 renderConversation/renderQuiz/renderReviewSentence/renderWordKnowledge, validate의 conversation 스키마, 링크되지 않던 `docs/preview/`·`preview-formats.js`, 언어 축 이전 기준이라 실행하면 틀리는 `prompts/routine.md`.
- **문서 드리프트 수정**: ARCHITECTURE/README/PLAN/CLAUDE/daily-run 스킬에 남아 있던 "신규 20개·후보 25개·하루 복습 120개"와 낡은 verify 마커(`<tr class="word-row">`)를 실제 값(15/18, `<article class="word-item">`)으로.
- **검증**: 39개 day 페이지 재빌드 후 **docs diff 0**(화면 완전 무변경), 테스트 54 통과, 3트랙 verify 통과, 가짜 날짜(2026-09-01) 전 파이프라인 1사이클 + 멱등 재실행 + 마이그레이션까지 확인 후 원복.
- 알려진 성질(고친 것 아님): `build.js`는 페이지를 쓰기만 하고 지우지 않는다 — 날짜 폴더를 지우고 재빌드하면 그 html이 고아로 남는다(daily-run 스킬 E절에 경고 추가).
- 손대지 않은 것: 발음 음성(A9), 문단 형식(A8), 단어 지식 note/family/related(A7), 콘텐츠 프롬프트의 품질 기준.

## (이전) 2026-08-04

- **영어 표제어 발음 음성 추가**. 단어 옆 재생 버튼 하나(예문·문장에는 안 붙임 — 사용자 요구). 음원 URL을 headword에서 결정적으로 생성하므로 스키마·SRS·파이프라인 무변경이고 **과거 13일치까지 소급 적용**된다. 트랙 스위치는 `langs.js`의 `ttsLang`(en만 켬, ja는 후리가나가 발음을 대신해 null). JS는 여전히 0줄(네이티브 `<audio>` + CSS 축소). 설계 근거는 ARCHITECTURE.md [A9].
  - **주의**: 음성 엔드포인트는 Referer가 붙으면 404다. `page()`의 `<meta name="referrer" content="no-referrer">`를 지우면 전 페이지 음성이 통째로 죽는다.
  - 검증: 2026-08-04 en 15단어 URL 전부 200·audio/mpeg 확인, 테스트 55 통과.
- 레거시 정리: 언어 축 개편 이전 잔재 `docs/ja/index.html`·빈 `data/ja/` 삭제.
- 파이프라인은 07-24 ~ 08-04까지 3트랙 12일 연속 무결점 자동 생성 중(트랙당 누적 195단어).

## (이전) 2026-07-23, 커밋 adaa07c

- **기초 교재(basics) 전체 삭제** — 사용자: "책보다 하기 힘들다". basics/·docs/basics·markdown.js·build.js basics 로직·허브 📚 버튼·basics CSS 전부 제거.
- **일본어 reading 개편**: passage "전문 읽기"(전체 히라가나) 제거. 문장 분석 reading = **원문 후리가나 인라인**(`漢字(かんじ)`), 렌더 클래스 `.furigana`. (words[].reading은 히라가나 유지.)
- **끊어읽기 `/` 제거**(영어·일본어): structure에서 첫 `/` 줄 삭제, `·` 문법 포인트만. generator×2·fixtures×2 반영.
- **일일 데이터·SRS 전부 초기화**(구 형식 제거) — 내일 03:00부터 새 형식으로 클린 생성. 현재 daily 페이지는 비어 있음(정상).

## 완료·push됨

- 3트랙 파이프라인 가동 중: en / ja-n1 / ja-n2, 매일 03:00 KST (`daily.yml`)
- 2026-07-21 실데이터: 세 트랙 모두 생성 완료(en은 새벽 자동, ja 둘은 수동 실행)
- 단어 지식 기능(note 필수·family·related, 연관 클러스터) — 커밋 d1a3794, 내일부터 콘텐츠에 적용
- 기초 커리큘럼 로드맵: `basics/ja/README.md`

## 완료·push됨 (2026-07-22)

| 작업 | 산출 위치 | 상태 |
|---|---|---|
| A. 허브 날짜 리스트 + B. 오늘의 문단(passage) | scripts/·prompts/·fixtures/·tests/·docs/ | ✅ 커밋 9e92f1b·210a3dd (테스트 46) |
| 일일 데이터 초기화(07-21·07-22 제거, SRS 리셋) | data/·docs/·state/ | ✅ 커밋 248c7ab — **07-23부터 클린 시작** |
| 기초 1권 대화 입문 8주 48유닛 2640줄 | basics/ja/book1-conversation/ | ✅ bf39d8f |
| 기초 2권 기본 문법(5단/1단/불규칙) 2208줄 | basics/ja/book2-grammar/ | ✅ f12759e |
| 기초 3권 필수 표현 445개 12챕터 | basics/ja/book3-expressions/ | ✅ bf39d8f |
| 기초 4권 필수 한자 311자 10챕터 | basics/ja/book4-kanji/ | ✅ acd2a48 |
| 대안 구성 v01~v10 (구성+1단원 샘플) | basics/ja/versions/ | ✅ bf39d8f·acd2a48 |

## 버전 삭제 + 교재 가독성 개선 (2026-07-23)

- 사용자: 버전 1~10 다 필요없음 → `basics/ja/versions` 전체 삭제(인덱스 그룹도 제거).
- 교재 페이지 가독성: 접이식 **목차**(h2 앵커, 3개+일 때), 타이포(행간 1.8·섹션 구분선·헤딩 계층), 표 얼룩무늬+가로스크롤, 책 제목 인용 스타일. build.js `withToc()` + style.css `.md-content`.
- 기초 교재 = book1~4만. https://gks930620.github.io/daily-language/basics/

<details><summary>(이전) 기초 버전 v01~v10 = 실제 1과 10가지 구성 (2026-07-22, 삭제됨)</summary>

- 사용자 재확정: 요약 아님. **4권 실제 1과 전체**(book1 week1 + book2 part1 + book3 ch01 + book4 ch01)를 담고, **구성/표현만 10가지**로. "둘 다 섞어서"(표현+구성).
- v01 순서합본 / v02 표중심 / v03 자가테스트(접기) / v04 카드 / v05 낭독 / v06 순서재배치 / v07 통합흐름 / v08 한국어대조 / v09 데이별Day1~7 / v10 패턴드릴. 각 876~1300줄, JS0·후리가나·표·접기 보존.
- 배치로 병렬 생성·push(빌더가 세션한도로 "failed" 떠도 파일은 써졌던 경우 있음 — 항상 파일 실존·줄수로 검증 후 push).
- URL: https://gks930620.github.io/daily-language/basics/ → "1과 · 방식 비교".

## (이전) 기초 버전 v01~v10 개념형 재구성 (2026-07-22, 커밋 3a92bad — 폐기됨)

- 사용자 요구: v1~v10을 "컨셉 설명"이 아니라 **같은 1과 학습 내용(대화·문법·표현·한자)을 10가지 표현 방식으로**. 나란히 보고 공부하기 편한 방식 고르기.
- v01~v10.md 새로 작성(옛 개념명 파일 삭제): 표/대화몰입/스텝/미니멀/후리가나낭독/자가테스트/카드/통문장/한국어대조/패턴치환. 파일 맨 위 `# 버전 N`만.
- basics 인덱스: 로드맵 사설 제거 → 깔끔한 탭 메뉴, "1과·방식 비교" 맨 앞. → https://gks930620.github.io/daily-language/basics/
- **앞으로 규칙**: daily-language 변경은 항상 커밋+push까지(사용자는 사이트에서 확인).

## 기초 교재 웹 열람 (2026-07-22, 커밋 1f81598)

- `basics/` md 49개 → `docs/basics/` html 49개(build.js가 렌더, 외부 의존성 0 마크다운 변환기 `scripts/lib/markdown.js`). 표·`<details>` 정상, `.md`→`.html` 링크 재작성.
- 허브 홈(docs/index.html)에 **📚 기초 교재 버튼** → `docs/basics/index.html`(로드맵 + 자동 목차 트리: 대화입문·기본문법·필수표현·필수한자·대안구성 v01~10).
- URL: https://gks930620.github.io/daily-language/basics/ · 테스트 55 통과.

## 일일 페이지 확정 (2026-07-22, 커밋 6713f4d)

- **최종 포맷**: 문단 + 단어 15개(클러스터형: 어원·파생·혼동어 칩). **회화·복습퀴즈·복습문장 제거**(추후 재설계, 렌더러는 코드에 남김). 단어 25→15(후보18→선별15).
- 3트랙 시뮬 통과(문장5·단어15·회화없음·퀴즈없음·JS0), 테스트 46, data/state 원복 클린.
- 확인용 샘플: https://gks930620.github.io/daily-language/preview/ (실제 일일 렌더러로 렌더).
- 내일 03:00(KST) 실행부터 이 포맷으로 첫 실데이터 생성.

<details><summary>이전: 표현 포맷 5종 프리뷰 (선택 완료)</summary>

사용자 방향 전환: 스키마를 바꾸지 말고 **내용은 그대로(단어 20개면 같은 20개), 보여주는 포맷만 5가지**로 만들어 비교·선택. 스키마 개편(지문5개 등)은 보류 — 포맷 선택 후 반영.

- ✅ 커밋 a254546: `scripts/lib/formats.js`(renderFormat1~5), `scripts/preview-formats.js`, `docs/preview/`(6페이지), style.css `fmt-` 클래스. 파이프라인·스키마 무변경, 테스트 46 유지.
- 프리뷰 URL: **https://gks930620.github.io/daily-language/preview/**
- 5포맷: ①정통 교재형 ②플래시카드(액티브 리콜)형 ③맥락 우선(스토리)형 ④미니멀 한눈에형 ⑤심화 클러스터형.
- **사용자가 번호 고르면 → 그 포맷을 html.js 일일 렌더의 기본으로 채택** + (원하면) 지문5개·회화 실제출처(AI추정 안내) 등 콘텐츠 튜닝 반영.
- 이전에 논의된 미반영 아이디어: 지문 5개 확장(현재 문단 1개 유지), 회화 실제 작품 출처(회화 자체를 제거해 보류), 단어 연관 강화(note/family/related로 반영됨).
</details>

## 세션이 끊겼을 때 이어받는 법

1. `git log --oneline -15`와 이 표를 대조 — 어느 산출물이 커밋됐는지 확인.
2. `basics/ja/` 하위 폴더별 파일 존재 여부로 책 4권·버전 10개 완성도 확인. 빠진 것은 해당 행의 스펙(각 폴더 README 또는 PLAN.md 철학 절 참고)으로 재생성.
3. A/B(허브·문단)가 미완이면: 스펙은 아래 "A/B 요구사항 요약" 참고. 완료 판정 게이트: `npm test` 통과 + `node scripts/build.js` 후 `node scripts/verify.js --lang {en,ja-n1,ja-n2} --date 2026-07-21` 셋 다 통과 + docs/index.html이 날짜 리스트인지 확인.
4. 커밋 규칙: 에이전트 동시 작업 중엔 `git add -A` 금지(경로 명시 add). basics/는 콘텐츠라 테스트 게이트 불필요.
5. push 전 `git pull --rebase` (워크플로가 daily 커밋을 수시로 올림).

### A/B 요구사항 요약 (사용자 확정)

- **A 허브**: docs/index.html = 날짜 내림차순, 날짜마다 그 날짜 데이터가 있는 트랙 링크(영어·일본어 N1·일본어 N2). build.js가 생성.
- **B 문단**: content.json에 `passage_note`(주제 한 줄) 필수 추가. sentences 5개는 한 편의 글에서 이어진 문단을 순서대로 자른 것(en 120~180단어, 수능 한 문제 분량). 렌더: passage_note 있을 때만 문단 블록(문장 이어붙임, ja는 전문 reading 접기) → 그 아래 기존 문장별 구문분석. 프롬프트 2종·픽스처 2종·validate·테스트 갱신.

## 그 다음 남은 것

- 내일 03:00 실행 관찰: en 퀴즈에 단어 20개(box 1→2), 문단 형식 첫 적용, ja 두 트랙 note 첫 적용
- 사용자: versions 10개 보고 마음에 드는 구성 선택 → 해당 방식으로 본편 재작업 여부 결정
- N2 한자 1000+ 문서: 보류(사용자 결정)

</details>
