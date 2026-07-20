# CLAUDE.md — 다음 세션 인수인계

**목적 한 줄**: 매일 아침 claude.ai 루틴이 영어 학습 페이지(문장 5·단어 20·회화·SRS 퀴즈)를 자동 생성해 GitHub Pages에 올리는 파이프라인.

## 절대 규칙

1. **AI(generate 단계)는 `data/<날짜>/content.json` 하나만 만든다.** 다른 파일 생성·수정 금지.
2. **`state/words.json`을 쓰는 것은 `scripts/settle.js`뿐이다.** 손으로도, 다른 스크립트로도 고치지 않는다.
3. **날짜는 `scripts/lib/dates.js`만 계산한다.** 어디서도 `new Date()`로 날짜 문자열을 직접 만들지 않는다(KST 고정).
4. **`docs/`는 빌드 산출물이다.** 직접 수정 금지 — 고칠 것은 `scripts/lib/html.js`·`docs/assets/style.css`(예외: style.css는 소스임)이고, `node scripts/build.js`로 재생성한다.
5. 외부 의존성 추가 금지(Node 내장만). docs/에 JS 추가 금지(`<details>`로 해결).

## 파이프라인 명령 순서

```bash
node scripts/prepare.js            # ALREADY_DONE이면 그날 완료 상태
# (AI가 prompts/generator.md 지침대로 data/<DATE>/content.json 작성)
node scripts/settle.js             # 검증 + SRS 반영. 유일한 state 쓰기
node scripts/build.js              # docs/ 전체 재생성
node scripts/verify.js             # 커밋 전 게이트 (실패 시 exit 1)
# git add/commit/push는 클라우드 루틴의 마지막 단계(로컬 작업 중엔 사용자 지시 있을 때만)
```

모든 스크립트는 `--date YYYY-MM-DD`로 날짜를 오버라이드할 수 있다(기본: KST 오늘).

## 로컬 시뮬레이션

`.claude/skills/daily-english-run/SKILL.md`의 절차를 따른다. 요약: AI 단계를 `node scripts/mock-generate.js --date D --unique`(픽스처 대역) 또는 세션의 Claude가 직접 작성하는 것으로 대체하고, 끝나면 state/·data/·docs/를 초기 상태로 되돌린다(스킬에 되돌리기 절차 있음).

테스트: `npm test` (= `node --test "tests/**/*.test.js"`; 이 Windows 환경에선 `node --test tests/` 디렉터리 인자가 안 먹힌다).

## 문서 지도

| 문서 | 언제 읽나 |
|---|---|
| `README.md` | 사용자 관점·최초 설정·문제 해결이 궁금할 때 |
| `ARCHITECTURE.md` | 코드를 고치기 전(스키마·SRS 규칙·설계 결정 근거) |
| `PLAN.md` | 범위 판단이 필요할 때(v1/v2 경계, 확정 결정, 리스크) |
| `prompts/generator.md` | generate 단계의 콘텐츠 품질 기준 |
| `prompts/routine.md` | 클라우드 루틴 프롬프트 원본(수정 시 루틴에도 다시 붙여넣어야 함) |
