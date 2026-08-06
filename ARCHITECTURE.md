# ARCHITECTURE.md — 구현 구조

## 파이프라인

```
        (매일 03:00 KST, GitHub Actions `.github/workflows/daily.yml`이 트랙별로 실행: en → ja-n1 → ja-n2)

  ┌─────────┐   ┌──────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────┐
  │ prepare │──▶│ generate │──▶│ settle  │──▶│ build   │──▶│ verify  │──▶│ git │
  │  (코드)  │   │   (AI)   │   │  (코드)  │   │  (코드)  │   │  (코드)  │   │ (CI) │
  └─────────┘   └──────────┘   └─────────┘   └─────────┘   └─────────┘   └─────┘
       │              │              │             │             │
  brief.json     content.json   words.json    docs/*.html   exit 0/1
   (한 파일)      (한 파일만)    selected.json  (전체 재생성)   (커밋 게이트)
                                 runlog 마킹

  읽기: state/<lang> ──▶ prepare        settle ◀── data/<lang>/<날짜>/*   build ◀── data/*/*/
  쓰기: data/<lang>/<날짜>/ ◀── prepare  state·selected.json ◀── settle    docs/ ◀── build
```

핵심 원칙: **AI는 `data/<lang>/<날짜>/content.json` 하나만 만든다.** 중복 판정, 상태 갱신, HTML 빌드는 전부 결정론적 Node 스크립트다. 파일이 기억이고(state/), 날짜는 코드가 KST 기준으로 계산해 주입하며, runlog가 멱등 키다. **트랙(en·ja-n1·ja-n2, 트랙 = 언어×난이도)은 디렉터리 네임스페이스로 완전 분리**되고, 트랙별 설정의 단일 소스는 `scripts/lib/langs.js`다. 콘텐츠 철학: 기초는 정해진 커리큘럼으로 각자 학습하고, 생성 콘텐츠는 **기초 완료자의 매일 30분·흥미 유지**용이다(ja는 JLPT N1/N2 취득자 두 난이도).

## 디렉터리 지도 (트랙 축 — `<lang>` ∈ en·ja-n1·ja-n2)

```
data/<lang>/<날짜>/            brief.json · content.json · selected.json
state/<lang>/                  words.json · runlog.json  (트랙별 독립 단어 장부·멱등 키)
docs/index.html                허브(전 트랙 날짜 합집합의 내림차순 리스트 — 날짜마다 있는 트랙만 링크)
docs/<lang>/index.html         언어 인덱스(최신 하루치 + 아카이브)
docs/<lang>/days/<날짜>.html    하루치 페이지
docs/assets/ · docs/.nojekyll  루트 유지(공유)
prompts/generator.{en,ja}.md   generate 지침(ja 파일은 ja-n1·ja-n2 두 트랙이 공유)
fixtures/sample-content.{en,ja}.json  픽스처(ja 파일은 두 ja 트랙 공유 — mock이 lang을 실행 트랙으로 덮어씀)
```

## 파일·스크립트 역할

