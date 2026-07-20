// dates.js — 이 저장소에서 날짜를 다루는 유일한 소스.
// 모든 날짜는 KST(UTC+9) 기준의 "YYYY-MM-DD" 문자열로 통일한다.

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** "YYYY-MM-DD" 형식이면서 실제 존재하는 날짜인지 검사한다. */
export function isValidDateString(s) {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

/** 지금 시각 기준 KST 오늘 날짜. now(ms epoch)는 테스트용 주입 포인트. */
export function todayKST(now = Date.now()) {
  return new Date(now + KST_OFFSET_MS).toISOString().slice(0, 10);
}

/** "YYYY-MM-DD"에 일수를 더한(음수면 뺀) 날짜 문자열을 돌려준다. */
export function addDays(dateStr, days) {
  if (!isValidDateString(dateStr)) {
    throw new Error(`addDays: 잘못된 날짜 문자열 "${dateStr}"`);
  }
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** 두 날짜의 차이(b - a)를 일수로 돌려준다. */
export function diffDays(a, b) {
  if (!isValidDateString(a) || !isValidDateString(b)) {
    throw new Error(`diffDays: 잘못된 날짜 문자열 "${a}", "${b}"`);
  }
  const toMs = (s) => {
    const [y, m, d] = s.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toMs(b) - toMs(a)) / (24 * 60 * 60 * 1000));
}

/**
 * CLI 인자에서 --date YYYY-MM-DD 오버라이드를 읽는다.
 * 없으면 KST 오늘. 형식이 틀리면 throw.
 * argv는 process.argv.slice(2) 형태를 기대한다.
 */
export function resolveDate(argv = [], now = Date.now()) {
  const idx = argv.indexOf('--date');
  if (idx === -1) {
    // --date=YYYY-MM-DD 형태도 허용
    const eq = argv.find((a) => a.startsWith('--date='));
    if (eq) {
      const v = eq.slice('--date='.length);
      if (!isValidDateString(v)) {
        throw new Error(`--date 값이 잘못됨: "${v}" (YYYY-MM-DD 필요)`);
      }
      return v;
    }
    return todayKST(now);
  }
  const v = argv[idx + 1];
  if (!isValidDateString(v)) {
    throw new Error(`--date 값이 잘못됨: "${v}" (YYYY-MM-DD 필요)`);
  }
  return v;
}
