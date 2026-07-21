# ARCHITECTURE.md — 구현 구조

## 파이프라인

```
        (매일 06:00 KST, GitHub Actions `.github/workflows/daily.yml`이 실행)

  ┌─────────┐   ┌──────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────┐
  │ prepare │──▶│ generate │──▶│ settle  │──▶│ build   │──▶│ verify  │──▶│ git │
  │  (코드)  │   │   (AI)   │   │  (코드)  │   │  (코드)  │   │  (코드)  │   │ (CI) │
  └─────────┘   └──────────┘   └─────────┘   └─────────┘   └─────────┘   └─────┘
       │              │              │             │             │
  brief.json     content.json   words.json    docs/*.html   exit 0/1
  review.json     (한 파일만)    selected.json  (전체 재생성)   (커밋 게이트)
                                 runlog 마킹

  읽기: state ──▶ prepare              settle ◀── data/<날짜>/*      build ◀── data/*/
  쓰기: data/<날짜>/ ◀── prepare        state·selected.json ◀── settle  docs/ ◀── build
```

핵심 원칙: **AI는 `data/<날짜>/content.json` 하나만 만든다.** SRS 계산, 상태 갱신, HTML 빌드는 전부 결정론적 Node 스크립트다. 파일이 기억이고(state/), 날짜는 코드가 KST 기준으로 계산해 주입하며, runlog가 멱등 키다.

## 파일·스크립트 역할

| 경로 | 역할 |
|---|---|
| `scripts/prepare.js` | 하루의 시작. settled면 `ALREADY_DONE` 후 종료. due 단어 선정 → `review.json` 동결, known_words·최근 회화 주제 수집 → `brief.json`. runlog에 `prepared_at` 기록. |
| `scripts/settle.js` | content.json 검증 → 코드 dedup → 신규 단어 box 1 등록(최대 20개) → review.json의 due 단어 승급 → 최종 선별본 `selected.json` 동결 → runlog에 settled 마킹. **words.json을 쓰는 유일한 스크립트.** settled면 no-op. 재실행 가드: `added_on === 오늘`은 신규 쿼터에 포함, `last_seen === 오늘`은 승급 건너뜀 — 크래시 후 재실행에도 이중 반영 없음. |
| `scripts/build.js` | `data/*/`(content+review+selected) 전체 스캔 → `docs/days/*.html` + `index.html`을 처음부터 재생성. "오늘의 단어"는 selected.json 기준(없는 과거 데이터만 content.words 폴백). 단어 상태를 읽지 않는 순수 재생성. |
| `scripts/verify.js` | 오늘분 HTML 존재·개수 일치(문장 5, 단어 = selected.json 단어 수, 퀴즈 = review due 수)·settled 확인. 실패 시 exit 1 → 워크플로가 커밋하지 않음. |
| `scripts/mock-generate.js` | AI 대역(로컬 시뮬레이션). 픽스처의 `{{DATE}}` 치환. `--unique`는 headword에 날짜 접미사를 붙여 다일 시뮬레이션 중복 회피. |
| `scripts/lib/dates.js` | KST 오늘 계산, `--date` 오버라이드, 날짜 가감. **날짜의 유일한 소스.** |
| `scripts/lib/store.js` | JSON/텍스트 원자적 쓰기(tmp+rename), 루트 경로, 상태 파일 읽기. |
| `scripts/lib/srs.js` | 순수 함수: due 선정, 승급, 신규 항목 생성. 파일 I/O 없음. |
| `scripts/lib/validate.js` | content.json 수제 스키마 검증. 실패 필드의 경로를 찍는다. |
| `scripts/lib/html.js` | 이스케이프 + 페이지 템플릿. JS 0줄, 네이티브 `<details>`만. |
| `prompts/generator.md` | generate 단계(AI)의 지침. 입력 brief.json, 출력 content.json 하나. |
| `.github/workflows/daily.yml` | 주 실행 경로. prepare→generate(`claude -p`+구독 토큰)→settle(실패 시 1회 재생성)→build→verify→commit/push. `ALREADY_DONE`이면 이후 스텝 생략. |
| `prompts/routine.md` | claude.ai 루틴에 붙여넣는 프롬프트 원본(예비 경로 — 현재 미사용). |
| `state/words.json` | SRS 단어 상태(아래 스키마). |
| `state/runlog.json` | 날짜별 실행 기록 = 멱등 키. |
| `data/<날짜>/` | 하루치 산출물: brief.json(AI 입력), review.json(퀴즈 동결본), content.json(AI 출력), selected.json(settle의 최종 단어 선별본). |
| `docs/` | GitHub Pages 루트. **빌드 산출물** — 직접 수정 금지. `.nojekyll` 필수. |
| `fixtures/sample-content.json` | 실제 품질 수준의 하루치 샘플(시뮬레이션·테스트 공용). |

## 상태 스키마

### state/words.json (키 = 소문자 headword)

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

- `card`는 등록 시점의 콘텐츠 스냅샷. 퀴즈 렌더링이 과거 content.json을 뒤지지 않게 한다.
- `history`는 이벤트 로그(`added`/`shown`). 향후 `correct`/`wrong` 채점 이벤트를 추가해도 스키마 변경이 없다.

### state/runlog.json (날짜 = 멱등 키)

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

`settled: true`가 그날의 완료 표식이다. prepare는 이 값만 보고 재실행 여부를 정한다.

## AI 입출력 (data/<날짜>/)