| 경로 | 역할 |
|---|---|
| `scripts/lib/langs.js` | **트랙 레지스트리(단일 소스, 트랙 = 언어×난이도)**: label·pageTitle·learnerProfile·newWordCandidates·maxNewWords·promptFile·fixtureFile·requiresReading·ttsLang + `resolveLang(argv)`. 학습자 프로필 문자열은 여기에만 있다. ja-n1/ja-n2는 promptFile·fixtureFile을 공유하고 난이도는 learnerProfile(→ brief.json)로 주입된다. |
| `scripts/prepare.js` | 하루의 시작(`--lang` 필수). settled면 `ALREADY_DONE` 후 종료. known_words 수집 → `brief.json` 하나 생성. runlog에 `prepared_at` 기록. |
| `scripts/settle.js` | content.json 검증(lang 교차검증 포함) → 코드 dedup(NFKC 정규화) → 신규 단어 장부 등록(최대 15개) → 최종 선별본 `selected.json` 동결 → runlog에 settled 마킹. **words.json을 쓰는 유일한 스크립트**이고, 쓰기 직전에 `migrateWordsState`로 스키마를 승격시킨다. settled면 no-op. 재실행 가드: `added_on === 오늘`은 신규 쿼터에 포함 — 크래시 후 재실행에도 초과 등록 없음. |
| `scripts/build.js` | **`--lang`을 받지 않는 유일한 스크립트.** 전 언어의 `data/<lang>/*/`(content+selected)를 스캔 → `docs/<lang>/days/*.html` + `docs/<lang>/index.html` + 허브 `docs/index.html`을 처음부터 재생성. "오늘의 단어"는 selected.json 기준(없는 과거 데이터만 content.words 폴백). 단어 장부(state/)를 읽지 않는 순수 재생성. |
| `scripts/verify.js` | 오늘분(`--lang` 필수) HTML 존재·개수 일치(문장 5, 단어 = selected.json 단어 수)·settled·허브 존재 확인. 마커는 문장 `<li class="sentence">`, 단어 `<article class="word-item">`. 실패 시 exit 1 → 워크플로가 커밋하지 않음. |
| `scripts/mock-generate.js` | AI 대역(로컬 시뮬레이션, `--lang` 필수). 픽스처의 `{{DATE}}` 치환 후 **lang을 실행 트랙으로 덮어씀**(픽스처 공유 대응). `--unique`는 headword에 날짜 접미사를 붙여 다일 시뮬레이션 중복 회피. |
| `scripts/lib/dates.js` | KST 오늘 계산, `--date` 오버라이드, 날짜 가감. **날짜의 유일한 소스.** |
| `scripts/lib/store.js` | JSON/텍스트 원자적 쓰기(tmp+rename), 루트 경로, 상태 파일 읽기(`readWordsState(lang)`·`readRunlog(lang)` — lang 필수). |
| `scripts/lib/wordbank.js` | 순수 함수: 장부 항목 생성(`newWordEntry`), 스키마 승격(`migrateWordsState`). 파일 I/O 없음(언어 무관). 2026-08-04까지는 `srs.js`(6박스 Leitner)였다 — [A10] 참조. |
| `scripts/lib/validate.js` | content.json 수제 스키마 검증. `validateContent(content, date, lang)` — content.lang 교차검증, requiresReading 언어는 reading 필수. 실패 필드의 경로를 찍는다. |
| `scripts/lib/html.js` | 이스케이프 + 페이지 템플릿. JS 0줄, 네이티브 `<details>`·`<audio>`만. **언어 분기 없음 — "reading 있으면 렌더"·"ttsLang 있으면 발음 음성" 규칙만.** 페이지 본문은 `renderDaySections(content, ttsLang)` = 문장(문단) + 단어(클러스터)뿐이다. ja의 문장 reading은 원문에 후리가나를 인라인으로 단 형태(`class="furigana"`). 회화·퀴즈·복습문장 렌더러는 2026-08-04에 삭제(git 이력 참조). |
| `prompts/generator.en.md` / `prompts/generator.ja.md` | generate 단계(AI)의 지침. ja 파일은 두 트랙 공유 — 난이도 캘리브레이션 표(N1/N2 취득자)를 내장하고 brief의 learner_profile로 구분. 입력 brief.json, 출력 content.json 하나. 프로필은 brief.json 참조(재기재 금지). |
| `.github/workflows/daily.yml` | 주 실행 경로. prepare ×3 → [EN 블록: generate→settle→build+verify→commit "daily(en): DATE"] → [JA-N1 블록: 동일] → [JA-N2 블록: 동일]. 모든 push 직전 `git pull --rebase`. settle 스텝은 `set -o pipefail`(기본 셸은 pipefail 꺼짐 — 없으면 tee가 실패를 가림). **트랙 독립**: 모든 스텝 조건이 `!cancelled() && <자기 트랙 앞 단계>.outcome == 'success'` — 앞 트랙 실패가 뒤 트랙을 막지 않는다([A11]). `timeout-minutes: 90`. |
| `state/<lang>/words.json` | 트랙별 단어 장부 — "이 단어는 이미 나왔는가"(아래 스키마). |
| `state/<lang>/runlog.json` | 언어별 날짜별 실행 기록 = 멱등 키. |
| `data/<lang>/<날짜>/` | 하루치 산출물: brief.json(AI 입력), content.json(AI 출력), selected.json(settle의 최종 단어 선별본 = 페이지 렌더 기준). |
| `docs/` | GitHub Pages 루트. **빌드 산출물** — 직접 수정 금지. `.nojekyll` 필수. |
| `fixtures/sample-content.<lang>.json` | 실제 품질 수준의 하루치 샘플(시뮬레이션·테스트 공용). |

## 상태 스키마

### state/\<lang\>/words.json — 단어 장부 (키 = NFKC·소문자 정규화된 headword)

```json
{
  "schema_version": 2,
  "words": {
    "mitigate": { "added_on": "2026-07-20" }
  }
}
```

