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

## 표현 포맷 5종 프리뷰 (사용자 선택 대기 — 2026-07-22)

사용자 방향 전환: 스키마를 바꾸지 말고 **내용은 그대로(단어 20개면 같은 20개), 보여주는 포맷만 5가지**로 만들어 비교·선택. 스키마 개편(지문5개 등)은 보류 — 포맷 선택 후 반영.

- ✅ 커밋 a254546: `scripts/lib/formats.js`(renderFormat1~5), `scripts/preview-formats.js`, `docs/preview/`(6페이지), style.css `fmt-` 클래스. 파이프라인·스키마 무변경, 테스트 46 유지.
- 프리뷰 URL: **https://gks930620.github.io/daily-language/preview/**
- 5포맷: ①정통 교재형 ②플래시카드(액티브 리콜)형 ③맥락 우선(스토리)형 ④미니멀 한눈에형 ⑤심화 클러스터형.
- **사용자가 번호 고르면 → 그 포맷을 html.js 일일 렌더의 기본으로 채택** + (원하면) 지문5개·회화 실제출처(AI추정 안내) 등 콘텐츠 튜닝 반영.
- 이전에 논의된 미반영 아이디어(선택 후 다시 검토): 지문 5개 확장, 회화 실제 작품 출처(사용자는 "실제 작품명 출처"를 원함 — html에 "출처는 AI 추정" 안내 병기 조건), 단어 연관 강화(note/family/related는 이미 있음).

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
