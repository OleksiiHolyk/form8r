// Pure JSON helpers. No I/O, no network — safe to run in a worker or main thread.

/** Indent value -> string/number the formatter understands. */
export function indentToken(indent) {
  if (indent === "tab") return "\t";
  const n = Number(indent);
  return Number.isFinite(n) ? n : 2;
}

/** Compute 1-based line/column from a character offset. */
function lineColFromPosition(text, position) {
  let line = 1;
  let column = 1;
  const end = Math.min(position, text.length);
  for (let i = 0; i < end; i++) {
    if (text[i] === "\n") {
      line++;
      column = 1;
    } else {
      column++;
    }
  }
  return { line, column };
}

/** Compute a 0-based character offset from a 1-based line/column. */
function positionFromLineCol(text, line, column) {
  let offset = 0;
  let curLine = 1;
  while (curLine < line && offset < text.length) {
    if (text[offset] === "\n") curLine++;
    offset++;
  }
  return offset + Math.max(0, (column || 1) - 1);
}

/** Make engine error messages a bit friendlier. */
function humanizeError(raw) {
  let m = raw.replace(/^JSON\.parse:\s*/, "").replace(/\s*in JSON.*$/i, "");
  m = m.replace(/Unexpected token '?(.)'?,?.*/i, "Unexpected character '$1'");
  if (/Unexpected end of (JSON )?input/i.test(raw)) {
    m = "Unexpected end of input — something is left unclosed (a bracket, brace, or quote)";
  }
  return m.trim() || raw;
}

/**
 * Parse JSON, returning structured, human-friendly errors with line/column.
 * @returns {{ok:true, value:*}|{ok:false, error:{message:string, line?:number, column?:number, position?:number}}}
 */
export function parseJson(text) {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    const error = { message: raw };

    // V8 (newer): "... in JSON at position 123 (line 4 column 6)"
    const lineCol = raw.match(/line (\d+) column (\d+)/i);
    const pos = raw.match(/position (\d+)/i);

    if (lineCol) {
      error.line = Number(lineCol[1]);
      error.column = Number(lineCol[2]);
    }
    if (pos) {
      error.position = Number(pos[1]);
      if (!lineCol) {
        const lc = lineColFromPosition(text, error.position);
        error.line = lc.line;
        error.column = lc.column;
      }
    } else if (lineCol) {
      // Only line/column reported (e.g. Firefox) — derive the offset.
      error.position = positionFromLineCol(text, error.line, error.column);
    }

    // "Unexpected end of input" (e.g. a missing closing bracket): point at the end.
    if (error.position === undefined && /unexpected end of/i.test(raw)) {
      error.position = text.length;
    }

    // Always expose a numeric position so callers can safely highlight it,
    // and derive line/column from it when the engine didn't report them.
    if (typeof error.position !== "number") error.position = 0;
    if (error.line === undefined) {
      const lc = lineColFromPosition(text, error.position);
      error.line = lc.line;
      error.column = lc.column;
    }

    error.message = humanizeError(raw);
    return { ok: false, error };
  }
}

export function beautify(text, indent) {
  const res = parseJson(text);
  if (!res.ok) return res;
  return { ok: true, value: res.value, output: JSON.stringify(res.value, null, indent) };
}

export function minify(text) {
  const res = parseJson(text);
  if (!res.ok) return res;
  return { ok: true, value: res.value, output: JSON.stringify(res.value) };
}
