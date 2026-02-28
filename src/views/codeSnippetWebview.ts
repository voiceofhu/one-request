import codeHighlightLinenums from 'code-highlight-linenums';
import hljs from 'highlight.js';
import { Clipboard, commands, env, ExtensionContext, ViewColumn, WebviewPanel, window } from 'vscode';
import { trace } from '../utils/decorator';
import { disposeAll } from '../utils/dispose';
import { BaseWebview } from './baseWebview';

export class CodeSnippetWebview extends BaseWebview {

    protected get viewType(): string {
        return 'rest-code-snippet';
    }

    protected get previewActiveContextKey(): string {
        return 'codeSnippetPreviewFocus';
    }

    private readonly clipboard: Clipboard = env.clipboard;

    private activeCodeSnippet: string | undefined;

    public constructor(context: ExtensionContext) {
        super(context);

        this.context.subscriptions.push(commands.registerCommand('rest-client.copy-codesnippet', this.copy, this));
    }

    public async render(convertResult: string, title: string, lang: string) {
        let panel: WebviewPanel;
        if (this.panels.length === 0) {
            panel = window.createWebviewPanel(
                this.viewType,
                title,
                ViewColumn.Two,
                {
                    enableFindWidget: true,
                    retainContextWhenHidden: true
                });

            panel.onDidDispose(() => {
                this.setPreviewActiveContext(false);
                this.panels.pop();
                this._onDidCloseAllWebviewPanels.fire();
            });

            panel.onDidChangeViewState(({ webviewPanel }) => {
                this.setPreviewActiveContext(webviewPanel.active);
            });

            panel.iconPath = this.iconFilePath;

            this.panels.push(panel);
        } else {
            panel = this.panels[0];
            panel.title = title;
        }

        panel.webview.html = this.getHtmlForWebview(panel, convertResult, lang);

        this.setPreviewActiveContext(true);
        this.activeCodeSnippet = convertResult;

        panel.reveal(ViewColumn.Two);
    }

    public dispose() {
        disposeAll(this.panels);
    }

    @trace('Copy Code Snippet')
    private async copy() {
        if (this.activeCodeSnippet) {
            await this.clipboard.writeText(this.activeCodeSnippet);
        }
    }

    private getHtmlForWebview(panel: WebviewPanel, convertResult: string, lang: string): string {
        const nonce = this.getNonce();
        const csp = this.getCsp(panel, nonce);
        return `
            <head>
                <link rel="stylesheet" type="text/css" href="${panel.webview.asWebviewUri(this.baseFilePath)}">
                <link rel="stylesheet" type="text/css" href="${panel.webview.asWebviewUri(this.vscodeStyleFilePath)}">
                <link rel="stylesheet" type="text/css" href="${panel.webview.asWebviewUri(this.customStyleFilePath)}">
                ${csp}
            </head>
            <body>
                <div>
                    <pre><code>${codeHighlightLinenums(convertResult, { hljs, lang: this.getHighlightJsLanguageAlias(lang), start: 1 })}</code></pre>
                    <a id="scroll-to-top" role="button" aria-label="scroll to top"><span class="icon"></span></a>
                </div>
                <script nonce="${nonce}">
                    document.addEventListener('DOMContentLoaded', function () {
                        const button = document.getElementById('scroll-to-top');
                        if (button) {
                            button.addEventListener('click', function () { window.scrollTo(0, 0); });
                        }
                    });
                </script>
            </body>`;
    }

    private getHighlightJsLanguageAlias(lang: string) {
        if (!lang || lang === 'shell') {
            return 'bash';
        }

        if (lang === 'node') {
            return 'javascript';
        }

        return lang;
    }

    private getCsp(panel: WebviewPanel, nonce: string): string {
        const cspSource = panel.webview.cspSource;
        return `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${cspSource} data:; script-src 'nonce-${nonce}'; style-src ${cspSource} 'unsafe-inline';">`;
    }

    private getNonce(): string {
        return `${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
    }
}
