// Tests for the pure JSON logic. Uses Node's built-in test runner — no dependencies.
// Run with:  node --test   (or: npm test)
import { test } from "node:test";
import assert from "node:assert/strict";
import { beautify, minify, parseJson, indentToken } from "../json.js";

test("indentToken maps select values to JSON.stringify args", () => {
  assert.equal(indentToken("2"), 2);
  assert.equal(indentToken("4"), 4);
  assert.equal(indentToken("tab"), "\t");
  assert.equal(indentToken("nonsense"), 2); // safe fallback
});

test("beautify pretty-prints with the chosen indent", () => {
  const res = beautify('{"a":1,"b":[2,3]}', 2);
  assert.equal(res.ok, true);
  assert.equal(res.output, '{\n  "a": 1,\n  "b": [\n    2,\n    3\n  ]\n}');
});

test("beautify supports tab indentation", () => {
  const res = beautify('{"a":1}', "\t");
  assert.equal(res.output, '{\n\t"a": 1\n}');
});

test("minify removes all insignificant whitespace", () => {
  const res = minify('{\n  "a": 1,\n  "b": [ 2, 3 ]\n}');
  assert.equal(res.ok, true);
  assert.equal(res.output, '{"a":1,"b":[2,3]}');
});

test("round-trip: minify(beautify(x)) preserves the data", () => {
  const src = '{"name":"form8r","tags":["json","privacy"],"n":42,"ok":true,"x":null}';
  const pretty = beautify(src, 4).output;
  assert.equal(minify(pretty).output, src);
});

test("parseJson accepts valid JSON and returns the value", () => {
  const res = parseJson('{"a":[1,2,{"b":true}]}');
  assert.equal(res.ok, true);
  assert.deepEqual(res.value, { a: [1, 2, { b: true }] });
});

test("missing closing brace points at the end of input", () => {
  const text = '{\n  "a": 1,\n  "b": 2\n';
  const res = parseJson(text);
  assert.equal(res.ok, false);
  assert.equal(res.error.position, text.length);
  assert.ok(res.error.line >= 3, "line should be near the end");
});

test("missing closing bracket reports a position and line/column", () => {
  const text = '{\n  "items": [1, 2, 3\n}';
  const res = parseJson(text);
  assert.equal(res.ok, false);
  assert.equal(typeof res.error.position, "number");
  assert.equal(typeof res.error.line, "number");
  assert.equal(typeof res.error.column, "number");
});

test("missing colon reports the offending location", () => {
  const text = '{\n"a" 1\n}';
  const res = parseJson(text);
  assert.equal(res.ok, false);
  assert.equal(res.error.line, 2);
  assert.equal(typeof res.error.position, "number");
});

test("error positions stay within the text bounds", () => {
  for (const bad of ['{', '[', '{"a":}', '{"a" "b"}', 'tru', '[1,2,]']) {
    const res = parseJson(bad);
    assert.equal(res.ok, false);
    assert.ok(res.error.position >= 0 && res.error.position <= bad.length);
  }
});

test("error message is non-empty and humanized", () => {
  const res = parseJson("{nope}");
  assert.equal(res.ok, false);
  assert.ok(res.error.message.length > 0);
  assert.ok(!/^JSON\.parse:/.test(res.error.message));
});
