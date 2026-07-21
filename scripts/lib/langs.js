// langs.js — 학습 트랙 레지스트리. 트랙(언어×난이도)별 설정의 유일한 소스.
// 학습자 프로필 문자열의 단일 소스도 여기다(프롬프트에 재기재 금지 — brief.json 참조로 통일).
//
// 설계 전제(사용자 확정): 기초 문법·어휘는 정해진 커리큘럼으로 각자 학습한다.
// 여기서 생성하는 콘텐츠는 "기초가 끝난 학습자가 흥미를 잃지 않고 매일 30분"을 위한 것이므로,
// 모든 트랙의 프로필은 기초 완료를 전제로 쓴다.
// 일본어는 JLPT 취득 등급 기준 두 난이도(ja-n1: N1 취득자, ja-n2: N2 취득자).
// 두 ja 트랙은 프롬프트·픽스처를 공유하고, 난이도는 learnerProfile(→ brief.json)로 주입된다.

export const LANGS = {
  en: {
    label: '영어',
    pageTitle: '매일 영어 학습',
    learnerProfile:
      '기초 문법·어휘는 완료. 토익 700, 수능 2등급(10년 전), 회화 초급. 목표: 토익 900·시사 독해·실전 회화. 매일 30분 분량',
    newWordCandidates: 25,
    maxNewWords: 20,
    promptFile: 'prompts/generator.en.md',
    fixtureFile: 'fixtures/sample-content.en.json',
    requiresReading: false,
  },
  'ja-n1': {
    label: '일본어 N1',
    pageTitle: '매일 일본어 학습 (N1 취득자)',
    learnerProfile:
      'JLPT N1 취득자. 시험 대비·기초는 완료 — 유지와 확장이 목적. 사설·칼럼·문학 수준 독해, 관용구·경어·뉘앙스, 완전히 자연스러운 구어. 매일 30분 분량',
    newWordCandidates: 25,
    maxNewWords: 20,
    promptFile: 'prompts/generator.ja.md',
    fixtureFile: 'fixtures/sample-content.ja.json',
    requiresReading: true,
  },
  'ja-n2': {
    label: '일본어 N2',
    pageTitle: '매일 일본어 학습 (N2 취득자)',
    learnerProfile:
      'JLPT N2 취득자, N1 지향. 뉴스 기사·에세이 수준 문장에 N1 문형·어휘를 자연스럽게 노출, 드라마 수준 실전 회화. 매일 30분 분량',
    newWordCandidates: 25,
    maxNewWords: 20,
    promptFile: 'prompts/generator.ja.md',
    fixtureFile: 'fixtures/sample-content.ja.json',
    requiresReading: true,
  },
};

/**
 * CLI 인자에서 --lang <code>(또는 --lang=<code>)를 읽는다.
 * 기본값 없음 — 미지정·미등록이면 throw. build.js만 예외(--lang을 받지 않고 전 트랙 순회).
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
      `--lang 필수 (등록된 트랙: ${Object.keys(LANGS).join(', ')})`
    );
  }
  if (!LANGS[value]) {
    throw new Error(
      `--lang 값이 잘못됨: "${value}" (등록된 트랙: ${Object.keys(LANGS).join(', ')})`
    );
  }
  return value;
}
