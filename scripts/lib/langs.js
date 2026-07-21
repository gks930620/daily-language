// langs.js — 언어 트랙 레지스트리. 언어별 설정의 유일한 소스.
// 학습자 프로필 문자열의 단일 소스도 여기다(프롬프트에 재기재 금지 — brief.json 참조로 통일).

export const LANGS = {
  en: {
    label: '영어',
    pageTitle: '매일 영어 학습',
    learnerProfile:
      '토익 700, 수능 2등급(10년 전), 회화 초급, 목표 토익 900·시사 독해',
    newWordCandidates: 25,
    maxNewWords: 20,
    promptFile: 'prompts/generator.en.md',
    fixtureFile: 'fixtures/sample-content.en.json',
    requiresReading: false,
  },
  ja: {
    label: '일본어',
    pageTitle: '매일 일본어 학습',
    learnerProfile:
      '입문~초급, 히라가나·가타카나 읽기 가능, 목표 JLPT N4→N3·기초 회화. 문장 난이도 N5~N4',
    newWordCandidates: 25,
    maxNewWords: 20,
    promptFile: 'prompts/generator.ja.md',
    fixtureFile: 'fixtures/sample-content.ja.json',
    requiresReading: true,
  },
};

/**
 * CLI 인자에서 --lang <code>(또는 --lang=<code>)를 읽는다.
 * 기본값 없음 — 미지정·미등록이면 throw. build.js만 예외(--lang을 받지 않고 전 언어 순회).
 * argv는 process.argv.slice(2) 형태를 기대한다.
 */
export function resolveLang(argv = []) {
  let value = null;
  const idx = argv.indexOf('--lang');
  if (idx !== -1) {
    value = argv[idx + 1];
  } else {
    const eq = argv.find((a) => typeof a === 'string' && a.startsWith('--lang='));
    if (eq) value = eq.slice('--lang='.length);
  }
  if (!value) {
    throw new Error(
      `--lang 필수 (등록된 언어: ${Object.keys(LANGS).join(', ')})`
    );
  }
  if (!LANGS[value]) {
    throw new Error(
      `--lang 값이 잘못됨: "${value}" (등록된 언어: ${Object.keys(LANGS).join(', ')})`
    );
  }
  return value;
}
