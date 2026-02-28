import { ExtensionContext, Range, TextDocument, ViewColumn, window } from 'vscode';
import Logger from '../logger';
import { IOneRequestSettings, RequestSettings, OneRequestSettings } from '../models/configurationSettings';
import { HistoricalHttpRequest, HttpRequest } from '../models/httpRequest';
import { RequestMetadata } from '../models/requestMetadata';
import { RequestParserFactory } from '../models/requestParserFactory';
import { trace } from "../utils/decorator";
import { HttpClient } from '../utils/httpClient';
import { RequestState, RequestStatusEntry } from '../utils/requestStatusBarEntry';
import { RequestVariableCache } from "../utils/requestVariableCache";
import { Selector } from '../utils/selector';
import { UserDataManager } from '../utils/userDataManager';
import { getCurrentTextDocument } from '../utils/workspaceUtility';
import { HttpResponseTextDocumentView } from '../views/httpResponseTextDocumentView';
import { HttpResponseWebview } from '../views/httpResponseWebview';

export class RequestController {
    private _requestStatusEntry: RequestStatusEntry;
    private _httpClient: HttpClient;
    private _webview: HttpResponseWebview;
    private _textDocumentView: HttpResponseTextDocumentView;
    private _lastRequestSettingTuple: [HttpRequest, IOneRequestSettings];
    private _lastPendingRequest?: HttpRequest;

    public constructor(context: ExtensionContext) {
        this._requestStatusEntry = new RequestStatusEntry();
        this._httpClient = new HttpClient();
        this._webview = new HttpResponseWebview(context);
        this._webview.onDidCloseAllWebviewPanels(() => this._requestStatusEntry.update({ state: RequestState.Closed }));
        this._textDocumentView = new HttpResponseTextDocumentView();
    }

    @trace('Request')
    public async run(range: Range) {
        const editor = window.activeTextEditor;
        const document = getCurrentTextDocument();
        if (!editor || !document) {
            return;
        }

        const selectedRequest = await Selector.getRequest(editor, range);
        if (!selectedRequest) {
            return;
        }

        const { text, metadatas } = selectedRequest;
        const name = metadatas.get(RequestMetadata.Name);

        if (metadatas.has(RequestMetadata.Note)) {
            if (!await this.confirmRequestSend(name)) {
                return;
            }
        }

        const requestSettings = new RequestSettings(metadatas);
        const settings: IOneRequestSettings = new OneRequestSettings(requestSettings);

        // parse http request
        const httpRequest = await RequestParserFactory.createRequestParser(text, settings).parseHttpRequest(name);

        await this.runCore(httpRequest, settings, document);
    }

    @trace('Rerun Request')
    public async rerun() {
        if (!this._lastRequestSettingTuple) {
            return;
        }

        const [request, settings] = this._lastRequestSettingTuple;
        await this.runCore(request, settings);
    }

    @trace('Cancel Request')
    public async cancel() {
        this._lastPendingRequest?.cancel();

        this._requestStatusEntry.update({ state: RequestState.Cancelled });
    }
    public async clearCookies() {
        try {
            await this._httpClient.clearCookies();
        } catch (error) {
            window.showErrorMessage(`Error clearing cookies:${error?.message}`);
        }
    }

    private async runCore(httpRequest: HttpRequest, settings: IOneRequestSettings, document?: TextDocument) {
        httpRequest.isCancelled = false;

        // clear status bar
        this._requestStatusEntry.update({ state: RequestState.Pending });

        // set last request and last pending request
        this._lastPendingRequest = httpRequest;
        this._lastRequestSettingTuple = [httpRequest, settings];

        // set http request
        try {
            const response = await this._httpClient.send(httpRequest, settings);

            // check cancel
            if (httpRequest.isCancelled) {
                return;
            }

            this._requestStatusEntry.update({ state: RequestState.Received, response });

            if (httpRequest.name && document) {
                RequestVariableCache.add(document, httpRequest.name, response);
            }

            await this.previewResponse(response, settings);

            // persist to history json file
            await UserDataManager.addToRequestHistory(HistoricalHttpRequest.convertFromHttpRequest(httpRequest));
        } catch (error) {
            // check cancel
            if (httpRequest.isCancelled) {
                return;
            }

            const requestError = this.normalizeRequestError(error, settings);
            this._requestStatusEntry.update({ state: RequestState.Error });
            Logger.error('Failed to send request:', requestError);
            window.showErrorMessage(requestError.message);
        } finally {
            if (this._lastPendingRequest === httpRequest) {
                this._lastPendingRequest = undefined;
            }
        }
    }

    private async confirmRequestSend(name?: string): Promise<boolean> {
        const note = name ? `Are you sure you want to send the request "${name}"?` : 'Are you sure you want to send this request?';
        const userConfirmed = await window.showWarningMessage(note, 'Yes', 'No');
        return userConfirmed === 'Yes';
    }

    private async previewResponse(response: Awaited<ReturnType<HttpClient['send']>>, settings: IOneRequestSettings): Promise<void> {
        try {
            const activeColumn = window.activeTextEditor?.viewColumn ?? ViewColumn.One;
            const previewColumn = settings.previewColumn === ViewColumn.Active
                ? activeColumn
                : ((activeColumn as number) + 1) as ViewColumn;
            if (settings.previewResponseInUntitledDocument) {
                await this._textDocumentView.render(response, previewColumn);
            } else {
                await this._webview.render(response, previewColumn);
            }
        } catch (reason) {
            Logger.error('Unable to preview response:', reason);
            window.showErrorMessage(`${reason}`);
        }
    }

    private normalizeRequestError(error: unknown, settings: IOneRequestSettings): Error {
        const requestError = error as { code?: string; message?: string; toString?: () => string };
        const details = requestError.toString?.() ?? `${error}`;
        let message = requestError.message ?? details;

        if (requestError.code === 'ETIMEDOUT') {
            message = `Request timed out. Double-check your network connection and/or raise the timeout duration (currently set to ${settings.timeoutInMilliseconds}ms) as needed: 'one-request.timeoutinmilliseconds'. Details: ${details}.`;
        } else if (requestError.code === 'ECONNREFUSED') {
            message = `The connection was rejected. Either the requested service isn’t running on the requested server/port, the proxy settings in vscode are misconfigured, or a firewall is blocking requests. Details: ${details}.`;
        } else if (requestError.code === 'ENETUNREACH') {
            message = `You don't seem to be connected to a network. Details: ${details}`;
        }

        return Object.assign(new Error(message), requestError);
    }

    public dispose() {
        this._requestStatusEntry.dispose();
        this._webview.dispose();
    }
}
