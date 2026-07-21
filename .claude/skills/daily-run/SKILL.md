---
name: daily-run
description: 로컬에서 하루치 언어 학습 콘텐츠(en/ja)를 생성·시뮬레이션·재빌드할 때 쓰는 절차. 실제 하루치 생성(AI 단계를 세션의 Claude가 직접 수행), 픽스처 기반 다일 시뮬레이션, 멱등성 확인, docs 재빌드, 시뮬레이션 뒤 초기화까지 포함.
---

# daily 로컬 실행·시뮬레이션 (언어 트랙: en / ja)

모든 명령은 저장소 루트에서. **prepare/settle/verify/mock-generate는 `--lang <en|ja>` 필수**(build만 예외 — 항상 전 언어+허브 재생성). 날짜는 항상 `--date YYYY-MM-DD`로 명시하는 것을 권장(기본은 KST 오늘).

## A. 실제 하루치 로컬 생성

워크플로와 같은 순서를 수동으로 밟는다. AI 단계는 **이 세션의 Claude가 직접** 수행한다. 아래 `L`은 `en` 또는 `ja`.

```bash
node scripts/prepare.js --lang L        # 출력의 DATE, BRIEF 경로 확인. ALREADY_DONE이면 끝.
```

1. `prompts/generator.L.md`를 읽는다(en → generator.en.md, ja → generator.ja.md).
2. `data/L/<DATE>/brief.json`을 읽고, 지침대로 `data/L/<DATE>/content.json`을 **직접 작성**한다(mock 사용 금지 — 실제 품질의 콘텐츠). 다른 파일은 만들지도 고치지도 않는다.

```bash
node scripts/settle.js --lang L         # 검증 실패 시 에러의 필드 경로를 보고 content.json만 수정 후 재실행
node scripts/build.js                   # --lang 없음: 전 언어 + 허브 재생성
node scripts/verify.js --lang L         # 통과해야 완료
```

커밋은 하지 않는다(사용자 지시가 있을 때만).

## B. 픽스처 시뮬레이션 (다일)

AI 대역으로 `mock-generate.js`를 쓴다. 여러 날을 돌릴 때는 `--unique` 필수(날짜 접미사로 headword 중복 회피).

```bash
# 영어 예시
for d in 2026-07-20 2026-07-21 2026-07-22 2026-07-23; do
  node scripts/prepare.js --lang en --date $d
  node scripts/mock-generate.js --lang en --date $d --unique
  node scripts/settle.js --lang en --date $d
  node scripts/build.js
  node scripts/verify.js --lang en --date $d
done

# 일본어 1사이클 예시
node scripts/prepare.js --lang ja --date 2026-07-10
node scripts/mock-generate.js --lang ja --date 2026-07-10
node scripts/settle.js --lang ja --date 2026-07-10
node scripts/build.js
node scripts/verify.js --lang ja --date 2026-07-10
```

확인 포인트:
- 2일차 퀴즈에 1일차 단어 20개(box 1) 등장, settle 후 box 2·`next_due = 2일차+3일`.
- box 2 단어는 승급일+3일에 재등장(위 예시면 5일차인 07-24 — 4일차 아님에 주의).
- `state/<lang>/runlog.json`의 notes에 중복 제외 로그(중복 방어 테스트는 `--unique` 없이 2일 실행).
- ja는 문장·단어·회화에 reading(히라가나)이 페이지에 렌더되는지.

## C. 멱등성 확인

```bash
node scripts/settle.js --lang L --date <D>   # 2회째: "이미 정산됨 — no-op" 출력이어야 함
node scripts/prepare.js --lang L --date <D>  # settled 이후: ALREADY_DONE 출력이어야 함
node scripts/build.js                        # 재실행해도 docs/*.html 내용 동일해야 함
```

## D. 재빌드만

템플릿(`scripts/lib/html.js`)이나 `docs/assets/style.css`를 고친 뒤:

```bash
node scripts/build.js                   # data/가 진실의 원천 — 전 언어 페이지 일괄 재생성
```

## E. 시뮬레이션 뒤 초기화 (중요)

시뮬레이션 산출물을 커밋 대상에 남기지 않는다. **실제 운영 데이터가 있는 언어에는 이 절차를 쓰지 말 것**(그 언어의 운영 상태가 지워진다). 언어별로 독립 초기화한다. 아래 `L`은 초기화할 언어.

```bash
rm -rf data/L/2* docs/L/days docs/L/index.html
printf '{\n  "schema_version": 1,\n  "intervals": [1, 3, 7, 14, 30, 60],\n  "words": {}\n}\n' > state/L/words.json
printf '{\n  "schema_version": 1,\n  "runs": {}\n}\n' > state/L/runlog.json
node scripts/build.js                   # docs/에서 시뮬 흔적 제거(허브 포함 재생성)
```

언어 L의 초기 상태 = `state/L/` 두 파일 빈 값, `data/L/`엔 날짜 폴더 없음. `docs/`엔 `.nojekyll`·`assets/`와 build가 만든 허브·언어 인덱스만.

## 테스트

```bash
npm test        # = node --test "tests/**/*.test.js"  (이 PC에선 디렉터리 인자 형태가 안 됨)
```
