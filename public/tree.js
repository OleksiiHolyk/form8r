// Collapsible tree view for a parsed JSON value. Pure DOM, no deps.
// Each object/array node can be folded; folded nodes show a compact preview.

function valueClass(v) {
  if (v === null) return "tnull";
  switch (typeof v) {
    case "string":
      return "tstr";
    case "number":
      return "tnum";
    case "boolean":
      return "tbool";
    default:
      return "tmeta";
  }
}

function renderScalar(v) {
  const span = document.createElement("span");
  span.className = valueClass(v);
  span.textContent = typeof v === "string" ? JSON.stringify(v) : String(v);
  return span;
}

function makeKey(key) {
  const k = document.createElement("span");
  k.className = "tkey";
  k.textContent = JSON.stringify(key) + ": ";
  return k;
}

function meta(text) {
  const m = document.createElement("span");
  m.className = "tmeta";
  m.textContent = text;
  return m;
}

function renderNode(key, value) {
  const wrap = document.createElement("div");
  wrap.className = "tnode";

  const isObject = value !== null && typeof value === "object";
  const line = document.createElement("div");
  line.className = "tline";

  if (!isObject) {
    if (key !== null) line.appendChild(makeKey(key));
    line.appendChild(renderScalar(value));
    wrap.appendChild(line);
    return wrap;
  }

  const isArray = Array.isArray(value);
  const entries = isArray
    ? value.map((v, i) => [String(i), v])
    : Object.entries(value);
  const open = isArray ? "[" : "{";
  const close = isArray ? "]" : "}";
  const count = `${entries.length} ${entries.length === 1 ? "item" : "items"}`;

  // Header line: ▸/▾  "key":  {  …summary when collapsed…
  const toggle = document.createElement("span");
  toggle.className = "tcollapse";
  toggle.textContent = "▾";
  line.appendChild(toggle);
  if (key !== null) line.appendChild(makeKey(key));
  line.appendChild(meta(open));
  line.appendChild(meta(` ${count}`));

  // Shown only when collapsed: " … }"
  const summary = document.createElement("span");
  summary.className = "tsummary";
  summary.textContent = ` … ${close}`;
  line.appendChild(summary);

  wrap.appendChild(line);

  // Children + closing bracket (hidden when collapsed).
  const children = document.createElement("div");
  children.className = "tchildren";
  for (const [k, v] of entries) {
    children.appendChild(renderNode(isArray ? null : k, v));
  }
  children.appendChild(meta(close));
  wrap.appendChild(children);

  // Toggle on clicking anywhere on the header line.
  line.addEventListener("click", () => {
    const collapsed = wrap.classList.toggle("collapsed");
    toggle.textContent = collapsed ? "▸" : "▾";
  });

  return wrap;
}

export function renderTree(container, value) {
  container.replaceChildren(renderNode(null, value));
}

// Collapse or expand every foldable node in the tree.
export function setAllCollapsed(container, collapsed) {
  container.querySelectorAll(".tnode > .tchildren").forEach((children) => {
    const wrap = children.parentElement;
    wrap.classList.toggle("collapsed", collapsed);
    const toggle = wrap.querySelector(":scope > .tline > .tcollapse");
    if (toggle) toggle.textContent = collapsed ? "▸" : "▾";
  });
}
