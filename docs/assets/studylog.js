// studylog.js — 공부 진도 기록(state/study-log.json)의 순수 함수.
// 파일을 읽거나 쓰지 않는다. 실제로 쓰는 곳은 scripts/checkin.js 하나다.
//
// 기록하는 것: "어느 날, 어느 트랙을, 얼마나 했는가"(사용자가 직접 고른 3단계).
// 단순 방문 여부가 아니다 — 페이지를 열었는지가 아니라 본인이 신고한 진도가 기준이다.
// 분모(그날 그 트랙에 콘텐츠가 있었는가)는 data/<lang>/<날짜>/ 존재 여부라 여기 저장하지 않는다.

export const STUDY_LOG_SCHEMA_VERSION = 1;

/** 진도 3단계. 순서가 곧 크기이고, weight는 "평균 진도" 계산에만 쓴다. */
export const LEVELS = {
  little: { label: '조금', weight: 30, dots: '●○○' },
  half: { label: '절반', weight: 60, dots: '●●○' },
  full: { label: '다 함', weight: 100, dots: '●●●' },
};

/** 등록된 진도 단계인가. 이슈 제목 파싱의 방어선. */
export function isLevel(v) {
  return typeof v === 'string' && Object.hasOwn(LEVELS, v);
}

/** state/study-log.json의 초기(빈) 구조. */
export function emptyStudyLog() {
  return { schema_version: STUDY_LOG_SCHEMA_VERSION, days: {} };
}

/**
 * 진도 기록. 순수 함수 — 새 객체를 돌려준다.
 * 같은 (날짜, 트랙)을 다시 기록하면 **나중 것이 이긴다** — 잘못 눌렀을 때 다시 눌러 고칠 수 있고,
 * 아침에 "조금"을 눌렀다가 저녁에 "다 함"으로 올리는 것도 자연스럽다.
 */
export function recordStudy(log, date, lang, level) {
  if (!isLevel(level)) throw new Error(`알 수 없는 진도 단계: ${JSON.stringify(level)}`);
  const days = { ...(log?.days ?? {}) };
  days[date] = { ...(days[date] ?? {}), [lang]: level };
  return { schema_version: STUDY_LOG_SCHEMA_VERSION, days };
}

/** 그날 그 트랙의 진도 단계. 기록이 없으면 null. */
export function levelOf(log, date, lang) {
  const v = log?.days?.[date]?.[lang];
  return isLevel(v) ? v : null;
}

/**
 * 한 트랙의 통계. availableDays = 그 트랙에 콘텐츠가 있는 날짜 배열.
 *
 * 분모는 "콘텐츠가 있었던 날"만 센다 — 파이프라인이 안 돌아 콘텐츠가 없던 날을
 * 게으름으로 세면 기록이 거짓말이 된다.
 * 평균 진도는 기록 없는 날을 0으로 쳐서 전체 날짜로 나눈다(안 한 날도 성적에 들어간다).
 * 연속(streak)은 진도 단계와 무관하게 "뭐라도 기록한 날"을 잇고, 달력이 아니라
 * availableDays 순서로 센다. 가장 최근 하루는 아직 공부 전일 수 있어 한 번 유예한다.
 */
export function trackStats(log, lang, availableDays) {
  const days = [...availableDays].sort();
  const levels = days.map((d) => levelOf(log, d, lang));
  const recorded = levels.filter(Boolean);

  const counts = { little: 0, half: 0, full: 0 };
  let weightSum = 0;
  for (const lv of recorded) {
    counts[lv]++;
    weightSum += LEVELS[lv].weight;
  }

  let longest = 0;
  let run = 0;
  for (const lv of levels) {
    run = lv ? run + 1 : 0;
    if (run > longest) longest = run;
  }

  let i = levels.length - 1;
  if (i >= 0 && !levels[i]) i--; // 가장 최근 하루는 유예(오늘 콘텐츠가 막 생겼을 수 있다)
  let current = 0;
  while (i >= 0 && levels[i]) {
    current++;
    i--;
  }

  return {
    lang,
    total: days.length,
    recorded: recorded.length,
    counts,
    /** 기록한 날 비율(%) */
    recordedPercent:
      days.length === 0 ? 0 : Math.round((recorded.length / days.length) * 100),
    /** 평균 진도(%) — 안 한 날 0점 포함 */
    avgProgress: days.length === 0 ? 0 : Math.round(weightSum / days.length),
    currentStreak: current,
    longestStreak: longest,
  };
}

/**
 * 날짜별 표의 행. daysByLang은 { lang: [날짜...] }.
 * 전 트랙 날짜의 합집합을 내림차순으로, 각 날짜마다 트랙별 상태를 돌려준다.
 * level: 진도 단계 문자열 · null(콘텐츠는 있는데 기록 없음)
 * available: 그날 그 트랙에 콘텐츠가 있었는가(false면 표에서 "—")
 */
export function studyRows(log, daysByLang, langs) {
  const all = [...new Set(Object.values(daysByLang).flat())].sort().reverse();
  return all.map((date) => ({
    date,
    tracks: langs.map((lang) => {
      const available = (daysByLang[lang] ?? []).includes(date);
      return { lang, available, level: available ? levelOf(log, date, lang) : null };
    }),
  }));
}
