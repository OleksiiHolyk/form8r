// Tests for JSON -> YAML and JSON -> CSV conversion. No dependencies.
import { test } from "node:test";
import assert from "node:assert/strict";
import { toYaml, toCsv } from "../public/convert.js";

test("toYaml renders scalars, nesting and types", () => {
  const yaml = toYaml({ name: "form8r", n: 42, ok: true, nil: null, tags: ["a", "b"] });
  assert.equal(
    yaml,
    'name: form8r\nn: 42\nok: true\nnil: null\ntags:\n  - a\n  - b\n'
  );
});

test("toYaml quotes ambiguous strings", () => {
  const yaml = toYaml({ ver: "1.0", flag: "true", note: "a: b" });
  assert.equal(yaml, 'ver: "1.0"\nflag: "true"\nnote: "a: b"\n');
});

test("toYaml leaves plain strings unquoted", () => {
  assert.equal(toYaml({ plain: "hello world" }), "plain: hello world\n");
});

test("toYaml handles nested objects and arrays of objects", () => {
  const yaml = toYaml({ a: { b: 1 }, list: [{ id: 1 }] });
  assert.equal(yaml, "a:\n  b: 1\nlist:\n  -\n    id: 1\n");
});

test("toYaml renders empty collections inline", () => {
  assert.equal(toYaml({ o: {}, a: [] }), "o: {}\na: []\n");
});

test("toCsv exports an array of objects with a header row", () => {
  const csv = toCsv([
    { id: 1, name: "a" },
    { id: 2, name: "b" },
  ]);
  assert.equal(csv, "id,name\n1,a\n2,b");
});

test("toCsv unions columns across rows", () => {
  const csv = toCsv([{ a: 1 }, { b: 2 }]);
  assert.equal(csv, "a,b\n1,\n,2");
});

test("toCsv quotes and escapes special characters", () => {
  const csv = toCsv([{ v: 'a, "b"\nc' }]);
  assert.equal(csv, 'v\n"a, ""b""\nc"');
});

test("toCsv handles an array of primitives as a single column", () => {
  assert.equal(toCsv([1, 2, 3]), "value\n1\n2\n3");
});

test("toCsv accepts a single object as one row", () => {
  assert.equal(toCsv({ a: 1, b: 2 }), "a,b\n1,2");
});

test("toCsv throws for unsupported shapes", () => {
  assert.throws(() => toCsv(42));
  assert.throws(() => toCsv("hello"));
});

test("toYaml preserves unicode and emoji", () => {
  assert.equal(toYaml({ country: "Ukraine 🇺🇦" }), "country: Ukraine 🇺🇦\n");
});

test("toYaml handles deep nesting without overflowing the stack", () => {
  let value = 1;
  for (let i = 0; i < 500; i++) value = { a: value };
  const yaml = toYaml(value);
  assert.ok(yaml.startsWith("a:"));
});
