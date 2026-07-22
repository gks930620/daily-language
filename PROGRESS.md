# PROGRESS.md — 진행 체크포인트 (세션 끊겨도 여기서 이어받기)

> 갱신 규칙: 작업 단위가 끝날 때마다 이 파일을 갱신하고 커밋·push한다. 새 세션은 이 파일 + `git log --oneline -15`로 상태를 복원한다.

**마지막 갱신**: 2026-07-22 오전

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
