import * as fs from "fs-extra";
import * as iconv from "iconv-lite";
import * as path from "path";
import { CookieJar, Store } from "tough-cookie";
import { window } from "vscode";
import { RequestHeaders, ResponseHeaders } from "../models/base";
import {
  IOneRequestSettings,
  SystemSettings,
} from "../models/configurationSettings";
import { HttpRequest } from "../models/httpRequest";
import { HttpResponse } from "../models/httpResponse";
import { awsCognito } from "./auth/awsCognito";
import { awsSignature } from "./auth/awsSignature";
import { digest } from "./auth/digest";
import { MimeUtility } from "./mimeUtility";
import { getHeader, removeHeader } from "./misc";
import { convertBufferToStream, convertStreamToBuffer } from "./streamUtility";
import { UserDataManager } from "./userDataManager";
import {
  getCurrentHttpFilePath,
  getWorkspaceRootPath,
} from "./workspaceUtility";

import * as got from "got";
import type {
  CancelableRequest,
  Headers,
  Method,
  OptionsOfBufferResponseBody,
  Response,
} from "got";
import { Stream } from "stream";

import encodeUrl from "encodeurl";
import CookieFileStore from "tough-cookie-file-store";

type Certificate = {
  cert?: Buffer;
  key?: Buffer;
  pfx?: Buffer;
  passphrase?: string;
};

export class HttpClient {
  private cookieStore: Store;

  public constructor() {
    const cookieFilePath = UserDataManager.cookieFilePath;
    this.cookieStore = new CookieFileStore(cookieFilePath) as Store;
  }

  public async send(
    httpRequest: HttpRequest,
    settings?: IOneRequestSettings,
  ): Promise<HttpResponse> {
    settings = settings || SystemSettings.Instance;

    const options = await this.prepareOptions(httpRequest, settings);

    let bodySize = 0;
    let headersSize = 0;
    const requestUrl = encodeUrl(httpRequest.url);
    const request: CancelableRequest<Response<Buffer>> = got.default(
      requestUrl,
      options,
    );
    httpRequest.setUnderlyingRequest(request);
    request.on("response", (res) => {
      if (res.rawHeaders) {
        headersSize += res.rawHeaders
          .map((h) => h.length)
          .reduce((a, b) => a + b, 0);
        headersSize += res.rawHeaders.length / 2;
      }
      res.on("data", (chunk) => {
        bodySize += chunk.length;
      });
    });

    const response = await request;

    const encoding = this.resolveResponseEncoding(
      response.headers["content-type"],
    );

    const bodyBuffer = response.body;
    let bodyString = iconv.encodingExists(encoding)
      ? iconv.decode(bodyBuffer, encoding)
      : bodyBuffer.toString();

    if (settings.decodeEscapedUnicodeCharacters) {
      bodyString = this.decodeEscapedUnicodeCharacters(bodyString);
    }

    // adjust response header case, due to the response headers in nodejs http module is in lowercase
    const responseHeaders: ResponseHeaders = HttpClient.normalizeHeaderNames(
      response.headers,
      response.rawHeaders,
    );

    const requestBody = options.body;

    return new HttpResponse(
      response.statusCode,
      response.statusMessage!,
      response.httpVersion,
      responseHeaders,
      bodyString,
      bodySize,
      headersSize,
      bodyBuffer,
      response.timings.phases,
      new HttpRequest(
        options.method!,
        requestUrl,
        HttpClient.normalizeHeaderNames(
          response.request.options.headers as RequestHeaders,
          Object.keys(httpRequest.headers),
        ),
        HttpClient.normalizeRequestBody(requestBody),
        httpRequest.rawBody,
        httpRequest.name,
      ),
    );
  }

  public async clearCookies() {
    await fs.remove(UserDataManager.cookieFilePath);
    this.cookieStore = new CookieFileStore(
      UserDataManager.cookieFilePath,
    ) as Store;
  }

  private async prepareOptions(
    httpRequest: HttpRequest,
    settings: IOneRequestSettings,
  ): Promise<OptionsOfBufferResponseBody> {
    const requestBody = await this.resolveRequestBody(httpRequest.body);

    // Fix #682 Do not touch original headers in httpRequest, which may be used for retry later
    // Simply do a shadow copy here
    const clonedHeaders = Object.assign({}, httpRequest.headers);

    const options: OptionsOfBufferResponseBody = {
      headers: clonedHeaders as Headers,
      method: httpRequest.method as Method,
      body: requestBody,
      responseType: "buffer",
      decompress: true,
      followRedirect: settings.followRedirect,
      throwHttpErrors: false,
      retry: { limit: 0 },
      hooks: {
        afterResponse: [],
        beforeRequest: [],
      },
      https: {
        rejectUnauthorized: settings.strictSSL,
      },
    };

    this.applyRequestTimeout(options, settings);
    this.applyCookieJar(options, settings);
    await this.applyAuthorization(options);
    this.applyCertificate(options, httpRequest.url, settings);
    await this.applyProxy(options, httpRequest.url, settings);

    return options;
  }

