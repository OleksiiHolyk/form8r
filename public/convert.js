// Convert a parsed JSON value to other formats. Pure, no dependencies.
// Only JSON -> YAML and JSON -> CSV are supported (no reverse parsing).

// --- YAML -------------------------------------------------------------------

function isColl(v) {
  return v !== null && typeof v === "object";
}
function isEmptyColl(v) {
  return isColl(v) && (Array.isArray(v) ? v.length === 0 : Object.keys(v).length === 0);
}

// Render a scalar (or empty collection) as a YAML token, quoting when needed.
function yamlScalar(v) {
  if (v === null) return "null";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "null";

  const s = String(v);
  const needsQuote =
    s === "" ||
    /[:#\[\]{}&*!|>'"%@`,]/.test(s) || // YAML indicators / specials
    /^[\s-]/.test(s) ||
    /[\s]$/.test(s) || // leading dash or surrounding whitespace
    /[\n\t]/.test(s) ||
    /^(true|false|null|yes|no|on|off|~)$/i.test(s) || // would read as a keyword
    /^[+-]?(\d|\.\d)/.test(s); // would read as a number
  // JSON-style double quoting is valid YAML and unambiguous.
  return needsQuote ? JSON.stringify(s) : s;
}

function tokenFor(v) {
  if (isEmptyColl(v)) return Array.isArray(v) ? "[]" : "{}";
  return yamlScalar(v);
}

function emitYaml(value, indent, lines) {
  const pad = "  ".repeat(indent);
  if (Array.isArray(value)) {
    for (const item of value) {
      if (isColl(item) && !isEmptyColl(item)) {
        lines.push(pad + "-");
        emitYaml(item, indent + 1, lines);
      } else {
        lines.push(pad + "- " + tokenFor(item));
      }
    }
  } else {
    for (const [k, v] of Object.entries(value)) {
      const key = yamlScalar(k);
      if (isColl(v) && !isEmptyColl(v)) {
        lines.push(pad + key + ":");
        emitYaml(v, indent + 1, lines);
      } else {
        lines.push(pad + key + ": " + tokenFor(v));
      }
    }
  }
}

/** Serialize a JSON value to YAML text. */
export function toYaml(value) {
  if (!isColl(value)) return yamlScalar(value) + "\n";
  if (isEmptyColl(value)) return tokenFor(value) + "\n";
  const lines = [];
  emitYaml(value, 0, lines);
  return lines.join("\n") + "\n";
}

// --- CSV --------------------------------------------------------------------

function csvCell(v) {
  if (v === undefined || v === null) return "";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  // Quote if the cell contains a comma, quote, or newline; escape quotes by doubling.
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

/**
 * Export a JSON value to CSV.
 * - array of objects   -> header row + one row per object (columns = union of keys)
 * - array of primitives -> single "value" column
 * - single object       -> one data row
 * Throws for anything else.
 */
export function toCsv(value) {
  let rows;
  if (Array.isArray(value)) {
    if (value.length === 0) return "";
    const allObjects = value.every((v) => v !== null && typeof v === "object" && !Array.isArray(v));
    if (allObjects) {
      rows = value;
    } else {
      return "value\n" + value.map(csvCell).join("\n");
    }
  } else if (value !== null && typeof value === "object") {
    rows = [value];
  } else {
    throw new Error("CSV export needs an array of objects (or a single object).");
  }

  const cols = [];
  for (const row of rows) {
    for (const key of Object.keys(row)) if (!cols.includes(key)) cols.push(key);
  }
  const header = cols.map(csvCell).join(",");
  const body = rows.map((row) => cols.map((c) => csvCell(row[c])).join(",")).join("\n");
  return header + "\n" + body;
}
