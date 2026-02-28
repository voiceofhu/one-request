import aws4 from "aws4";
import type { BeforeRequestHook, NormalizedOptions } from "got";

const toGotHeaders = (
  headers: aws4.Request["headers"],
): NormalizedOptions["headers"] => {
  const normalizedHeaders: NormalizedOptions["headers"] = {};
  if (!headers) {
    return normalizedHeaders;
  }

  for (const [key, value] of Object.entries(headers)) {
    if (Array.isArray(value)) {
      normalizedHeaders[key] = value.map((item) => String(item));
    } else if (typeof value === "number") {
      normalizedHeaders[key] = value.toString();
    } else {
      normalizedHeaders[key] = value;
    }
  }

  return normalizedHeaders;
};

export function awsSignature(authorization: string): BeforeRequestHook {
  const [, accessKeyId, secretAccessKey] = authorization.split(/\s+/);
  const credentials = {
    accessKeyId,
    secretAccessKey,
    sessionToken: /token:(\S*)/.exec(authorization)?.[1],
  };
  const awsScope = {
    region: /region:(\S*)/.exec(authorization)?.[1],
    service: /service:(\S*)/.exec(authorization)?.[1],
  };

  return (options: NormalizedOptions) => {
    const signingRequest: aws4.Request = {
      host: options.url?.host,
      hostname: options.url?.hostname,
      path: options.url
        ? `${options.url.pathname}${options.url.search}`
        : undefined,
      method: options.method,
      headers: options.headers,
      body:
        typeof options.body === "string" || Buffer.isBuffer(options.body)
          ? options.body
          : undefined,
      ...awsScope,
    };

    aws4.sign(signingRequest, credentials);
    options.headers = toGotHeaders(signingRequest.headers);
  };
}
