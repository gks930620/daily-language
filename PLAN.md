# PLAN.md — 기획 문서

## 요구사항 원문 요약

- 매일 아침 자동으로 영어 학습 콘텐츠가 생기면 좋겠다. 사용자는 열어서 공부만 한다.
- 학습자: 토익 700, 수능 2등급(10년 전), 회화 초급. 목표: 토익 900, 시사 독해, 기초 회화.
- 하루 분량: 문장 5개(수능~시사 난이도, 한국어 해석+구문분석), 단어 20개, 회화 한 문단.
- 배운 단어는 잊지 않게 간격 반복(SRS) 복습 퀴즈로 다시 나와야 한다.
- 실행 주체는 GitHub Actions(매일 아침 저장소에서 실행, AI는 구독 토큰의 `claude -p`). 처음엔 claude.ai 클라우드 루틴이었으나 GitHub 연동 없이 되는 Actions로 전환(루틴은 예비 경로).
- 결과물은 웹페이지로 본다(폰에서). 일본어 학습 확장은 처음엔 "일단 킾"이었으나 **v1.1로 확정 승격** — 언어 네임스페이스(en/ja) 리팩터로 도입.

## 확정 결정

| 항목 | 결정 |
|---|---|
| 결과물 형태 | GitHub Pages(`docs/`) 정적 HTML + Leitner SRS 복습 퀴즈 |
| 실행 주체 | GitHub Actions `.github/workflows/daily.yml`, 매일 21:00 UTC(=06:00 KST). AI 단계는 `claude -p` + `CLAUDE_CODE_OAUTH_TOKEN`(구독 사용량, API 과금 아님). 예비: claude.ai 루틴(`prompts/routine.md`) |
| 저장소 | GitHub **public** [`gks930620/daily-language`](https://github.com/gks930620/daily-language) (Pages 무료 조건) |
| SRS | 6박스 Leitner, 간격 `[1,3,7,14,30,60]`일, box 6 노출 후 졸업. 언어별 독립 상태 |
| 역할 분담 | AI = content.json 생성만. 날짜·SRS·상태·빌드 = Node 스크립트 |
| 기술 | Node.js only, 외부 의존성 0, ESM, docs/는 JS 0줄 |
| 멱등성 | `state/<lang>/runlog.json`의 날짜별 `settled`가 언어별 멱등 키 |
| 언어 축(v1.1) | 디렉터리 네임스페이스 `data/<lang>/`·`state/<lang>/`·`docs/<lang>/`, `--lang` 필수(기본값 없음, build만 예외), 스키마 키(en/ko)는 언어 무관 고정 + `lang` 필드 + ja는 `reading` 필수, 워크플로 커밋은 언어별 2회(`daily(en):`/`daily(ja):`) |

## v1 범위 (이 저장소)

- 파이프라인: `prepare → generate(AI) → settle → build → verify → git(워크플로)`.
- 하루치 페이지: 문장 5(해석·구문분석 접기) / 단어 20 표(AI 후보 25 중 settle이 선별한 `selected.json` 기준) / 회화 8~12줄 / 복습 퀴즈(정답 접기) / 복습 문장 1.
- 채점 없는 SRS: "퀴즈에 노출 = 통과"로 승급. 파일 스키마는 채점 확장 가능 구조.
- 로컬 시뮬레이션(mock-generate + 픽스처)과 node:test 단위 테스트.

## v1.1 (확정 — 구현됨)

- **일본어 트랙 추가**: v2 후보였던 일본어 확장을 확정 승격. 동일 파이프라인을 언어 네임스페이스(en/ja)로 리팩터해 도입.
- 언어별 설정의 단일 소스 `scripts/lib/langs.js`(프로필·프롬프트 경로·reading 필수 여부).
- ja 콘텐츠: N5~N4 문장·단어(히라가나 reading 필수), 한국어 화자 관점 문법 해설, 생활 회화.
- 허브 `docs/index.html`(언어 선택) + 언어 인덱스 `docs/<lang>/index.html`.

## v2 후보 (지금은 안 함)

| 후보 | 내용 | 메모 |
|---|---|---|
| 성과 기반 채점 | 페이지에서 "틀렸어요"를 누르면 GitHub Issue 폼으로 정답률 수집 → 다음날 settle이 Issue를 읽어 `correct`/`wrong` 이벤트 반영(오답은 box 유지/강등) | JS 0줄 원칙 유지 가능(Issue 폼 링크는 정적 URL). srs.js 확장만 필요 |
| 문장 SRS | 단어처럼 문장에도 박스를 붙여 간격 복습 | 현재는 D-10~D-3 창 결정적 선택 1문장으로 대체 중 |
| 회화 음성 | TTS 음원 링크 첨부 | 외부 의존성 발생 — 신중히 |

## 리스크

| 리스크 | 영향 | 대응 |
|---|---|---|
| 구독 토큰 CI 사용 정책 변경/토큰 만료(1년) | generate 단계 인증 실패 | 만료면 `claude setup-token` 재발급. 정책이 막히면 generate 스텝만 API 키 호출로 교체(나머지 파이프라인 불변) |
| 워크플로 실행 누락/실패 | 그날 페이지 없음 | 멱등 설계라 다음 실행이 자동 복구. 상태는 성공한 날만 갱신. 공개 저장소 60일 무활동 시 예약 중지(매일 커밋으로 사실상 무관) |
| AI가 스키마를 어긴 content.json 생성 | settle 실패 | validate.js가 필드 경로까지 찍어 거부, 워크플로가 1회 재생성 후 재시도, 실패 시 커밋 없이 보고 |
| AI가 알던 단어를 또 냄 | 신규 단어 감소 | settle의 코드 dedup이 최종 방어 + notes에 기록. 미달이어도 진행 |
| known_words가 계속 자람 | brief.json 비대 | 3,000개 초과 시 최근 1,000개만 전달(내장됨) |
| 복습량 누적 부담 | 정착기 하루 ~120개 | `intervals` 배열 축소로 즉시 조정 가능(ARCHITECTURE.md 참조) |
| Pages 반영 지연 | 아침에 페이지가 늦게 보임 | 수 분 내 해소. README 문제 해결 표 참조 |
| public 저장소에 학습 데이터 노출 | 개인 학습 기록 공개 | 민감 정보 아님(단어·문장). 이름·이메일 등은 커밋하지 않기 |
