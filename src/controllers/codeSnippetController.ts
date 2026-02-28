import encodeUrl from 'encodeurl';
import { availableTargets, HTTPSnippet } from 'httpsnippet';
import { EOL } from 'os';
import { Clipboard, env, ExtensionContext, QuickInputButtons, window } from 'vscode';
import Logger from '../logger';
import { IOneRequestSettings, RequestSettings, OneRequestSettings } from '../models/configurationSettings';
import { HARCookie, HARHeader, HARHttpRequest, HARPostData } from '../models/harHttpRequest';
import { HttpRequest } from '../models/httpRequest';
import { RequestParserFactory } from '../models/requestParserFactory';
import { trace } from "../utils/decorator";
import { base64 } from '../utils/misc';
import { Selector } from '../utils/selector';
import { Telemetry } from '../utils/telemetry';
import { getCurrentTextDocument } from '../utils/workspaceUtility';
import { CodeSnippetWebview } from '../views/codeSnippetWebview';

type CodeSnippetClient = {
    key: NonNullable<Parameters<HTTPSnippet['convert']>[1]>;
    title: string;
    link: string;
    description: string;
};

type CodeSnippetTarget = {
    key: Parameters<HTTPSnippet['convert']>[0];
    title: string;
    clients: CodeSnippetClient[];
};

type TargetQuickPickItem = CodeSnippetTarget & {
    label: string;
};

type ClientQuickPickItem = CodeSnippetClient & {
    label: string;
    detail: string;
};

type CodeSnippetQuickPickItem = TargetQuickPickItem | ClientQuickPickItem;

export class CodeSnippetController {
    private readonly _availableTargets: CodeSnippetTarget[] = availableTargets();
    private readonly clipboard: Clipboard;
    private _webview: CodeSnippetWebview;

    constructor(context: ExtensionContext) {
        this._webview = new CodeSnippetWebview(context);
        this.clipboard = env.clipboard;
    }

    public async run() {
        const editor = window.activeTextEditor;
        const document = getCurrentTextDocument();
        if (!editor || !document) {
            return;
        }

        const selectedRequest = await Selector.getRequest(editor);
        if (!selectedRequest) {
            return;
        }

        const { text, metadatas } = selectedRequest;
        const requestSettings = new RequestSettings(metadatas);
        const settings: IOneRequestSettings = new OneRequestSettings(requestSettings);

        // parse http request
        const httpRequest = await RequestParserFactory.createRequestParser(text, settings).parseHttpRequest();

        const harHttpRequest = this.convertToHARHttpRequest(httpRequest);
        const snippet = new HTTPSnippet(this.ensureHarRequest(harHttpRequest));

        let target: CodeSnippetTarget | undefined;

        const quickPick = window.createQuickPick<CodeSnippetQuickPickItem>();
        const targetQuickPickItems: TargetQuickPickItem[] = this._availableTargets.map(target => ({ label: target.title, ...target }));
        quickPick.title = 'Generate Code Snippet';
        quickPick.step = 1;
        quickPick.totalSteps = 2;
        quickPick.items = targetQuickPickItems;
        quickPick.matchOnDescription = true;
        quickPick.matchOnDetail = true;
        quickPick.onDidHide(() => quickPick.dispose());
        quickPick.onDidTriggerButton(() => {
            quickPick.step!--;
            quickPick.buttons = [];
            quickPick.items = targetQuickPickItems;
            target = undefined;
        });
        quickPick.onDidAccept(() => {
            const selectedItem = quickPick.selectedItems[0];
            if (!selectedItem) {
                return;
            }

            if (quickPick.step === 1) {
                if (!('clients' in selectedItem)) {
                    return;
                }
                quickPick.value = '';
                quickPick.step++;
                quickPick.buttons = [QuickInputButtons.Back];
                target = selectedItem;
                quickPick.items = target.clients.map(
                    client => ({
                        label: client.title,
                        detail: client.link,
                        ...client
                    })
                );
            } else if (quickPick.step === 2) {
                if (!('detail' in selectedItem) || !target) {
                    return;
                }
                const { key: ck, title: ct } = selectedItem;
                const { key: tk, title: tt } = target;
                Telemetry.sendEvent('Generate Code Snippet', { 'target': target.key, 'client': ck });
                const result = this.normalizeSnippetResult(snippet.convert(tk, ck));
                if (!result) {
                    window.showErrorMessage('Unable to generate code snippet for current target/client.');
                    return;
                }

                quickPick.hide();
                try {
                    this._webview.render(result, `${tt}-${ct}`, tk);
                } catch (reason) {
                    Logger.error('Unable to preview generated code snippet:', reason);
                    window.showErrorMessage(reason);
                }
            }
        });
        quickPick.show();
    }

