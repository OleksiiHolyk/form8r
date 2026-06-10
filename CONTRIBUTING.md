# Contributing to form8r

Thanks for your interest! Contributions are welcome. Please keep in mind that form8r has a strict philosophy, and PRs are accepted only if they respect it.

## The non-negotiables

These are the whole reason form8r exists:

1. **Zero network requests at runtime.** The app must never send data anywhere. No analytics, no telemetry, no external fonts, no CDNs, no "phone home". The live network counter must stay at `0`.
2. **Zero runtime dependencies.** No npm packages ship to the browser. The app is plain, vanilla ES modules.
3. **No build step.** What's in `public/` is exactly what runs. Nothing is transpiled, bundled, or minified.
4. **Strict CSP stays strict.** Don't loosen `public/_headers`.

If a feature can't be done within these constraints, it doesn't belong in form8r.

## Project layout

- `public/` — the entire deployed site (HTML, CSS, vanilla JS modules, service worker, manifest, headers, icons).
- `test/` — unit tests using Node's built-in runner (no dependencies).
- `examples/` — sample JSON.

## Running locally

No `npm install`. Just serve the `public/` folder over HTTP (ES modules and the service worker don't work from `file://`):

```bash
cd public
python3 -m http.server 8080
# open http://localhost:8080
```

## Tests

The pure JSON logic is covered by tests. Please add tests for any change to `public/json.js`:

```bash
node --test     # or: npm test
```

CI runs the suite on every push and pull request. PRs into `main` are only accepted from the `develop` branch and must pass CI.

## Workflow

1. Branch off `develop`.
2. Make your change; keep it small and focused.
3. Add or update tests where it makes sense.
4. Open a pull request **into `develop`** (not `main`).
5. Use [Conventional Commits](https://www.conventionalcommits.org/) for messages, e.g. `feat(ui): add JSON search` or `fix(json): handle trailing commas`.

## Style

- Vanilla JS, ES modules, no frameworks.
- Match the existing formatting (2-space indent, semicolons, double quotes).
- Keep dependencies at zero. If you think something genuinely needs a dependency, open an issue to discuss first.

## Reporting bugs & ideas

Open an issue. For security problems, see [SECURITY.md](SECURITY.md) instead — don't file them publicly.
