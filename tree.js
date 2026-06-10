// Minimal collapsible tree view for a parsed JSON value. Pure DOM, no deps.

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

function renderNode(key, value) {
  const wrap = document.createElement("div");
  wrap.className = "tnode";

  const isObject = value !== null && typeof value === "object";
  const line = document.createElement("div");

  if (key !== null) {
    const k = document.createElement("span");
    k.className = "tkey";
    k.textContent = JSON.stringify(key) + ": ";
    line.appendChild(k);
  }

  if (!isObject) {
    line.appendChild(renderScalar(value));
    wrap.appendChild(line);
    return wrap;
  }

  const entries = Array.isArray(value)
    ? value.map((v, i) => [String(i), v])
    : Object.entries(value);

  const open = Array.isArray(value) ? "[" : "{";
  const close = Array.isArray(value) ? "]" : "}";

  const toggle = document.createElement("span");
  toggle.className = "tcollapse";
  toggle.textContent = "▾";

  const bracket = document.createElement("span");
  bracket.className = "tmeta";
  bracket.textContent = open;

  const meta = document.createElement("span");
  meta.className = "tmeta";
  meta.textContent = ` ${entries.length} ${entries.length === 1 ? "item" : "items"}`;

  line.prepend(toggle);
  line.appendChild(bracket);
  line.appendChild(meta);
  wrap.appendChild(line);

  const children = document.createElement("div");
  for (const [k, v] of entries) {
    children.appendChild(renderNode(Array.isArray(value) ? null : k, v));
  }
  const closing = document.createElement("div");
  closing.className = "tmeta";
  closing.textContent = close;
  children.appendChild(closing);
  wrap.appendChild(children);

  toggle.addEventListener("click", () => {
    const hidden = children.classList.toggle("hidden");
    toggle.textContent = hidden ? "▸" : "▾";
  });

  return wrap;
}

export function renderTree(container, value) {
  container.replaceChildren(renderNode(null, value));
}
