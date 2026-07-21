# CLAUDE.md — 다음 세션 인수인계

**목적 한 줄**: 매일 아침 GitHub Actions(`.github/workflows/daily.yml`)가 트랙별(en·ja-n1·ja-n2) 학습 페이지(문장 5·단어 20·회화·SRS 퀴즈)를 자동 생성해 GitHub Pages에 올리는 파이프라인. AI 단계는 `claude -p` + 구독 토큰(`CLAUDE_CODE_OAUTH_TOKEN` 시크릿). 콘텐츠는 기초 완료자 대상 "매일 30분·흥미 유지"용(ja는 JLPT N1/N2 취득자 두 난이도).

## 절대 규칙

1. **AI(generate 단계)는 `data/<lang>/<날짜>/content.json` 하나만 만든다.** 다른 파일 생성·수정 금지.
2. **`state/<lang>/words.json`을 쓰는 것은 `scripts/settle.js`뿐이다.** 손으로도, 다른 스크립트로도 고치지 않는다.
3. **날짜는 `scripts/lib/dates.js`만 계산한다.** 어디서도 `new Date()`로 날짜 문자열을 직접 만들지 않는다(KST 고정).
4. **`docs/`는 빌드 산출물이다.** 직접 수정 금지 — 고칠 것은 `scripts/lib/html.js`·`docs/assets/style.css`(예외: style.css는 소스임)이고, `node scripts/build.js`로 재생성한다.
5. 외부 의존성 추가 금지(Node 내장만). docs/에 JS 추가 금지(`<details>`로 해결).
6. **트랙별 설정(프로필·프롬프트 경로·reading 필수 여부)의 단일 소스는 `scripts/lib/langs.js`다**(트랙 = 언어×난이도). 프롬프트에 프로필을 재기재하지 않는다(brief.json 참조로 통일).

## 파이프라인 명령 순서 (트랙별 — `--lang en|ja-n1|ja-n2` 필수, build만 예외)

```bash
node scripts/prepare.js --lang en      # ALREADY_DONE이면 그 언어는 그날 완료 상태
# (AI가 prompts/generator.en.md 지침대로 data/en/<DATE>/content.json 작성)
node scripts/settle.js --lang en       # 검증 + SRS 반영. 유일한 state 쓰기
node scripts/build.js                  # --lang 없음: 항상 전 트랙 + 허브 docs/ 재생성
node scripts/verify.js --lang en       # 커밋 전 게이트 (실패 시 exit 1)
# ja-n1·ja-n2도 같은 순서(generator.ja.md를 두 트랙이 공유, 난이도는 brief의 프로필로 구분)
# 워크플로는 en → ja-n1 → ja-n2 블록 순서, 트랙별 커밋·push(로컬 작업 중엔 사용자 지시 있을 때만)
```

모든 스크립트는 `--date YYYY-MM-DD`로 날짜를 오버라이드할 수 있다(기본: KST 오늘).

## 로컬 시뮬레이션

`.claude/skills/daily-run/SKILL.md`의 절차를 따른다. 요약: AI 단계를 `node scripts/mock-generate.js --lang L --date D --unique`(픽스처 대역) 또는 세션의 Claude가 직접 작성하는 것으로 대체하고, 끝나면 해당 언어의 state/·data/·docs/를 초기 상태로 되돌린다(스킬에 언어별 되돌리기 절차 있음). **운영 데이터가 있는 언어에는 초기화 절차를 쓰지 말 것.**

테스트: `npm test` (= `node --test "tests/**/*.test.js"`; 이 Windows 환경에선 `node --test tests/` 디렉터리 인자가 안 먹힌다).

## 문서 지도

| 문서 | 언제 읽나 |
|---|---|
| `README.md` | 사용자 관점·최초 설정·문제 해결이 궁금할 때 |
| `ARCHITECTURE.md` | 코드를 고치기 전(스키마·SRS 규칙·언어 축·설계 결정 근거) |
| `PLAN.md` | 범위 판단이 필요할 때(v1/v2 경계, 확정 결정, 리스크) |
| `prompts/generator.en.md` / `prompts/generator.ja.md` | generate 단계의 콘텐츠 품질 기준(ja는 ja-n1·ja-n2 공유, 난이도 캘리브레이션 표 내장) |
| `.github/workflows/daily.yml` | 실제 매일 실행 경로(주 경로). en → ja-n1 → ja-n2 블록, 트랙별 커밋 |
| `prompts/routine.md` | claude.ai 클라우드 루틴용 프롬프트(예비 경로 — 현재 미사용, 언어 축 이전 기준) |
