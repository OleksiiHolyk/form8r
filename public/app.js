import { parseJson, indentToken, sortKeysDeep } from "./json.js";
import { renderTree, setAllCollapsed } from "./tree.js";
import { toYaml, toCsv } from "./convert.js";

// --- Network watchdog -------------------------------------------------------
// form8r makes zero network calls. We prove it by wrapping every browser API
// that could send data and counting any use. If the count ever leaves 0,
// the indicator turns red. (Service-worker app caching runs in a separate
// context and is not data exfiltration, so it is intentionally not counted.)
let netCount = 0;
function bumpNet() {
  netCount++;
  const ind = document.getElementById("netIndicator");
  const label = document.getElementById("netLabel");
  if (ind) ind.classList.add("dirty");
  if (label) label.textContent = `${netCount} network request${netCount === 1 ? "" : "s"}`;
}
(() => {
  const _fetch = window.fetch;
  window.fetch = function (...args) {
    bumpNet();
    return _fetch.apply(this, args);
  };
  const _open = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (...args) {
    bumpNet();
    return _open.apply(this, args);
  };
  if (navigator.sendBeacon) {
    const _beacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = (...args) => {
      bumpNet();
      return _beacon(...args);
    };
  }
})();

// --- DOM refs ---------------------------------------------------------------
const $ = (id) => document.getElementById(id);
const input = $("input");
const output = $("output");
const treeEl = $("tree");
const status = $("status");
const indentSelect = $("indentSelect");
const fileInput = $("fileInput");
const gutter = $("gutter");
const sortKeys = $("sortKeys");
const searchInput = $("searchInput");
const searchCount = $("searchCount");
const formatSelect = $("formatSelect");

let lastOutput = ""; // current formatted output text, without any search markup
let lastValue; // last successfully parsed JSON value (for the tree view)

const BIG = 500_000; // chars; above this we offload to a worker
let worker = null;
let reqId = 0;

function getWorker() {
  if (!worker) {
    worker = new Worker("/worker.js", { type: "module" });
  }
  return worker;
}

function setStatus(msg, kind = "") {
  status.className = "status" + (kind ? " " + kind : "");
  status.textContent = msg;
}

// Render line numbers for the input box, optionally highlighting the error line.
function updateGutter(errorLine) {
  const count = input.value.split("\n").length;
  let html = "";
  for (let i = 1; i <= count; i++) {
    html += i === errorLine ? `<span class="err-line">${i}</span>\n` : i + "\n";
  }
  gutter.innerHTML = html;
  gutter.scrollTop = input.scrollTop;
}

// Keep the gutter vertically aligned with the textarea as it scrolls.
input.addEventListener("scroll", () => {
  gutter.scrollTop = input.scrollTop;
});
// Re-number (and clear any error highlight) as the user edits.
input.addEventListener("input", () => updateGutter());

function showOutput(text) {
  lastOutput = text;
  if (searchInput.value) {
    applySearch();
  } else {
    output.textContent = text;
  }
  if (!treeEl.classList.contains("hidden")) {
    // The tree always shows JSON structure, even when the text is YAML/CSV.
    if (lastValue !== undefined) {
      renderTree(treeEl, lastValue);
    } else {
      const res = parseJson(text);
      if (res.ok) renderTree(treeEl, res.value);
    }
  }
}

function reportError(error) {
  const { line, column, message, position } = error;
  const loc = line ? ` (line ${line}${column ? `, column ${column}` : ""})` : "";
  setStatus(`✗ ${message ?? "Invalid JSON"}${loc}`, "err");
  updateGutter(line);
  highlightError(position, line);
}

// Jump the input box to the offending spot, select it, and scroll it into view.
function highlightError(position, line) {
  if (typeof position !== "number") return;
  const pos = Math.max(0, Math.min(position, input.value.length));
  input.focus();
  input.setSelectionRange(pos, Math.min(pos + 1, input.value.length));
  const lh = parseFloat(getComputedStyle(input).lineHeight) || 18;
  input.scrollTop = Math.max(0, ((line || 1) - 3) * lh);
  gutter.scrollTop = input.scrollTop;
}