  private resolveResponseEncoding(contentType: string | undefined): string {
    if (!contentType) {
      return "utf8";
    }

    try {
      return MimeUtility.parse(contentType).charset || "utf8";
    } catch {
      return "utf8";
    }
  }

  private async resolveRequestBody(
    originalRequestBody: HttpRequest["body"],
  ): Promise<string | Buffer | undefined> {
    if (originalRequestBody === undefined) {
      return undefined;
    }

    if (typeof originalRequestBody === "string") {
      return originalRequestBody;
    }

    return convertStreamToBuffer(originalRequestBody);
  }

  private applyRequestTimeout(
    options: OptionsOfBufferResponseBody,
    settings: IOneRequestSettings,
  ): void {
    if (settings.timeoutInMilliseconds > 0) {
      options.timeout = { request: settings.timeoutInMilliseconds };
    }
  }

  private applyCookieJar(
    options: OptionsOfBufferResponseBody,
    settings: IOneRequestSettings,
  ): void {
    if (settings.rememberCookiesForSubsequentRequests) {
      options.cookieJar = new CookieJar(this.cookieStore);
    }
  }

  private async applyAuthorization(
    options: OptionsOfBufferResponseBody,
  ): Promise<void> {
    const headers = options.headers as Headers;
    const authorization = getHeader(headers, "Authorization") as
      | string
      | undefined;
    if (!authorization) {
      return;
    }

    const [scheme = "", user = "", ...args] = authorization.split(/\s+/);
    const normalizedScheme = scheme.toLowerCase();
    if (args.length > 0) {
      const pass = args.join(" ");
      if (normalizedScheme === "basic") {
        removeHeader(headers, "Authorization");
        options.username = user;
        options.password = pass;
      } else if (normalizedScheme === "digest") {
        removeHeader(headers, "Authorization");
        options.hooks!.afterResponse!.push(digest(user, pass));
      } else if (normalizedScheme === "aws") {
        removeHeader(headers, "Authorization");
        options.hooks!.beforeRequest!.push(awsSignature(authorization));
      } else if (normalizedScheme === "cognito") {
        removeHeader(headers, "Authorization");
        options.hooks!.beforeRequest!.push(await awsCognito(authorization));
      }
      return;
    }

    if (normalizedScheme === "basic" && user.includes(":")) {
      removeHeader(headers, "Authorization");
      const [username, password] = user.split(":");
      options.username = username;
      options.password = password;
    }
  }

  private applyCertificate(
    options: OptionsOfBufferResponseBody,
    requestUrl: string,
    settings: IOneRequestSettings,
  ): void {
    const certificate = this.getRequestCertificate(requestUrl, settings);
    Object.assign(options, certificate);
  }

  private async applyProxy(
    options: OptionsOfBufferResponseBody,
    requestUrl: string,
    settings: IOneRequestSettings,
  ): Promise<void> {
    if (
      !settings.proxy ||
      HttpClient.ignoreProxy(requestUrl, settings.excludeHostsForProxy)
    ) {
      return;
    }

    const proxyEndpoint = new URL(settings.proxy);
    if (!/^https?:$/.test(proxyEndpoint.protocol)) {
      return;
    }

    const proxyOptions = {
      host: proxyEndpoint.hostname,
      port:
        Number(proxyEndpoint.port) ||
        (proxyEndpoint.protocol === "https:" ? 443 : 80),
      rejectUnauthorized: settings.proxyStrictSSL,
    };

    const HttpProxyAgent = (await import("http-proxy-agent")).HttpProxyAgent;
    const HttpsProxyAgent = (await import("https-proxy-agent"))
      .HttpsProxyAgent;

    const proxyUrl = `${settings.proxyStrictSSL ? "https" : "http"}://${proxyOptions.host}:${proxyOptions.port}`;

    options.agent = {
      http: new HttpProxyAgent(proxyUrl),
      https: new HttpsProxyAgent(proxyUrl),
    } as NonNullable<OptionsOfBufferResponseBody["agent"]>;
  }

