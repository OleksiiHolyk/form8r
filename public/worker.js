// Heavy parsing/formatting runs here so the UI stays responsive on large files.
import { beautify, minify } from "./json.js";

self.onmessage = (e) => {
  const { id, mode, text, indent, sort } = e.data;
  const res = mode === "beautify" ? beautify(text, indent, sort) : minify(text, sort);
  if (res.ok && res.output !== undefined) {
    self.postMessage({ id, ok: true, output: res.output });
  } else if (!res.ok) {
    self.postMessage({ id, ok: false, error: res.error });
  }
};
