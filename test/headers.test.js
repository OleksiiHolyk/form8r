// Guards form8r's core promise: the CSP in public/_headers must never be
// loosened in a way that would let the page talk to the network. No dependencies.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const headers = readFileSync(new URL("../public/_headers", import.meta.url), "utf8");
const cspLine = (headers.split("\n").find((l) => /Content-Security-Policy:/i.test(l)) || "").trim();
const csp = cspLine.replace(/^Content-Security-Policy:\s*/i, "");

function directive(name) {
  const m = csp.match(new RegExp(`(?:^|;)\\s*${name}\\s+([^;]+)`, "i"));
  return m ? m[1].trim() : null;
}

test("a Content-Security-Policy header is present", () => {
  assert.ok(cspLine.length > 0, "no CSP line found in _headers");
});

test("default-src and connect-src are locked to 'self' (no exfiltration possible)", () => {
  assert.equal(directive("default-src"), "'self'");
  // connect-src is THE directive that would allow data to leave — it must be exactly 'self'.
  assert.equal(directive("connect-src"), "'self'");
});

test("script-src is 'self' with no unsafe-inline / unsafe-eval", () => {
  assert.equal(directive("script-src"), "'self'");
  assert.ok(!/unsafe-eval/.test(csp), "CSP must not allow unsafe-eval");
});

test("object/base/frame-ancestors are locked down", () => {
  assert.equal(directive("object-src"), "'none'");
  assert.equal(directive("base-uri"), "'self'");
  assert.equal(directive("frame-ancestors"), "'none'");
});

test("hardening headers are present", () => {
  assert.ok(/X-Content-Type-Options:\s*nosniff/i.test(headers));
  assert.ok(/Referrer-Policy:\s*no-referrer/i.test(headers));
});
