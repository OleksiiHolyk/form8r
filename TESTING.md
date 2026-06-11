# Testing form8r

Two layers: **automated unit tests** (pure logic, zero dependencies) and a **manual checklist** for the parts that only exist in a real browser (UI, service worker, the zero-network promise). CI runs the automated layer on every push and PR.

## 1. Automated unit tests

No `npm install` — they use Node's built-in runner.

```bash
node --test        # or: npm test
```

What's covered:

- `test/json.test.js` — `beautify` / `minify` / `parseJson` / `sortKeysDeep`: formatting, indentation, error position & line/column for malformed input (missing brackets, commas, colons), unicode/emoji, deep nesting (no stack overflow), and the documented big-number precision limit.
- `test/convert.test.js` — `toYaml` / `toCsv`: nesting, type handling, string quoting, CSV escaping/column-union, unsupported shapes, deep nesting.
- `test/headers.test.js` — asserts `public/_headers` keeps the CSP locked (`connect-src 'self'`, `default-src 'self'`, no `unsafe-eval`, etc.). This is the regression guard for the core privacy promise.

Add or update a test whenever you touch `public/json.js`, `public/convert.js`, or `public/_headers`.

## 2. Manual browser smoke test

Serve the site and open it:

```bash
cd public && python3 -m http.server 8080   # http://localhost:8080
```

Walk through:

- **Format:** paste minified JSON → **Beautify** formats it; **Minify** collapses it; indent 2/4/Tab all work.
- **Invalid JSON:** delete a closing `}` → status shows a human error with line/column, the input jumps to and highlights the spot, the gutter line goes red.
- **Convert:** switch **Format** to YAML and to CSV → output updates; CSV on a non-array shows the friendly error.
- **Sort keys:** toggle on → keys come out alphabetical at every level.
- **Tree:** switch to **Tree**; collapse a node → shows `{ … } N items`; **Collapse all** / **Expand all** work.
- **Search:** type a term → matches highlight, count shows; Enter / Shift+Enter cycle matches.
- **Input methods:** **Paste** (clipboard), **Open file**, and drag-and-drop a `.json` onto the box all load content.
- **Settings persistence:** change indent/sort/format, reload the page → they're restored; the input box is **empty** (we never persist your data).
- **Copy:** **Copy** puts the current output on the clipboard.
- **Mobile:** narrow the window below ~760px → panes stack vertically and stay usable.

## 3. Verify the zero-network promise (the important one)

1. Open DevTools → **Network**, tick "Disable cache", reload.
2. After load, paste JSON and use every feature.
3. Expect **no requests** beyond the initial same-origin app files (and the service worker). The in-app counter in the header must stay **`0`**.
4. Bonus: DevTools → **Application → Manifest / Service Workers** to confirm the PWA installs; then go offline (Network → "Offline") and reload — the app still works.

If anything shows an outbound request, that's a release blocker.

## 4. Lighthouse / PWA audit

Chrome DevTools → **Lighthouse** → check Performance, Accessibility, Best Practices, SEO, PWA → **Analyze page load** (run against the served `http://localhost:8080`, or production). Aim for ~100 across the board; investigate anything that isn't.

## 5. Accessibility

- **Keyboard only:** Tab through every control (buttons, selects, search, the network indicator); all should be reachable and operable; focus should be visible.
- **Tree:** confirm collapse/expand toggles are keyboard-operable; note any gaps for follow-up.
- **Tools:** run the Lighthouse Accessibility category, and/or the [axe DevTools](https://www.deque.com/axe/devtools/) extension, and fix flagged issues (labels, contrast, ARIA).

## 6. Optional: end-to-end tests

The highest-value automated test we don't yet have is a browser E2E that **asserts zero network requests** and drives the real UI. It would need a browser-automation dependency (e.g. Playwright), which we've deliberately avoided. If/when added, it should run in CI only (nothing ships to users) and cover: load → assert 0 network, format, convert, search, and offline reload.
