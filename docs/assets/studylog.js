// studylog.js — 공부 진도 통계의 순수 함수. 파일도 네트워크도 건드리지 않는다.
//
// **기록을 쓰는 곳은 이 저장소가 아니다.** 진도는 Railway의 API 서버가 MySQL에 저장하고
// (api/src/db.js), 이 파일은 그렇게 받아온 기록을 **읽어서 통계로 바꾸는 일만** 한다.
//
// 이 파일은 두 곳에서 같이 쓰인다:
//   - scripts/lib/html.js — 진도 버튼의 라벨(LEVELS)
//   - docs/assets/studylog.js — build.js가 그대로 복사해 브라우저가 import한다
// 그래서 통계 로직이 한 벌뿐이고, tests/studylog.test.js가 양쪽을 동시에 지킨다.
//
// 입력 log의 모양은 API의 GET /study/me 응답 그대로다:
//   { schema_version: 1, days: { "2026-08-10": { en: "full", "ja-n1": "half" } } }

/** 진도 3단계. 순서가 곧 크기이고, weight는 "평균 진도" 계산에만 쓴다. */
export const LEVELS = {
  little: { label: '조금', weight: 30, dots: '●○○' },
  half: { label: '절반', weight: 60, dots: '●●○' },
  full: { label: '다 함', weight: 100, dots: '●●●' },
};

/** 그날 그 트랙의 진도 단계. 기록이 없거나 모르는 값이면 null. */
export function levelOf(log, date, lang) {
  const v = log?.days?.[date]?.[lang];
  return Object.hasOwn(LEVELS, v ?? '') ? v : null;
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