    @trace('Copy Request As cURL')
    public async copyAsCurl() {
        const editor = window.activeTextEditor;
        const document = getCurrentTextDocument();
        if (!editor || !document) {
            return;
        }

        const selectedRequest = await Selector.getRequest(editor);
        if (!selectedRequest) {
            return;
        }

        const { text, metadatas } = selectedRequest;
        const requestSettings = new RequestSettings(metadatas);
        const settings: IOneRequestSettings = new OneRequestSettings(requestSettings);

        // parse http request
        const httpRequest = await RequestParserFactory.createRequestParser(text, settings).parseHttpRequest();

        const harHttpRequest = this.convertToHARHttpRequest(httpRequest);
        const addPrefix = !/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(harHttpRequest.url);
        const originalUrl = harHttpRequest.url;
        if (addPrefix) {
            // Add protocol for url that doesn't specify protocol to pass the HTTPSnippet validation #328
            harHttpRequest.url = `http://${originalUrl}`;
        }
        const snippet = new HTTPSnippet(this.ensureHarRequest(harHttpRequest));
        if (addPrefix) {
            snippet.requests[0].fullUrl = originalUrl;
        }
        const result = this.normalizeSnippetResult(
            snippet.convert('shell', 'curl', process.platform === 'win32' ? { indent: false } : {}),
        );
        if (!result) {
            window.showErrorMessage('Unable to convert request to cURL.');
            return;
        }

        await this.clipboard.writeText(result);
    }

    private convertToHARHttpRequest(request: HttpRequest): HARHttpRequest {
        // convert headers
        const headers: HARHeader[] = [];
        for (const key in request.headers) {
            const headerValue = request.headers[key];
            if (!headerValue) {
                continue;
            }
            const headerValues = Array.isArray(headerValue) ? headerValue : [headerValue.toString()];
            for (let value of headerValues) {
                if (key.toLowerCase() === 'authorization') {
                    value = CodeSnippetController.normalizeAuthHeader(value);
                }
                headers.push(new HARHeader(key, value));
            }
        }

        // convert cookie headers
        const cookies: HARCookie[] = [];
        const cookieHeader = headers.find(header => header.name.toLowerCase() === 'cookie');
        if (cookieHeader) {
            cookieHeader.value.split(';').forEach(pair => {
                const [headerName, headerValue = ''] = pair.split('=', 2);
                cookies.push(new HARCookie(headerName.trim(), headerValue.trim()));
            });
        }

        // convert body
        let body: HARPostData | undefined;
        if (request.body) {
            const contentTypeHeader = headers.find(header => header.name.toLowerCase() === 'content-type');
            const mimeType: string = contentTypeHeader?.value ?? 'application/json';
            if (typeof request.body === 'string') {
                const normalizedBody = request.body.split(EOL).reduce((prev, cur) => prev.concat(cur.trim()), '');
                body = new HARPostData(mimeType, normalizedBody);
            } else {
                body = new HARPostData(mimeType, request.rawBody!);
            }
        }

        return new HARHttpRequest(request.method, encodeUrl(request.url), headers, cookies, body);
    }

    public dispose() {
        this._webview.dispose();
    }

    private normalizeSnippetResult(result: string | false | string[]): string {
        if (result === false) {
            return '';
        }

        return Array.isArray(result) ? result.join(EOL) : result;
    }

    private ensureHarRequest(request: HARHttpRequest): HARHttpRequest & { postData: HARPostData } {
        if (!request.postData) {
            request.postData = new HARPostData('text/plain', '');
        }

        return request as HARHttpRequest & { postData: HARPostData };
    }

    private static normalizeAuthHeader(authHeader: string) {
        if (authHeader) {
            const start = authHeader.indexOf(' ');
            const scheme = authHeader.slice(0, start);
            if (scheme.toLowerCase() === 'basic') {
                const params = authHeader.slice(start).trim().split(' ');
                if (params.length === 2) {
                    return `Basic ${base64(`${params[0]}:${params[1]}`)}`;
                } else if (params.length === 1 && params[0].includes(':')) {
                    const [user, password] = params[0].split(':');
                    return `Basic ${base64(`${user}:${password}`)}`;
                }
            }
        }

        return authHeader;
    }
}
