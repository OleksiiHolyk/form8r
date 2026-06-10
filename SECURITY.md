# Security Policy

form8r is a privacy-first tool: it runs entirely in your browser and makes **zero network requests**. Security and privacy are the whole point of the project, so reports are very welcome.

## Reporting a vulnerability

Please **do not** open a public issue for security problems.

- Preferred: open a private [GitHub Security Advisory](https://github.com/OleksiiHolyk/form8r/security/advisories/new).
- Alternatively, email the maintainer at the address on the [GitHub profile](https://github.com/OleksiiHolyk).

Please include steps to reproduce and, if possible, a proof of concept. You can expect an initial response within a few days.

## What's in scope

Because form8r has no backend, the threat model is focused on the client:

- Anything that could cause the page to make an **outbound network request** with user data (this would violate the core guarantee).
- Cross-site scripting (XSS) — e.g. JSON content being executed rather than displayed as text.
- Weakening of the Content-Security-Policy in [`public/_headers`](public/_headers).
- Bugs in parsing/formatting that could crash or hang the browser on crafted input.

## Out of scope

- Issues that require a compromised browser, extension, or operating system.
- The behaviour of third-party hosts or CDNs (form8r ships no third-party runtime code).

## Our security posture

- **No dependencies, no build step.** Nothing from npm runs in the browser, so there is no supply-chain surface in the shipped product.
- **Strict CSP** (`connect-src 'self'`, `default-src 'self'`) blocks any attempt to send data anywhere.
- **No analytics, trackers, external fonts, or CDNs.**
- The deployed site is byte-for-byte auditable against this repository.
