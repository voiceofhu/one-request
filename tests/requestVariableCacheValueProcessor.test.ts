import assert from "node:assert/strict";
import test from "node:test";
import { HttpRequest } from "../src/models/httpRequest";
import { HttpResponse } from "../src/models/httpResponse";
import {
  ResolveState,
  ResolveWarningMessage,
} from "../src/models/httpVariableResolveResult";
import { RequestVariableCacheValueProcessor } from "../src/utils/requestVariableCacheValueProcessor";

function createResponse(body: string, headers: Record<string, string> = {}) {
  const request = new HttpRequest("GET", "https://example.com", {}, undefined);
  return new HttpResponse(
    200,
    "OK",
    "1.1",
    headers,
    body,
    Buffer.byteLength(body),
    0,
    Buffer.from(body),
    {},
    request,
  );
}

test("resolveRequestVariable should keep empty header value as success", () => {
  const response = createResponse("{}", {
    "content-type": "application/json",
    "x-empty": "",
  });
  const result = RequestVariableCacheValueProcessor.resolveRequestVariable(
    response,
    "req.response.headers.x-empty",
  );

  assert.equal(result.state, ResolveState.Success);
  assert.equal((result as { value: unknown }).value, "");
});

test("resolveRequestVariable should support wildcard on empty string body", () => {
  const response = createResponse("", { "content-type": "application/json" });
  const result = RequestVariableCacheValueProcessor.resolveRequestVariable(
    response,
    "req.response.body.*",
  );

  assert.equal(result.state, ResolveState.Success);
  assert.equal((result as { value: unknown }).value, "");
});

test("resolveRequestVariable should resolve falsy json values via JSONPath", () => {
  const body = JSON.stringify({ ok: false, count: 0, text: "" });
  const response = createResponse(body, { "content-type": "application/json" });

  const boolResult = RequestVariableCacheValueProcessor.resolveRequestVariable(
    response,
    "req.response.body.$.ok",
  );
  const numberResult = RequestVariableCacheValueProcessor.resolveRequestVariable(
    response,
    "req.response.body.$.count",
  );
  const stringResult = RequestVariableCacheValueProcessor.resolveRequestVariable(
    response,
    "req.response.body.$.text",
  );

  assert.equal(boolResult.state, ResolveState.Success);
  assert.equal((boolResult as { value: unknown }).value, "false");
  assert.equal(numberResult.state, ResolveState.Success);
  assert.equal((numberResult as { value: unknown }).value, "0");
  assert.equal(stringResult.state, ResolveState.Success);
  assert.equal((stringResult as { value: unknown }).value, "");
});

test("resolveRequestVariable should return warning for missing header", () => {
  const response = createResponse("{}", { "content-type": "application/json" });
  const result = RequestVariableCacheValueProcessor.resolveRequestVariable(
    response,
    "req.response.headers.not-exist",
  );

  assert.equal(result.state, ResolveState.Warning);
  assert.equal(
    (result as { message: ResolveWarningMessage }).message,
    ResolveWarningMessage.IncorrectHeaderName,
  );
});
