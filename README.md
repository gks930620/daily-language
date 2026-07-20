# 매일 영어 학습 (daily-english)

매일 아침 claude.ai 클라우드 루틴이 이 저장소를 클론해 **그날의 영어 학습 페이지를 자동 생성**하고 GitHub Pages에 게시하는 개인 학습 파이프라인입니다. 학습자는 토익 700 → 목표 900, 시사 독해와 기초 회화를 함께 노립니다. AI는 콘텐츠(문장·단어·회화)만 만들고, 복습 간격 계산(Leitner SRS)·상태 관리·HTML 빌드는 전부 Node 스크립트가 결정론적으로 처리합니다.

## 매일 아침 무엇이 생기나

매일 06:00 KST쯤 `https://<계정>.github.io/daily-english/`에 새 페이지가 올라옵니다. 하루치 페이지 구성:

1. **오늘의 문장 5개** — 수능 고난도~시사 기사 난이도. 영문을 먼저 읽고, 접힌 부분을 열면 한국어 해석과 끊어읽기·문법 구문분석이 나옵니다.
2. **오늘의 단어 20개** — 토익 700→900 구간·수능 고난도·시사 어휘. 뜻, 예문, 연어(collocation) 표. AI가 낸 후보 25개 중 스크립트가 새 단어 20개를 선별해 싣고, 실린 단어만 복습 퀴즈로 돌아온다(중복 등으로 20개에 못 미치는 날도 있음).
3. **오늘의 회화 한 문단** — 생활 주제 하나로 A/B 대화 8~12줄. 영어 문장을 누르면 해석이 열립니다.
4. **복습 퀴즈** — 오늘 복습 주기가 돌아온 단어들. 단어와 영어 예문만 보이고, "정답"을 눌러야 뜻이 나옵니다. 간격은 1·3·7·14·30·60일(6박스 Leitner).
5. **복습 문장 1개** — 3~10일 전에 배운 문장 중 하나를 다시 풀어봅니다.

## 사용법

그냥 페이지를 엽니다. 그게 전부입니다.

- 아침에 페이지 열기 → 문장 5개 해석해 보기 → 정답 확인 → 단어 훑기 → 회화 소리 내어 읽기 → 복습 퀴즈 풀기.
- 어제 것을 못 했으면 하단/상단의 날짜 내비게이션이나 index의 아카이브에서 이동하면 됩니다. 페이지는 전부 정적 HTML이라 폰에서도 즉시 열립니다.

## 최초 설정 절차

1. **GitHub public 저장소 생성** — 이름 `daily-english` (Pages 무료 사용을 위해 public).
2. **이 폴더를 push**
   ```bash
   git init
   git add -A
   git commit -m "initial"
   git branch -M main
   git remote add origin https://github.com/<계정>/daily-english.git
   git push -u origin main
   ```
3. **GitHub Pages 켜기** — 저장소 Settings → Pages → Source: `Deploy from a branch`, Branch: `main`, 폴더 `/docs` → Save.
4. **claude.ai GitHub 연동** — claude.ai 설정에서 GitHub 계정을 연결하고 `daily-english` 저장소 접근을 허용.
5. **claude.ai 루틴 생성** — 새 루틴(스케줄 작업)을 만들고 `prompts/routine.md`의 코드 블록 내용을 그대로 붙여넣는다. 실행 시각: **매일 21:00 UTC (= 06:00 KST)**. 대상 저장소: `daily-english`.
6. **첫 수동 실행** — 루틴을 한 번 수동으로 실행해 본다. 확인할 것: (a) 파이프라인이 끝까지 돌았는지, (b) **루틴이 main에 직접 push할 수 있는지**(권한 문제가 가장 흔한 첫 실패 원인), (c) 몇 분 뒤 Pages URL에 오늘 페이지가 뜨는지.

## 문제 해결

| 증상 | 원인/대처 |
|---|---|
| push는 됐는데 페이지가 안 바뀜 | GitHub Pages 반영은 수 분 걸릴 수 있음. 저장소 Actions 탭의 `pages-build-deployment` 완료 후 새로고침(캐시 주의). |
| 루틴이 실패함 | 그날은 건너뛰어도 됨. 파이프라인은 **날짜 기준 멱등**이고 settle에는 재실행 가드(같은 날 이중 승급·초과 등록 방지)가 있어, 어느 지점에서 죽어도 다음 실행이 안전하게 이어서 처리함. |
| 같은 날 루틴이 두 번 돎 | `prepare`가 `ALREADY_DONE`을 출력하고 아무것도 하지 않음(정상). |
| 루틴이 main에 push 못 함 | claude.ai GitHub 연동의 쓰기 권한/브랜치 보호 규칙 확인. main 보호를 걸었다면 해제하거나 루틴용 예외 필요. |
| 콘텐츠 검증 실패로 멈춤 | 루틴이 1회 재시도 후 보고하고 종료함. state는 건드리지 않으므로 다음날 정상 복구. 수동으로 돌리려면 `.claude/skills/daily-english-run` 절차 참고. |

## 예비 경로: GitHub Actions (문서만, 미구현)

claude.ai 루틴이 장기 불안정하면 같은 파이프라인을 GitHub Actions로 옮길 수 있습니다. 코드는 이미 "코드 단계(prepare/settle/build/verify)"와 "AI 단계(generate)"가 분리돼 있으므로:

- 스케줄 워크플로(cron `0 21 * * *`)에서 `prepare → (Anthropic API 호출로 content.json 생성) → settle → build → verify → commit/push`를 실행.
- 필요한 것: `ANTHROPIC_API_KEY` 시크릿, API 호출 스텝(작은 Node 스크립트 하나 추가).
- 이 저장소에는 의도적으로 워크플로 파일을 넣지 않았습니다(현재 경로는 claude.ai 루틴). 전환 시 ARCHITECTURE.md의 파이프라인 그대로 이식하면 됩니다.