function run(mode) {
  const text = input.value;
  if (!text.trim()) {
    setStatus("Nothing to format.", "");
    output.textContent = "";
    lastOutput = "";
    lastValue = undefined;
    searchCount.textContent = "";
    treeEl.replaceChildren();
    updateGutter();
    return;
  }

  const fmt = formatSelect.value; // json | yaml | csv
  const sort = sortKeys.checked;

  // Large JSON beautify/minify is offloaded to the worker (plain JSON only).
  if (text.length > BIG && (mode === "minify" || fmt === "json")) {
    setStatus("Formatting large input…");
    const id = ++reqId;
    const w = getWorker();
    const onMsg = (e) => {
      if (e.data.id !== id) return;
      w.removeEventListener("message", onMsg);
      if (e.data.ok) {
        lastValue = undefined; // not parsed on this thread; tree re-parses if needed
        showOutput(e.data.output);
        setStatus(`✓ Valid JSON · ${e.data.output.length.toLocaleString()} chars`, "ok");
        updateGutter();
      } else {
        reportError(e.data.error);
      }
    };
    w.addEventListener("message", onMsg);
    w.postMessage({ id, mode, text, indent: indentToken(indentSelect.value), sort });
    return;
  }

  // Parse once, then render in the requested shape.
  const res = parseJson(text);
  if (!res.ok) {
    reportError(res.error);
    return;
  }
  const value = sort ? sortKeysDeep(res.value) : res.value;
  lastValue = value;

  let out;
  let label;
  try {
    if (mode === "minify") {
      out = JSON.stringify(value);
      label = "JSON minified";
    } else if (fmt === "yaml") {
      out = toYaml(value);
      label = "YAML";
    } else if (fmt === "csv") {
      out = toCsv(value);
      label = "CSV";
    } else {
      out = JSON.stringify(value, null, indentToken(indentSelect.value));
      label = "JSON";
    }
  } catch (err) {
    setStatus(`✗ ${err.message}`, "err");
    return;
  }

  showOutput(out);
  setStatus(`✓ Valid JSON · ${label} · ${out.length.toLocaleString()} chars`, "ok");
  updateGutter();
}

// --- Wire up ----------------------------------------------------------------
$("beautifyBtn").addEventListener("click", () => run("beautify"));
$("minifyBtn").addEventListener("click", () => run("minify"));
$("clearBtn").addEventListener("click", () => {
  input.value = "";
  output.textContent = "";
  lastOutput = "";
  lastValue = undefined;
  searchCount.textContent = "";
  treeEl.replaceChildren();
  setStatus("");
  updateGutter();
  input.focus();
});

// Paste JSON straight from the clipboard and format it in one click.
$("pasteBtn").addEventListener("click", async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (!text.trim()) {
      setStatus("Clipboard is empty.", "");
      return;
    }
    input.value = text;
    run("beautify");
  } catch {
    setStatus("Couldn't read the clipboard — paste into the box (Ctrl/Cmd+V) instead.", "err");
    input.focus();
  }
});

// Auto-format when the user pastes directly into the input box.
input.addEventListener("paste", () => {
  // Let the textarea receive the pasted text first, then format.
  setTimeout(() => run("beautify"), 0);
});

// Explicit file picker (in addition to drag & drop).
$("openBtn").addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (file) loadFile(file);
  fileInput.value = ""; // allow re-opening the same file
});

$("copyBtn").addEventListener("click", async () => {
  const text = output.textContent ?? "";
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    setStatus("Copied to clipboard.", "ok");
  } catch {
    setStatus("Copy failed — select and copy manually.", "err");
  }
});

const viewText = $("viewText");
const viewTree = $("viewTree");
viewText.addEventListener("click", () => {
  viewText.classList.add("active");
  viewTree.classList.remove("active");
  output.classList.remove("hidden");
  treeEl.classList.add("hidden");
});
viewTree.addEventListener("click", () => {
  viewTree.classList.add("active");
  viewText.classList.remove("active");
  output.classList.add("hidden");
  treeEl.classList.remove("hidden");
  if (lastValue !== undefined) {
    renderTree(treeEl, lastValue);
  } else {
    const res = parseJson(input.value);
    if (res.ok) {
      lastValue = res.value;
      renderTree(treeEl, res.value);
    } else {
      treeEl.replaceChildren();
      setStatus("Format valid JSON first to see the tree.", "err");
    }
  }
});

// Collapse / expand every node — switches to the tree view first.
function ensureTreeView() {
  if (treeEl.classList.contains("hidden")) viewTree.click();
}
$("collapseAllBtn").addEventListener("click", () => {
  ensureTreeView();
  setAllCollapsed(treeEl, true);
});
$("expandAllBtn").addEventListener("click", () => {
  ensureTreeView();
  setAllCollapsed(treeEl, false);
});

// Format on Ctrl/Cmd+Enter.
input.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
    e.preventDefault();
    run("beautify");
  }
});

