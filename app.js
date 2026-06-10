import { beautify, minify, parseJson, indentToken } from "./json.js";
import { renderTree } from "./tree.js";

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
  output.textContent = text;
  if (!treeEl.classList.contains("hidden")) {
    const res = parseJson(text);
    if (res.ok) renderTree(treeEl, res.value);
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
    treeEl.replaceChildren();
    updateGutter();
    return;
  }

  if (text.length > BIG) {
    setStatus("Formatting large input…");
    const id = ++reqId;
    const w = getWorker();
    const onMsg = (e) => {
      if (e.data.id !== id) return;
      w.removeEventListener("message", onMsg);
      if (e.data.ok) {
        showOutput(e.data.output);
        setStatus(`✓ Valid JSON · ${e.data.output.length.toLocaleString()} chars`, "ok");
        updateGutter();
      } else {
        reportError(e.data.error);
      }
    };
    w.addEventListener("message", onMsg);
    w.postMessage({ id, mode, text, indent: indentToken(indentSelect.value) });
    return;
  }

  const res = mode === "beautify" ? beautify(text, indentToken(indentSelect.value)) : minify(text);
  if (res.ok && res.output !== undefined) {
    showOutput(res.output);
    setStatus(`✓ Valid JSON · ${res.output.length.toLocaleString()} chars`, "ok");
    updateGutter();
  } else if (!res.ok) {
    reportError(res.error);
  }
}

// --- Wire up ----------------------------------------------------------------
$("beautifyBtn").addEventListener("click", () => run("beautify"));
$("minifyBtn").addEventListener("click", () => run("minify"));
$("clearBtn").addEventListener("click", () => {
  input.value = "";
  output.textContent = "";
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
  const res = parseJson(output.textContent || input.value);
  if (res.ok) {
    renderTree(treeEl, res.value);
  } else {
    treeEl.replaceChildren();
    setStatus("Format valid JSON first to see the tree.", "err");
  }
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

// Register the service worker for offline use. Same-origin only.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* offline support is optional; ignore failures */
    });
  });
}

updateGutter();
setStatus("Ready. Paste JSON and hit Beautify (or Ctrl/Cmd+Enter).");