- **brief.json** (prepare → AI): `date`, `learner_profile`, `new_word_candidates_requested`(25), `known_words`, `recent_conversation_topics`(최근 14일). due 단어는 **넣지 않는다** — AI가 복습에 관여할 이유가 없다.
  - known_words는 3,000개 이하면 전체, 초과 시 최근 추가 1,000개만(전환 로직 내장). 오래된 단어와 겹쳐도 settle의 코드 dedup이 최종 방어.
- **review.json** (prepare → settle·build): 오늘 퀴즈의 동결본. `due_words`(headword/box/card)와 `review_sentence`(D-10~D-3 창의 과거 문장에서 날짜 해시로 결정적 선택, 없으면 null). settle과 build가 **같은 동결본**을 읽으므로 "퀴즈에 나온 것"과 "승급된 것"이 항상 일치한다.
- **content.json** (AI → settle): 문장 5·단어 후보 20~25·회화. 검증 규칙은 validate.js 참조.
- **selected.json** (settle → build·verify): 그날 실제로 SRS에 등록된 최종 단어(최대 20개)의 동결본. 페이지의 "오늘의 단어"와 verify의 개수 검사는 이 파일이 기준이다. 후보 25개 중 중복 제외·쿼터 초과분은 페이지에도 SRS에도 들어가지 않아 "보이는 단어 = 복습될 단어"가 보장된다. 상태 기준(`added_on === 그날`)으로 만들므로 재실행해도 같은 내용이 재생성된다.

## SRS 규칙 (6박스 Leitner)

- 신규 단어: box 1, `next_due = 등록일 + 1`.
- due 단어(next_due ≤ 오늘, graduated 제외)가 퀴즈에 나오면: `shown` 기록, box+1, `next_due = 오늘 + intervals[새 box − 1]`.
- box 6에서 한 번 더 노출되면 `graduated: true` — 순환 종료.
- 채점이 없는 v1에서는 "노출 = 통과"다. v2에서 정답률을 수집하면 `wrong → box 유지/강등`만 추가하면 된다(srs.js의 promoteWord만 확장).

**하루 복습량**: 매일 신규 20개, 단어당 평생 노출 6회이므로 정착기(약 4개월 후) 하루 복습량은 평균 **20 × 6 = ~120개**로 수렴한다. 부담스러우면 `state/words.json`의 `intervals` 배열을 줄이면 된다(예: `[1,3,7,14]` → 단어당 4회 노출 = 하루 ~80개). 박스 수 = intervals 길이라서 코드는 그대로다.

## 설계 결정과 이유

| 결정 | 이유 |
|---|---|
| AI는 content.json 한 파일만 생성 | LLM에게 산수·상태 관리를 시키면 조용히 틀린다. 실수 반경을 파일 하나로 제한하고, 나머지는 검증 가능한 코드로. |
| review.json 동결본 | "퀴즈에 보인 단어"와 "승급할 단어"의 원천을 하나로. settle 시점에 due를 다시 계산하면 자정 경계 등에서 어긋날 수 있다. |
| runlog의 `settled`가 멱등 키 | 워크플로가 재실행·중복 실행돼도 하루 1회만 상태가 바뀐다. prepare/settle 둘 다 이 값으로 no-op 판단. |
| 원자적 쓰기(tmp+rename) + settled는 words.json 성공 후 마킹 | 중간에 죽어도 상태 파일이 반쯤 쓰인 채 남지 않는다. 실패한 날은 settled=false라 다음 실행이 다시 하는데, words.json 쓰기 직후 크래시에 대비해 settle에 재실행 가드가 있다(`last_seen === 오늘`이면 승급 생략, `added_on === 오늘`은 신규 쿼터에 포함) — 재실행에도 이중 승급·초과 등록이 없다. |
| 최종 단어 선별본 selected.json 동결 | "페이지에 보이는 오늘의 단어"와 "SRS에 등록된 단어"의 원천을 하나로. content.json의 후보 25개를 그대로 렌더하면 SRS에 없는 단어가 노출된다. |
| words.json은 settle만 쓴다. runlog는 각 단계가 자기 타임스탬프만 기록 | SRS 상태의 단일 작성자 원칙. runlog는 실행 로그라 prepare(`prepared_at`)·build(`built_at`, 최신 날짜만)가 기록해도 상태 정합성에 영향이 없다. |
| build는 전체 재생성(순수 함수) | 증분 빌드의 캐시 꼬임이 없다. 템플릿을 고치고 다시 돌리면 과거 페이지까지 일괄 갱신. 하루 1페이지 규모라 성능 문제 없음. |
| 날짜는 dates.js가 KST로 계산해 주입 | 클라우드 실행 환경의 타임존을 신뢰하지 않는다. AI에게도 날짜를 계산시키지 않는다(brief.json의 date만 사용). |
| 최종 중복 방어는 settle의 코드 dedup | AI의 known_words 회피는 "노력 목표"일 뿐. 상태에 이미 있는 headword는 코드가 무조건 걸러낸다(소문자 정규화 포함). |
| docs/는 JS 0줄, `<details>`만 | 폰에서 즉시 열리고, 깨질 런타임이 없다. 정답 가리기는 네이티브 요소로 충분. |
| 외부 의존성 0 | CI에서 npm install 불필요(예외: AI 단계의 claude CLI 전역 설치) → 실행 시간·실패 지점 감소. Node 22+ 내장 기능만 사용(`node --test` 글롭 인자가 22부터 안정). |
