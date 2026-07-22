// validate.js — AI가 생성한 content.json의 수제 스키마 검증.
// 외부 의존성 없이, 실패한 필드의 경로를 그대로 찍어 준다.

import { LANGS } from './langs.js';

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

/**
 * content.json 검증. 에러 메시지 배열을 돌려준다(빈 배열 = 통과).
 * 각 메시지는 "필드경로: 이유" 형태.
 * lang: 파이프라인의 --lang 값. content.lang과 교차검증하고,
 * requiresReading 언어면 sentences/words의 reading을 필수 검사한다.
 * conversation은 선택 — 있으면 lines의 reading도 검사, 없으면 스킵(2026-07-22 회화 제거).
 */
export function validateContent(content, expectedDate, lang) {
  if (!lang || !LANGS[lang]) {
    throw new Error(`validateContent: 유효한 lang 필수 (받은 값: ${JSON.stringify(lang)})`);
  }
  const requiresReading = LANGS[lang].requiresReading;
  const errors = [];
  const push = (path, msg) => errors.push(`${path}: ${msg}`);

  if (content === null || typeof content !== 'object' || Array.isArray(content)) {
    return ['(root): JSON 객체가 아님'];
  }

  if (content.schema_version !== 1) {
    push('schema_version', `1이어야 함 (현재: ${JSON.stringify(content.schema_version)})`);
  }

  if (!isNonEmptyString(content.lang)) {
    push('lang', `"${lang}"이어야 함 (현재: ${JSON.stringify(content.lang)})`);
  } else if (content.lang !== lang) {
    push('lang', `"${lang}"이어야 함 (현재: "${content.lang}")`);
  }

  if (!isNonEmptyString(content.date)) {
    push('date', '비어 있지 않은 문자열이어야 함');
  } else if (expectedDate && content.date !== expectedDate) {
    push('date', `"${expectedDate}"여야 함 (현재: "${content.date}")`);
  }

  // passage_note — 문단(하나의 글에서 이어진 5문장)의 종류·주제 한 줄. 전 트랙 필수.
  // 과거 데이터는 재검증되지 않으므로 렌더 쪽은 "있으면 렌더"로 하위 호환.
  if (!isNonEmptyString(content.passage_note)) {
    push('passage_note', '비어 있지 않은 문자열이어야 함 (문단의 종류·주제 한 줄)');
  }

  // --- sentences: 정확히 5개 ---
  if (!Array.isArray(content.sentences)) {
    push('sentences', '배열이어야 함');
  } else {
    if (content.sentences.length !== 5) {
      push('sentences', `정확히 5개여야 함 (현재: ${content.sentences.length}개)`);
    }
    content.sentences.forEach((s, i) => {
      const p = `sentences[${i}]`;
      if (s === null || typeof s !== 'object') {
        push(p, '객체여야 함');
        return;
      }
      for (const f of ['en', 'ko', 'structure']) {
        if (!isNonEmptyString(s[f])) push(`${p}.${f}`, '비어 있지 않은 문자열이어야 함');
      }
      if (requiresReading && !isNonEmptyString(s.reading)) {
        push(`${p}.reading`, '비어 있지 않은 문자열이어야 함 (reading 필수 언어)');
      }
      if (s.vocab_notes !== undefined) {
        if (!Array.isArray(s.vocab_notes)) {
          push(`${p}.vocab_notes`, '배열이어야 함');
        } else {
          s.vocab_notes.forEach((v, j) => {
            for (const f of ['word', 'ko']) {
              if (!isNonEmptyString(v?.[f])) {
                push(`${p}.vocab_notes[${j}].${f}`, '비어 있지 않은 문자열이어야 함');
              }
            }
          });
        }
      }
    });
  }

  // --- words: 15~18개(후보 수 기준 — settle이 최종 15개 선별) ---
  if (!Array.isArray(content.words)) {
    push('words', '배열이어야 함');
  } else {
    if (content.words.length < 15 || content.words.length > 18) {
      push('words', `15~18개여야 함 (현재: ${content.words.length}개)`);
    }
    content.words.forEach((w, i) => {
      const p = `words[${i}]`;
      if (w === null || typeof w !== 'object') {
        push(p, '객체여야 함');
        return;
      }
      // note(단어 지식)는 전 트랙 필수 — 무작위 나열 대신 암기를 돕는 지식 한 줄(사용자 확정).
      for (const f of ['headword', 'pos', 'ko', 'example_en', 'example_ko', 'note']) {
        if (!isNonEmptyString(w[f])) push(`${p}.${f}`, '비어 있지 않은 문자열이어야 함');
      }
      if (requiresReading && !isNonEmptyString(w.reading)) {
        push(`${p}.reading`, '비어 있지 않은 문자열이어야 함 (reading 필수 언어)');
      }
      if (w.collocations !== undefined) {
        if (!Array.isArray(w.collocations)) {
          push(`${p}.collocations`, '배열이어야 함');
        } else {
          w.collocations.forEach((c, j) => {
            if (!isNonEmptyString(c)) {
              push(`${p}.collocations[${j}]`, '비어 있지 않은 문자열이어야 함');
            }
          });
        }
      }
      // family(파생형)는 선택 — 있으면 항목별로 word·ko 필수, pos 선택.
      if (w.family !== undefined) {
        if (!Array.isArray(w.family)) {
          push(`${p}.family`, '배열이어야 함');
        } else {
          w.family.forEach((m, j) => {
            for (const f of ['word', 'ko']) {
              if (!isNonEmptyString(m?.[f])) {
                push(`${p}.family[${j}].${f}`, '비어 있지 않은 문자열이어야 함');
              }
            }
            if (m?.pos !== undefined && !isNonEmptyString(m.pos)) {
              push(`${p}.family[${j}].pos`, '있으면 비어 있지 않은 문자열이어야 함');
            }
          });
        }
      }
      // related(혼동어·유의어·반의어)도 선택 — 있으면 항목별로 word·note 필수, ko 선택.
      if (w.related !== undefined) {
        if (!Array.isArray(w.related)) {
          push(`${p}.related`, '배열이어야 함');
        } else {
          w.related.forEach((r, j) => {
            for (const f of ['word', 'note']) {
              if (!isNonEmptyString(r?.[f])) {
                push(`${p}.related[${j}].${f}`, '비어 있지 않은 문자열이어야 함');
              }
            }
            if (r?.ko !== undefined && !isNonEmptyString(r.ko)) {
              push(`${p}.related[${j}].ko`, '있으면 비어 있지 않은 문자열이어야 함');
            }
          });
        }
      }
    });
  }

  // --- conversation: 선택(사용자 확정 2026-07-22 — 회화 섹션 제거) ---
  // 없으면 검사 스킵(에러 아님). 있으면(과거 데이터·재도입 대비) 기존 규칙으로 검증한다.
  if (content.conversation !== undefined) {
    const conv = content.conversation;
    if (conv === null || typeof conv !== 'object' || Array.isArray(conv)) {
      push('conversation', '객체여야 함');
    } else {
      for (const f of ['topic', 'situation_ko']) {
        if (!isNonEmptyString(conv[f])) push(`conversation.${f}`, '비어 있지 않은 문자열이어야 함');
      }
      if (!Array.isArray(conv.lines)) {
        push('conversation.lines', '배열이어야 함');
      } else {
        if (conv.lines.length < 6) {
          push('conversation.lines', `6개 이상이어야 함 (현재: ${conv.lines.length}개)`);
        }
        conv.lines.forEach((l, i) => {
          const p = `conversation.lines[${i}]`;
          for (const f of ['speaker', 'en', 'ko']) {
            if (!isNonEmptyString(l?.[f])) push(`${p}.${f}`, '비어 있지 않은 문자열이어야 함');
          }
          if (requiresReading && !isNonEmptyString(l?.reading)) {
            push(`${p}.reading`, '비어 있지 않은 문자열이어야 함 (reading 필수 언어)');
          }
        });
      }
      if (!Array.isArray(conv.key_expressions) || conv.key_expressions.length < 1) {
        push('conversation.key_expressions', '1개 이상의 배열이어야 함');
      } else {
        conv.key_expressions.forEach((k, i) => {
          const p = `conversation.key_expressions[${i}]`;
          for (const f of ['en', 'ko']) {
            if (!isNonEmptyString(k?.[f])) push(`${p}.${f}`, '비어 있지 않은 문자열이어야 함');
          }
        });
      }
    }
  }

  return errors;
}

/** 검증 실패 시 모든 에러를 담아 throw. 통과하면 content를 그대로 돌려준다. */
export function assertValidContent(content, expectedDate, lang) {
  const errors = validateContent(content, expectedDate, lang);
  if (errors.length > 0) {
    const err = new Error(
      `content.json 검증 실패 (${errors.length}건):\n- ${errors.join('\n- ')}`
    );
    err.validationErrors = errors;
    throw err;
  }
  return content;
}