- 이 파일이 답하는 질문은 하나다: **"이 단어는 이미 나왔는가, 언제 나왔는가."** 유일한 소비자는 prepare의 `known_words`(같은 단어를 다시 내지 않기 위한 목록)와 settle의 dedup이다.
- 그날 페이지에 보이는 단어 내용(뜻·예문·note·family·related)은 `data/<lang>/<날짜>/selected.json`이 날짜별로 갖는다. 장부에 중복 보관하지 않는다.
- **schema_version 2 (2026-08-04)**: v1의 SRS 필드(top-level `intervals`, 항목별 `box`·`next_due`·`last_seen`·`graduated`·`history`)와 `card` 스냅샷을 제거했다. 승격은 `wordbank.js`의 `migrateWordsState`가 하고, **settle이 words.json을 쓸 때마다 통과**시키므로 트랙별로 다음 실행 한 번에 자동 정리된다(멱등). 배경은 [A10].

### state/\<lang\>/runlog.json (날짜 = 멱등 키)

```json
{
  "schema_version": 1,
  "runs": {
    "2026-07-20": {
      "prepared_at": "...", "settled": true, "settled_at": "...",
      "built_at": "...", "content_sha256": "...",
      "notes": ["중복 단어 2개 제외: resilient, viable"]
    }
  }
}
```

`settled: true`가 그날(그 언어)의 완료 표식이다. prepare는 이 값만 보고 재실행 여부를 정한다.

## AI 입출력 (data/\<lang\>/\<날짜\>/)

- **brief.json** (prepare → AI): `date`, `learner_profile`(langs.js가 단일 소스), `new_word_candidates_requested`(18 → settle이 최종 15개 선별), `known_words` 넷뿐이다.
  - known_words는 3,000개 이하면 전체, 초과 시 최근 추가 1,000개만(전환 로직 내장). 오래된 단어와 겹쳐도 settle의 코드 dedup이 최종 방어.
- **content.json** (AI → settle): 문단 1개(문장 5로 분해) + 단어 후보 15~18개. 최상위 `lang` 필수(--lang과 교차검증). **스키마 키는 언어 무관하게 고정**: `en` = 대상 언어 텍스트, `ko` = 한국어. requiresReading 트랙(ja-n1·ja-n2)은 sentences[]·words[]에 `reading` 필수. 검증 규칙은 validate.js 참조.
  - **passage_note**(문자열, **전 트랙 필수**): sentences는 서로 무관한 5문장이 아니라 **하나의 글에서 이어진 한 문단**(en: 수능 한 문제 분량 120~180단어)을 순서대로 자른 것이고, passage_note는 그 글의 종류·주제 한 줄이다. 렌더는 passage_note가 **있을 때만** 문장 분석 위에 문단 원문 블록(ja는 전문 reading 접기 포함)을 붙인다 — 없는 과거 데이터(무관한 5문장)는 기존 형태 그대로(하위 호환).
  - **words[] 단어 지식 필드**: `note`(문자열, **전 트랙 필수**) — 암기를 돕는 지식 한두 줄(어원·파생 규칙·혼동어 차이·뉘앙스·기억법). `family`(배열, 선택) — 파생형/같은 한자 단어군, 항목은 `{word 필수, pos 선택, ko 필수}`. `related`(배열, 선택) — 혼동어·유의어·반의어, 항목은 `{word 필수, note 필수, ko 선택}`. 렌더는 "있으면 렌더"(reading과 동일) — note 없는 과거 데이터(2026-07-21 이전)도 깨지지 않는다.
- **selected.json** (settle → build·verify): 그날 실제로 장부에 등록된 최종 단어(최대 15개)의 동결본. 페이지의 "오늘의 단어"와 verify의 개수 검사는 이 파일이 기준이다. 후보 18개 중 중복 제외·쿼터 초과분은 페이지에도 장부에도 들어가지 않아 "보이는 단어 = 장부에 남는 단어"가 보장된다. 장부 기준(`added_on === 그날`)으로 만들므로 재실행해도 같은 내용이 재생성된다.

## 단어 중복 방지 규칙 (트랙별 독립)

이 저장소에 복습·간격 반복(SRS)은 없다. 단어에 대한 규칙은 **"한 번 나온 단어는 그 트랙에서 다시 나오지 않는다"** 하나뿐이다.

- prepare가 장부의 headword 전부를 `known_words`로 brief에 실어 AI에게 "이건 피하라"고 알린다.
- AI의 회피는 노력 목표일 뿐이고, **최종 방어는 settle의 코드 dedup**이다(NFKC·소문자 정규화 후 장부에 있으면 무조건 제외).
- 살아남은 후보가 그날의 신규 단어가 되고(최대 `maxNewWords` = 15), 그 15개만 `selected.json`·페이지·장부에 들어간다.

