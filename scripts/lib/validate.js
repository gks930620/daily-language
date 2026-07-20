// validate.js — AI가 생성한 content.json의 수제 스키마 검증.
// 외부 의존성 없이, 실패한 필드의 경로를 그대로 찍어 준다.

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

/**
 * content.json 검증. 에러 메시지 배열을 돌려준다(빈 배열 = 통과).
 * 각 메시지는 "필드경로: 이유" 형태.
 */
export function validateContent(content, expectedDate) {
  const errors = [];
  const push = (path, msg) => errors.push(`${path}: ${msg}`);

  if (content === null || typeof content !== 'object' || Array.isArray(content)) {
    return ['(root): JSON 객체가 아님'];
  }

  if (content.schema_version !== 1) {
    push('schema_version', `1이어야 함 (현재: ${JSON.stringify(content.schema_version)})`);
  }

  if (!isNonEmptyString(content.date)) {
    push('date', '비어 있지 않은 문자열이어야 함');
  } else if (expectedDate && content.date !== expectedDate) {
    push('date', `"${expectedDate}"여야 함 (현재: "${content.date}")`);
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

  // --- words: 20~25개 ---
  if (!Array.isArray(content.words)) {
    push('words', '배열이어야 함');
  } else {
    if (content.words.length < 20 || content.words.length > 25) {
      push('words', `20~25개여야 함 (현재: ${content.words.length}개)`);
    }
    content.words.forEach((w, i) => {
      const p = `words[${i}]`;
      if (w === null || typeof w !== 'object') {
        push(p, '객체여야 함');
        return;
      }
      for (const f of ['headword', 'pos', 'ko', 'example_en', 'example_ko']) {
        if (!isNonEmptyString(w[f])) push(`${p}.${f}`, '비어 있지 않은 문자열이어야 함');
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
    });
  }

  // --- conversation: lines 6개 이상 ---
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

  return errors;
}

/** 검증 실패 시 모든 에러를 담아 throw. 통과하면 content를 그대로 돌려준다. */
export function assertValidContent(content, expectedDate) {
  const errors = validateContent(content, expectedDate);
  if (errors.length > 0) {
    const err = new Error(
      `content.json 검증 실패 (${errors.length}건):\n- ${errors.join('\n- ')}`
    );
    err.validationErrors = errors;
    throw err;
  }
  return content;
}