// Drag & drop a .json file.
function loadFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    input.value = String(reader.result ?? "");
    run("beautify");
  };
  reader.readAsText(file);
}
// Stop the browser from opening a file dropped anywhere outside the input box.
window.addEventListener("dragover", (e) => e.preventDefault());
window.addEventListener("drop", (e) => e.preventDefault());

// The input box itself is the drop zone: paste text or drop a file into it.
input.addEventListener("dragover", (e) => {
  e.preventDefault();
  input.classList.add("dragover");
});
input.addEventListener("dragleave", () => input.classList.remove("dragover"));
input.addEventListener("drop", (e) => {
  e.preventDefault();
  input.classList.remove("dragover");
  const file = e.dataTransfer?.files?.[0];
  if (file) loadFile(file);
});

// Explain the network indicator when clicked.
const netIndicator = $("netIndicator");
const netInfo = $("netInfo");
function toggleNetInfo(force) {
  const show = force !== undefined ? force : netInfo.classList.contains("hidden");
  netInfo.classList.toggle("hidden", !show);
}
netIndicator.addEventListener("click", (e) => {
  e.stopPropagation();
  toggleNetInfo();
});
netIndicator.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    toggleNetInfo();
  }
});
netInfo.addEventListener("click", (e) => e.stopPropagation()); // don't close when clicking inside
document.addEventListener("click", () => toggleNetInfo(false)); // close on outside click
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") toggleNetInfo(false);
});

// --- Sort keys / indent / output format -------------------------------------
function reformatOnSettingChange() {
  savePrefs();
  if (input.value.trim()) run("beautify");
}
sortKeys.addEventListener("change", reformatOnSettingChange);
indentSelect.addEventListener("change", reformatOnSettingChange);
formatSelect.addEventListener("change", reformatOnSettingChange);

// --- Search in the formatted output -----------------------------------------
let hits = [];
let curHit = -1;

function escapeHtml(s) {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
}

function applySearch() {
  const q = searchInput.value;
  // Highlighting lives in the text output, so switch to it when searching.
  if (q && !treeEl.classList.contains("hidden")) viewText.click();

  if (!q) {
    output.textContent = lastOutput;
    searchCount.textContent = "";
    hits = [];
    curHit = -1;
    return;
  }

  const haystack = lastOutput.toLowerCase();
  const needle = q.toLowerCase();
  let from = 0;
  let idx;
  let html = "";
  let count = 0;
  while ((idx = haystack.indexOf(needle, from)) !== -1) {
    html += escapeHtml(lastOutput.slice(from, idx));
    html += '<mark class="hit">' + escapeHtml(lastOutput.slice(idx, idx + needle.length)) + "</mark>";
    from = idx + needle.length;
    count++;
  }
  html += escapeHtml(lastOutput.slice(from));
  output.innerHTML = html;

  hits = [...output.querySelectorAll("mark.hit")];
  searchCount.textContent = count ? `${count} match${count === 1 ? "" : "es"}` : "no matches";
  curHit = hits.length ? 0 : -1;
  markActiveHit();
}

function markActiveHit() {
  hits.forEach((h, i) => h.classList.toggle("active", i === curHit));
  if (hits[curHit]) hits[curHit].scrollIntoView({ block: "center", behavior: "smooth" });
}

searchInput.addEventListener("input", applySearch);
searchInput.addEventListener("keydown", (e) => {
  // Enter jumps to the next match, Shift+Enter to the previous.
  if (e.key === "Enter" && hits.length) {
    e.preventDefault();
    curHit = (curHit + (e.shiftKey ? -1 : 1) + hits.length) % hits.length;
    markActiveHit();
  }
});

// --- Persist UI preferences (settings only — never the input JSON) ----------
const PREFS_KEY = "form8r:prefs";
function savePrefs() {
  try {
    localStorage.setItem(
      PREFS_KEY,
      JSON.stringify({
        indent: indentSelect.value,
        sort: sortKeys.checked,
        format: formatSelect.value,
      })
    );
  } catch {
    /* storage may be unavailable (e.g. private mode) — ignore */
  }
}
function loadPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY) || "{}");
    if (p.indent) indentSelect.value = p.indent;
    if (typeof p.sort === "boolean") sortKeys.checked = p.sort;
    if (p.format) formatSelect.value = p.format;
  } catch {
    /* ignore */
  }
}

// Register the service worker for offline use. Same-origin only.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* offline support is optional; ignore failures */
    });
  });
}

loadPrefs();
updateGutter();
setStatus("Ready. Paste JSON and hit Beautify (or Ctrl/Cmd+Enter).");
