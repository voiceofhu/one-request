import assert from "node:assert/strict";
import test from "node:test";
import { MimeUtility } from "../src/utils/mimeUtility";

test("MimeUtility.getExtension should prefer custom mapping and trim leading dots", () => {
  const ext = MimeUtility.getExtension("application/x-custom", {
    "application/x-custom": ".abc",
  });
  assert.equal(ext, "abc");
});

test("MimeUtility should detect extended json content-types", () => {
  assert.equal(MimeUtility.isJSON("application/problem+json"), true);
  assert.equal(MimeUtility.isJSON("application/x-amz-json-1.1"), true);
  assert.equal(MimeUtility.isJSON("text/plain"), false);
});

test("MimeUtility should parse charset from content-type", () => {
  const mimeType = MimeUtility.parse("application/json; charset=utf-8");
  assert.equal(mimeType.essence, "application/json");
  assert.equal(mimeType.charset, "utf-8");
});

test("MimeUtility should detect browser supported image format", () => {
  assert.equal(MimeUtility.isBrowserSupportedImageFormat("image/png"), true);
  assert.equal(MimeUtility.isBrowserSupportedImageFormat("image/tiff"), false);
});