**장부 증가량**: 트랙당 하루 15개 → 1년 약 5,400개. known_words는 3,000개까지 전량 전달하고, 넘으면 최근 추가 1,000개만 보낸다(prepare의 전환 로직). 그 뒤로도 코드 dedup은 장부 전체를 보므로 중복은 나오지 않는다.

## 설계 결정과 이유

| 결정 | 이유 |
|---|---|
| AI는 content.json 한 파일만 생성 | LLM에게 산수·상태 관리를 시키면 조용히 틀린다. 실수 반경을 파일 하나로 제한하고, 나머지는 검증 가능한 코드로. |
| runlog의 `settled`가 멱등 키 | 워크플로가 재실행·중복 실행돼도 언어별 하루 1회만 상태가 바뀐다. prepare/settle 둘 다 이 값으로 no-op 판단. |
| 원자적 쓰기(tmp+rename) + settled는 words.json 성공 후 마킹 | 중간에 죽어도 상태 파일이 반쯤 쓰인 채 남지 않는다. 실패한 날은 settled=false라 다음 실행이 다시 하는데, words.json 쓰기 직후 크래시에 대비해 settle에 재실행 가드가 있다(`added_on === 오늘`은 신규 쿼터에 포함) — 재실행에도 초과 등록이 없다. |
| 최종 단어 선별본 selected.json 동결 | "페이지에 보이는 오늘의 단어"와 "장부에 등록된 단어"의 원천을 하나로. content.json의 후보 18개를 그대로 렌더하면 장부에 없는 단어(내일 또 나올 수 있는 단어)가 노출된다. |
| words.json은 settle만 쓴다. runlog는 각 단계가 자기 타임스탬프만 기록 | 단어 장부의 단일 작성자 원칙. runlog는 실행 로그라 prepare(`prepared_at`)·build(`built_at`, 언어별 최신 날짜만)가 기록해도 상태 정합성에 영향이 없다. |
| build는 전체 재생성(순수 함수) | 증분 빌드의 캐시 꼬임이 없다. 템플릿을 고치고 다시 돌리면 과거 페이지까지 일괄 갱신. 하루 언어당 1페이지 규모라 성능 문제 없음. |
| 날짜는 dates.js가 KST로 계산해 주입 | 클라우드 실행 환경의 타임존을 신뢰하지 않는다. AI에게도 날짜를 계산시키지 않는다(brief.json의 date만 사용). |
| 최종 중복 방어는 settle의 코드 dedup | AI의 known_words 회피는 "노력 목표"일 뿐. 상태에 이미 있는 headword는 코드가 무조건 걸러낸다(NFKC·소문자 정규화 포함 — 일본어 전각/반각 변형도 흡수). |
| docs/는 JS 0줄, `<details>`만 | 폰에서 즉시 열리고, 깨질 런타임이 없다. 정답 가리기는 네이티브 요소로 충분. |
| 외부 의존성 0 | CI에서 npm install 불필요(예외: AI 단계의 claude CLI 전역 설치) → 실행 시간·실패 지점 감소. Node 22+ 내장 기능만 사용(`node --test` 글롭 인자가 22부터 안정). |
| [A2] `--lang` 필수(기본값 없음), build만 예외 | 기본값이 있으면 언어를 빼먹은 명령이 조용히 en 상태를 오염시킨다. 미지정은 즉시 throw. build는 전 언어+허브를 항상 재생성하는 순수 함수라 언어 인자가 필요 없다. |
| [A3] 스키마 키(en/ko)는 언어 무관 고정 + `lang` 필드 + 조건부 `reading` | 렌더러·settle·장부가 언어 분기 없이 동작한다("reading 있으면 렌더"). 키 이름을 언어마다 바꾸면 파이프라인 전체가 분기 지옥이 된다. verify의 마커 문자열(문장 `<li class="sentence">`, 단어 `<article class="word-item">`)도 불변으로 유지된다. |
| [A4] 워크플로 커밋은 트랙별(daily(en) → daily(ja-n1) → daily(ja-n2)) | 한 트랙의 실패가 다른 트랙의 산출물 커밋을 막지 않는다. push 직전 `git pull --rebase`는 앞 블록 push·수동 커밋으로 원격이 앞서 있는 경우의 보험. 실행 자체의 독립성은 [A11]이 담당. |
| [A6] ja는 N1/N2 취득자 두 트랙, 프롬프트·픽스처 공유 | 사용자 확정 철학: 기초·시험 대비는 정해진 커리큘럼으로 각자, 생성 콘텐츠는 기초 완료자의 "매일 30분, 흥미 유지"용. 난이도는 파일 복제가 아니라 learnerProfile 주입으로 갈라 중복 정의를 없앤다. |
| [A7] 단어 지식 필수(note) — 무작위 나열 대신 연관 클러스터+단어 지식 | 사용자 확정: "무작위 단어 나열은 안 외워진다. 예문보다 파생형(-tion/-ive/-ful과 뜻 변화)·혼동어(late/lately)·어원 같은 단어 지식이 중요하고, 회화 주제와 연관된 단어가 잘 외워진다." → 후보의 절반 이상은 그날 회화·문장 소재 연관 클러스터, note는 전 트랙 필수, family(파생)/related(혼동어)는 있으면 담기. 렌더는 "있으면 렌더"라 note 없는 과거 데이터와 하위 호환. |
| [A9] 표제어 발음 음성은 **URL 생성**(상태·네트워크 없음), 트랙 설정 `ttsLang`으로 켬 | 사용자 요구: "영어 단어는 철자만으로 발음을 모르겠다. 단어 하나의 발음 음성만." 음원 URL을 headword에서 결정적으로 만들어 렌더 시점에 붙이므로 **파이프라인·스키마·상태가 전혀 바뀌지 않고 과거 날짜까지 소급 적용**된다(build는 여전히 순수 재생성). 사람 녹음(dictionaryapi.dev 미디어)은 URL을 알려면 파이프라인에 네트워크 호출이 필요하고 조사 시점에 502라 채택하지 않았다. 음성 엔드포인트가 **Referer가 붙은 요청에 404**를 주므로 `page()`에 `<meta name="referrer" content="no-referrer">`가 한 쌍으로 들어간다(이 페이지의 유일한 외부 요청이라 전역으로 꺼도 안전). ja는 reading(후리가나)이 발음을 이미 보여줘 `ttsLang: null`. JS 0줄 유지를 위해 네이티브 `<audio controls preload="none">`을 CSS로 재생 버튼 크기까지 줄였다. |
| [A8] 문단(passage) 형식 + 허브 날짜 리스트 | 사용자 확정: 무관한 문장 나열 대신 "어떤 글의 한 문단(수능 한 문제 분량)"을 먼저 통으로 읽고 문장별 분석으로 내려간다 — passage_note 필수, 문단 블록은 passage_note 있을 때만 렌더(과거 데이터 하위 호환). 허브는 트랙 선택이 아니라 날짜 내림차순 리스트(그날 있는 트랙만 링크) — 사용 동선이 "오늘 날짜 → 트랙"이기 때문. 문장 마커(`<li class="sentence">`)는 문장당 1개 불변으로 verify 호환. |
| [A10] **SRS(간격 반복 복습) 전면 제거** — srs.js → wordbank.js, words.json v1 → v2 | 2026-07-22에 복습 퀴즈 섹션을 페이지에서 뺐는데 승급 로직(settle)은 남아 있었다. 그래서 **화면에 보인 적 없는 단어에 `shown` 기록이 쌓이고 box가 올라갔다** — 13일 만에 트랙당 195단어 중 180개가 그 상태가 됐고, 그대로 두면 약 4개월 뒤 아무도 못 본 단어들이 `graduated`로 순환을 마쳤을 것이다. 사용자 재확정(2026-08-04): "퀴즈도 별도 복습 페이지도 필요 없다." → **읽는 곳이 없는 상태는 갖고 있지 않는다**는 원칙으로 due 선정·승급·review.json·박스/간격을 전부 삭제하고, 남은 요구("같은 단어 두 번 내지 않기")만 장부로 남겼다. 복습을 되살리려면 렌더러·SRS를 git 이력에서 꺼내고 card는 날짜별 selected.json에서 재구성하면 된다. |
| [A11] 워크플로 스텝 조건 = `!cancelled() && <자기 트랙 앞 단계>.outcome == 'success'` | GitHub Actions는 명시적 `if:`를 암묵적으로 `success()`와 AND한다. 조건만 써 두면 **en 트랙이 실패한 순간 ja 두 트랙이 통째로 skip**돼, 트랙별 커밋([A4])으로 만든 독립성이 실행 단계에서 무너진다. `!cancelled()`로 "앞 트랙의 실패"와 끊고, 대신 자기 트랙 앞 단계의 `outcome`을 명시해 트랙 안의 순서 의존만 남겼다. 실패한 트랙은 여전히 job을 실패로 표시해 알림은 살아 있다. |
