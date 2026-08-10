// cookies.js — 쿠키 읽기/쓰기 헬퍼. 의존성 없이 필요한 만큼만.

/** Cookie 헤더에서 이름 하나를 꺼낸다. 없으면 null. */
export function readCookie(header, name) {
  if (typeof header !== 'string') return null;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) {
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return null;
}

/**
 * Set-Cookie 값을 만든다.
 * HttpOnly·Secure는 항상 켠다 — JS가 읽지 못하게, 그리고 HTTPS로만 오가게.
 */
export function serializeCookie(name, value, { maxAge, domain, sameSite = 'Lax', path = '/' } = {}) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${path}`,
    'HttpOnly',
    'Secure',
    `SameSite=${sameSite}`,
  ];
  if (typeof maxAge === 'number') parts.push(`Max-Age=${Math.floor(maxAge)}`);
  if (domain) parts.push(`Domain=${domain}`);
  return parts.join('; ');
}

/** 쿠키 삭제용(값 비우고 즉시 만료). */
export function clearCookie(name, { domain, path = '/' } = {}) {
  return serializeCookie(name, '', { maxAge: 0, domain, path });
}