  private decodeEscapedUnicodeCharacters(body: string): string {
    return body.replace(/\\u([0-9a-fA-F]{4})/gi, (_, g) => {
      const char = String.fromCharCode(parseInt(g, 16));
      return char === '"' ? '\\"' : char;
    });
  }

  private static normalizeRequestBody(
    requestBody: OptionsOfBufferResponseBody["body"],
  ): string | Stream | undefined {
    if (typeof requestBody === "string") {
      return requestBody;
    }

    if (Buffer.isBuffer(requestBody)) {
      return convertBufferToStream(requestBody);
    }

    if (requestBody instanceof Stream) {
      return requestBody;
    }

    return undefined;
  }

  private getRequestCertificate(
    requestUrl: string,
    settings: IOneRequestSettings,
  ): Certificate | null {
    let host: string | undefined;
    try {
      host = new URL(requestUrl).host;
    } catch {
      host = undefined;
    }
    if (!host || !(host in settings.hostCertificates)) {
      return null;
    }

    const {
      cert: certPath,
      key: keyPath,
      pfx: pfxPath,
      passphrase,
    } = settings.hostCertificates[host];
    const cert = this.resolveCertificate(certPath);
    const key = this.resolveCertificate(keyPath);
    const pfx = this.resolveCertificate(pfxPath);
    return { cert, key, pfx, passphrase };
  }

  private static ignoreProxy(
    requestUrl: string,
    excludeHostsForProxy: string[],
  ): boolean {
    if (!excludeHostsForProxy || excludeHostsForProxy.length === 0) {
      return false;
    }

    let resolvedUrl: URL;
    try {
      resolvedUrl = new URL(requestUrl);
    } catch {
      return false;
    }
    const hostName = resolvedUrl.hostname?.toLowerCase();
    const port = resolvedUrl.port;
    const excludeHostsProxyList = Array.from(
      new Set(excludeHostsForProxy.map((eh) => eh.toLowerCase())),
    );

    for (const eh of excludeHostsProxyList) {
      const urlParts = eh.split(":");
      if (!port) {
        // if no port specified in request url, host name must exactly match
        if (urlParts.length === 1 && urlParts[0] === hostName) {
          return true;
        }
      } else {
        // if port specified, match host without port or hostname:port exactly match
        const [ph, pp] = urlParts;
        if (ph === hostName && (!pp || pp === port)) {
          return true;
        }
      }
    }

    return false;
  }

  private resolveCertificate(
    absoluteOrRelativePath: string | undefined,
  ): Buffer | undefined {
    if (absoluteOrRelativePath === undefined) {
      return undefined;
    }

    if (path.isAbsolute(absoluteOrRelativePath)) {
      return this.readCertificateFile(absoluteOrRelativePath, absoluteOrRelativePath);
    }

    // the path should be relative path
    const relativePath = absoluteOrRelativePath;
    const rootPath = getWorkspaceRootPath();
    if (rootPath) {
      const workspaceAbsolutePath = path.join(rootPath, relativePath);
      if (fs.existsSync(workspaceAbsolutePath)) {
        return fs.readFileSync(workspaceAbsolutePath);
      }
    }

    const currentFilePath = getCurrentHttpFilePath();
    if (currentFilePath) {
      const fileAbsolutePath = path.join(path.dirname(currentFilePath), relativePath);
      if (fs.existsSync(fileAbsolutePath)) {
        return fs.readFileSync(fileAbsolutePath);
      }
    }

    window.showWarningMessage(
      `Certificate path ${relativePath} doesn't exist, please make sure it exists.`,
    );
    return undefined;
  }

  private readCertificateFile(
    absolutePath: string,
    displayPath: string,
  ): Buffer | undefined {
    if (fs.existsSync(absolutePath)) {
      return fs.readFileSync(absolutePath);
    }

    window.showWarningMessage(
      `Certificate path ${displayPath} doesn't exist, please make sure it exists.`,
    );
    return undefined;
  }

  private static normalizeHeaderNames<
    T extends RequestHeaders | ResponseHeaders,
  >(headers: T, rawHeaders: string[]): T {
    const headersDic: { [key: string]: string } = rawHeaders.reduce(
      (prev, cur) => {
        if (!(cur.toLowerCase() in prev)) {
          prev[cur.toLowerCase()] = cur;
        }
        return prev;
      },
      {},
    );
    const adjustedResponseHeaders = {} as RequestHeaders | ResponseHeaders;
    for (const header in headers) {
      const adjustedHeaderName = headersDic[header] || header;
      adjustedResponseHeaders[adjustedHeaderName] = headers[header];
    }

    return adjustedResponseHeaders as T;
  }
}
