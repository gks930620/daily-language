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
  review.json     (한 파일만)    selected.json  (전체 재생성)   (커밋 게이트)
                                 runlog 마킹

  읽기: state/<lang> ──▶ prepare        settle ◀── data/<lang>/<날짜>/*   build ◀── data/*/*/
  쓰기: data/<lang>/<날짜>/ ◀── prepare  state·selected.json ◀── settle    docs/ ◀── build
```

핵심 원칙: **AI는 `data/<lang>/<날짜>/content.json` 하나만 만든다.** SRS 계산, 상태 갱신, HTML 빌드는 전부 결정론적 Node 스크립트다. 파일이 기억이고(state/), 날짜는 코드가 KST 기준으로 계산해 주입하며, runlog가 멱등 키다. **트랙(en·ja-n1·ja-n2, 트랙 = 언어×난이도)은 디렉터리 네임스페이스로 완전 분리**되고, 트랙별 설정의 단일 소스는 `scripts/lib/langs.js`다. 콘텐츠 철학: 기초는 정해진 커리큘럼으로 각자 학습하고, 생성 콘텐츠는 **기초 완료자의 매일 30분·흥미 유지**용이다(ja는 JLPT N1/N2 취득자 두 난이도).

## 디렉터리 지도 (트랙 축 — `<lang>` ∈ en·ja-n1·ja-n2)

```
data/<lang>/<날짜>/            brief.json · review.json · content.json · selected.json
state/<lang>/                  words.json · runlog.json  (언어별 독립 SRS·멱등 키)
docs/index.html                허브(언어 선택)
docs/<lang>/index.html         언어 인덱스(최신 하루치 + 아카이브)
docs/<lang>/days/<날짜>.html    하루치 페이지
docs/assets/ · docs/.nojekyll  루트 유지(공유)
prompts/generator.{en,ja}.md   generate 지침(ja 파일은 ja-n1·ja-n2 두 트랙이 공유)
fixtures/sample-content.{en,ja}.json  픽스처(ja 파일은 두 ja 트랙 공유 — mock이 lang을 실행 트랙으로 덮어씀)
```

## 파일·스크립트 역할

| 경로 | 역할 |
|---|---|
| `scripts/lib/langs.js` | **트랙 레지스트리(단일 소스, 트랙 = 언어×난이도)**: label·pageTitle·learnerProfile·newWordCandidates·maxNewWords·promptFile·fixtureFile·requiresReading + `resolveLang(argv)`. 학습자 프로필 문자열은 여기에만 있다. ja-n1/ja-n2는 promptFile·fixtureFile을 공유하고 난이도는 learnerProfile(→ brief.json)로 주입된다. |
| `scripts/prepare.js` | 하루의 시작(`--lang` 필수). settled면 `ALREADY_DONE` 후 종료. due 단어 선정 → `review.json` 동결, known_words·최근 회화 주제 수집 → `brief.json`. runlog에 `prepared_at` 기록. |
| `scripts/settle.js` | content.json 검증(lang 교차검증 포함) → 코드 dedup(NFKC 정규화) → 신규 단어 box 1 등록(최대 20개) → review.json의 due 단어 승급 → 최종 선별본 `selected.json` 동결 → runlog에 settled 마킹. **words.json을 쓰는 유일한 스크립트.** settled면 no-op. 재실행 가드: `added_on === 오늘`은 신규 쿼터에 포함, `last_seen === 오늘`은 승급 건너뜀 — 크래시 후 재실행에도 이중 반영 없음. |
| `scripts/build.js` | **`--lang`을 받지 않는 유일한 스크립트.** 전 언어의 `data/<lang>/*/`(content+review+selected)를 스캔 → `docs/<lang>/days/*.html` + `docs/<lang>/index.html` + 허브 `docs/index.html`을 처음부터 재생성. "오늘의 단어"는 selected.json 기준(없는 과거 데이터만 content.words 폴백). 단어 상태를 읽지 않는 순수 재생성. |
| `scripts/verify.js` | 오늘분(`--lang` 필수) HTML 존재·개수 일치(문장 5, 단어 = selected.json 단어 수, 퀴즈 = review due 수)·settled·허브 존재 확인. 실패 시 exit 1 → 워크플로가 커밋하지 않음. |
| `scripts/mock-generate.js` | AI 대역(로컬 시뮬레이션, `--lang` 필수). 픽스처의 `{{DATE}}` 치환 후 **lang을 실행 트랙으로 덮어씀**(픽스처 공유 대응). `--unique`는 headword에 날짜 접미사를 붙여 다일 시뮬레이션 중복 회피. |
| `scripts/lib/dates.js` | KST 오늘 계산, `--date` 오버라이드, 날짜 가감. **날짜의 유일한 소스.** |
| `scripts/lib/store.js` | JSON/텍스트 원자적 쓰기(tmp+rename), 루트 경로, 상태 파일 읽기(`readWordsState(lang)`·`readRunlog(lang)` — lang 필수). |
| `scripts/lib/srs.js` | 순수 함수: due 선정, 승급, 신규 항목 생성. 파일 I/O 없음(언어 무관). |
| `scripts/lib/validate.js` | content.json 수제 스키마 검증. `validateContent(content, date, lang)` — content.lang 교차검증, requiresReading 언어는 reading 필수. 실패 필드의 경로를 찍는다. |
| `scripts/lib/html.js` | 이스케이프 + 페이지 템플릿. JS 0줄, 네이티브 `<details>`만. **언어 분기 없음 — "reading 있으면 렌더" 규칙만.** |
| `prompts/generator.en.md` / `prompts/generator.ja.md` | generate 단계(AI)의 지침. ja 파일은 두 트랙 공유 — 난이도 캘리브레이션 표(N1/N2 취득자)를 내장하고 brief의 learner_profile로 구분. 입력 brief.json, 출력 content.json 하나. 프로필은 brief.json 참조(재기재 금지). |
| `.github/workflows/daily.yml` | 주 실행 경로. prepare ×3 → [EN 블록: generate→settle→build+verify→commit "daily(en): DATE"] → [JA-N1 블록: 동일, "daily(ja-n1): DATE"] → [JA-N2 블록: 동일, "daily(ja-n2): DATE"]. 2번째 블록부터 push 직전 `git pull --rebase`. settle 스텝은 `set -o pipefail`(기본 셸은 pipefail 꺼짐 — 없으면 tee가 실패를 가림). |
| `prompts/routine.md` | claude.ai 루틴에 붙여넣는 프롬프트 원본(예비 경로 — 현재 미사용, 언어 축 이전 기준). |
| `state/<lang>/words.json` | 언어별 SRS 단어 상태(아래 스키마). |
| `state/<lang>/runlog.json` | 언어별 날짜별 실행 기록 = 멱등 키. |
| `data/<lang>/<날짜>/` | 하루치 산출물: brief.json(AI 입력), review.json(퀴즈 동결본), content.json(AI 출력), selected.json(settle의 최종 단어 선별본). |
| `docs/` | GitHub Pages 루트. **빌드 산출물** — 직접 수정 금지. `.nojekyll` 필수. |
| `fixtures/sample-content.<lang>.json` | 실제 품질 수준의 하루치 샘플(시뮬레이션·테스트 공용). |

## 상태 스키마

### state/\<lang\>/words.json (키 = NFKC·소문자 정규화된 headword)

```json
{
  "schema_version": 1,
  "intervals": [1, 3, 7, 14, 30, 60],
  "words": {
    "mitigate": {
      "added_on": "2026-07-20",
      "box": 2,
      "next_due": "2026-07-24",
      "last_seen": "2026-07-21",
      "graduated": false,
      "history": [{ "date": "2026-07-21", "event": "shown" }],
      "card": { "pos": "v.", "ko": "완화하다", "example_en": "...", "example_ko": "..." }
    }
  }
}
```

- `card`는 등록 시점의 콘텐츠 스냅샷. 퀴즈 렌더링이 과거 content.json을 뒤지지 않게 한다. **ja처럼 reading이 있는 언어는 card에 `reading`이 포함된다**(있을 때만). 단어 지식 `note`/`family`/`related`도 같은 패턴으로 있을 때만 포함 — 복습 퀴즈 정답에서 매번 재노출된다.
- `history`는 이벤트 로그(`added`/`shown`). 향후 `correct`/`wrong` 채점 이벤트를 추가해도 스키마 변경이 없다.

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

- **brief.json** (prepare → AI): `date`, `learner_profile`(langs.js가 단일 소스), `new_word_candidates_requested`(25), `known_words`, `recent_conversation_topics`(최근 14일). due 단어는 **넣지 않는다** — AI가 복습에 관여할 이유가 없다.
  - known_words는 3,000개 이하면 전체, 초과 시 최근 추가 1,000개만(전환 로직 내장). 오래된 단어와 겹쳐도 settle의 코드 dedup이 최종 방어.
- **review.json** (prepare → settle·build): 오늘 퀴즈의 동결본. `due_words`(headword/box/card)와 `review_sentence`(D-10~D-3 창의 과거 문장에서 날짜 해시로 결정적 선택, 없으면 null — reading이 있으면 함께 동결). settle과 build가 **같은 동결본**을 읽으므로 "퀴즈에 나온 것"과 "승급된 것"이 항상 일치한다.
- **content.json** (AI → settle): 문장 5·단어 후보 20~25·회화. 최상위 `lang` 필수(--lang과 교차검증). **스키마 키는 언어 무관하게 고정**: `en` = 대상 언어 텍스트, `ko` = 한국어. requiresReading 트랙(ja-n1·ja-n2)은 sentences[]·words[]·conversation.lines[]에 `reading`(전문 히라가나) 필수, key_expressions는 선택. 검증 규칙은 validate.js 참조.
  - **words[] 단어 지식 필드**: `note`(문자열, **전 트랙 필수**) — 암기를 돕는 지식 한두 줄(어원·파생 규칙·혼동어 차이·뉘앙스·기억법). `family`(배열, 선택) — 파생형/같은 한자 단어군, 항목은 `{word 필수, pos 선택, ko 필수}`. `related`(배열, 선택) — 혼동어·유의어·반의어, 항목은 `{word 필수, note 필수, ko 선택}`. 렌더는 "있으면 렌더"(reading과 동일) — note 없는 과거 데이터(2026-07-21 이전)도 깨지지 않는다.
- **selected.json** (settle → build·verify): 그날 실제로 SRS에 등록된 최종 단어(최대 20개)의 동결본. 페이지의 "오늘의 단어"와 verify의 개수 검사는 이 파일이 기준이다. 후보 25개 중 중복 제외·쿼터 초과분은 페이지에도 SRS에도 들어가지 않아 "보이는 단어 = 복습될 단어"가 보장된다. 상태 기준(`added_on === 그날`)으로 만들므로 재실행해도 같은 내용이 재생성된다.

## SRS 규칙 (6박스 Leitner — 언어별 독립)

- 신규 단어: box 1, `next_due = 등록일 + 1`.
- due 단어(next_due ≤ 오늘, graduated 제외)가 퀴즈에 나오면: `shown` 기록, box+1, `next_due = 오늘 + intervals[새 box − 1]`.
- box 6에서 한 번 더 노출되면 `graduated: true` — 순환 종료.
- 채점이 없는 v1에서는 "노출 = 통과"다. v2에서 정답률을 수집하면 `wrong → box 유지/강등`만 추가하면 된다(srs.js의 promoteWord만 확장).

**하루 복습량**: 언어당 매일 신규 20개, 단어당 평생 노출 6회이므로 정착기(약 4개월 후) 하루 복습량은 언어당 평균 **20 × 6 = ~120개**로 수렴한다. 부담스러우면 `state/<lang>/words.json`의 `intervals` 배열을 줄이면 된다(예: `[1,3,7,14]` → 단어당 4회 노출 = 하루 ~80개). 박스 수 = intervals 길이라서 코드는 그대로다.

## 설계 결정과 이유

| 결정 | 이유 |
|---|---|
| AI는 content.json 한 파일만 생성 | LLM에게 산수·상태 관리를 시키면 조용히 틀린다. 실수 반경을 파일 하나로 제한하고, 나머지는 검증 가능한 코드로. |
| review.json 동결본 | "퀴즈에 보인 단어"와 "승급할 단어"의 원천을 하나로. settle 시점에 due를 다시 계산하면 자정 경계 등에서 어긋날 수 있다. |
| runlog의 `settled`가 멱등 키 | 워크플로가 재실행·중복 실행돼도 언어별 하루 1회만 상태가 바뀐다. prepare/settle 둘 다 이 값으로 no-op 판단. |
| 원자적 쓰기(tmp+rename) + settled는 words.json 성공 후 마킹 | 중간에 죽어도 상태 파일이 반쯤 쓰인 채 남지 않는다. 실패한 날은 settled=false라 다음 실행이 다시 하는데, words.json 쓰기 직후 크래시에 대비해 settle에 재실행 가드가 있다(`last_seen === 오늘`이면 승급 생략, `added_on === 오늘`은 신규 쿼터에 포함) — 재실행에도 이중 승급·초과 등록이 없다. |
| 최종 단어 선별본 selected.json 동결 | "페이지에 보이는 오늘의 단어"와 "SRS에 등록된 단어"의 원천을 하나로. content.json의 후보 25개를 그대로 렌더하면 SRS에 없는 단어가 노출된다. |
| words.json은 settle만 쓴다. runlog는 각 단계가 자기 타임스탬프만 기록 | SRS 상태의 단일 작성자 원칙. runlog는 실행 로그라 prepare(`prepared_at`)·build(`built_at`, 언어별 최신 날짜만)가 기록해도 상태 정합성에 영향이 없다. |
| build는 전체 재생성(순수 함수) | 증분 빌드의 캐시 꼬임이 없다. 템플릿을 고치고 다시 돌리면 과거 페이지까지 일괄 갱신. 하루 언어당 1페이지 규모라 성능 문제 없음. |
| 날짜는 dates.js가 KST로 계산해 주입 | 클라우드 실행 환경의 타임존을 신뢰하지 않는다. AI에게도 날짜를 계산시키지 않는다(brief.json의 date만 사용). |
| 최종 중복 방어는 settle의 코드 dedup | AI의 known_words 회피는 "노력 목표"일 뿐. 상태에 이미 있는 headword는 코드가 무조건 걸러낸다(NFKC·소문자 정규화 포함 — 일본어 전각/반각 변형도 흡수). |
| docs/는 JS 0줄, `<details>`만 | 폰에서 즉시 열리고, 깨질 런타임이 없다. 정답 가리기는 네이티브 요소로 충분. |
| 외부 의존성 0 | CI에서 npm install 불필요(예외: AI 단계의 claude CLI 전역 설치) → 실행 시간·실패 지점 감소. Node 22+ 내장 기능만 사용(`node --test` 글롭 인자가 22부터 안정). |
| [A2] `--lang` 필수(기본값 없음), build만 예외 | 기본값이 있으면 언어를 빼먹은 명령이 조용히 en 상태를 오염시킨다. 미지정은 즉시 throw. build는 전 언어+허브를 항상 재생성하는 순수 함수라 언어 인자가 필요 없다. |
| [A3] 스키마 키(en/ko)는 언어 무관 고정 + `lang` 필드 + 조건부 `reading` | 렌더러·settle·SRS가 언어 분기 없이 동작한다("reading 있으면 렌더"). 키 이름을 언어마다 바꾸면 파이프라인 전체가 분기 지옥이 된다. verify의 마커 문자열(`<tr class="word-row">` 등)도 불변으로 유지된다. |
| [A4] 워크플로 커밋은 트랙별(daily(en) → daily(ja-n1) → daily(ja-n2)) | 한 트랙의 실패가 다른 트랙의 산출물 커밋을 막지 않는다. 2번째 블록부터 push 직전 `git pull --rebase`는 앞 블록 push로 원격이 앞서 있는 경우의 보험. |
| [A6] ja는 N1/N2 취득자 두 트랙, 프롬프트·픽스처 공유 | 사용자 확정 철학: 기초·시험 대비는 정해진 커리큘럼으로 각자, 생성 콘텐츠는 기초 완료자의 "매일 30분, 흥미 유지"용. 난이도는 파일 복제가 아니라 learnerProfile 주입으로 갈라 중복 정의를 없앤다. |
| [A7] 단어 지식 필수(note) — 무작위 나열 대신 연관 클러스터+단어 지식 | 사용자 확정: "무작위 단어 나열은 안 외워진다. 예문보다 파생형(-tion/-ive/-ful과 뜻 변화)·혼동어(late/lately)·어원 같은 단어 지식이 중요하고, 회화 주제와 연관된 단어가 잘 외워진다." → 후보의 절반 이상은 그날 회화·문장 소재 연관 클러스터, note는 전 트랙 필수, family(파생)/related(혼동어)는 있으면 담기·card에 스냅샷·퀴즈 정답에서 재노출. 렌더는 "있으면 렌더"라 note 없는 과거 데이터와 하위 호환. |
