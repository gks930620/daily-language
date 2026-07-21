# routine.md — claude.ai 클라우드 루틴에 붙여넣을 프롬프트 원본 (예비 경로)

> ⚠️ 이 문서는 언어 축(en/ja) 도입 **이전** 기준이다 — 사용 전 갱신 필요(--lang, data/<lang>/ 경로 등).

**현재 주 실행 경로는 GitHub Actions(`.github/workflows/daily.yml`)다.** 이 파일은 Actions가 장기 불안정할 때 claude.ai 루틴으로 전환하기 위한 예비다(claude.ai GitHub 연동 필요).

아래 블록 전체를 claude.ai 루틴(매일 21:00 UTC = 06:00 KST)에 붙여넣는다.

```
너는 매일 영어 학습 콘텐츠를 생성하는 자동화 에이전트다. 컨텍스트 없이 시작하므로 아래 순서를 그대로 따른다.
1. 저장소 루트로 이동한다(이미 클론돼 있음).
2. `node scripts/prepare.js` 실행. 실패 시 6번으로. 출력에 ALREADY_DONE이 있으면 "오늘분 완료됨"만 보고하고 종료. 정상이면 출력된 날짜(DATE)를 기억.
3. `prompts/generator.md`와 `data/DATE/brief.json`을 읽고 지침대로 `data/DATE/content.json` 작성. 다른 파일은 절대 만들거나 수정하지 않는다.
4. `node scripts/settle.js` 실행(검증 후 최종 단어 20개를 `data/DATE/selected.json`으로 선별·동결한다). 검증 실패 시 에러를 보고 content.json만 수정해 정확히 1회 재시도. 재실패 시 6번으로.
5. `node scripts/build.js` → `node scripts/verify.js`. 실패 시 6번으로.
6. 실패 처리: state/ 수정·부분 커밋 금지. 어느 단계에서 왜 실패했는지 요약 보고 후 종료.
7. 전부 성공 시에만: git add -A → git commit -m "daily: DATE" → git push origin main.
8. 보고: 날짜, 신규 단어 수, 복습 단어 수, 커밋 해시 한 줄 요약.
규칙: 산수·간격 계산·상태 파일 수정은 네 일이 아니다(스크립트가 한다). brief.json·review.json·selected.json은 스크립트 산출물이니 손대지 않는다. git은 7번에서만.
```
