import assert from "node:assert/strict";
import test from "node:test";
import { SwaggerUtils } from "../src/utils/swaggerUtils";

test("SwaggerUtils.parseOpenApiYaml should gracefully handle minimal spec", () => {
  const yaml = `
openapi: 3.0.0
info:
  title: Demo API
paths: {}
`;
  const output = new SwaggerUtils().parseOpenApiYaml(yaml);

  assert.ok(output);
  assert.match(output!, /### Demo API/);
});

test("SwaggerUtils.generateOneRequestOutput should skip invalid path operation nodes", () => {
  const output = new SwaggerUtils().generateOneRequestOutput({
    info: { title: "Demo" },
    servers: [{ url: "https://example.com" }],
    paths: {
      "/ok": {
        get: {
          summary: "Get demo",
        },
      },
      "/invalid": {
        get: "not-an-operation",
      },
    },
    components: {},
  });

  assert.match(output, /GET https:\/\/example.com\/ok HTTP\/1.1/);
  assert.doesNotMatch(output, /\/invalid/);
});
