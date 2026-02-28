import * as path from 'path';
import { CancellationToken, DocumentSymbolProvider, Location, Range, SymbolInformation, SymbolKind, TextDocument } from 'vscode';
import * as Constants from '../common/constants';
import { RequestParserFactory } from '../models/requestParserFactory';
import { Selector } from '../utils/selector';
import { VariableProcessor } from '../utils/variableProcessor';

export class HttpDocumentSymbolProvider implements DocumentSymbolProvider {
    public async provideDocumentSymbols(document: TextDocument, token: CancellationToken): Promise<SymbolInformation[]> {
        const symbols: SymbolInformation[] = [];
        const lines: string[] = document.getText().split(Constants.LineSplitterRegex);
        const requestRanges: [number, number][] = Selector.getRequestRanges(
            lines,
            { ignoreCommentLine: false , ignoreFileVariableDefinitionLine: false });
        const fileName = path.basename(document.fileName, path.extname(document.fileName));

        for (const [requestStart, blockEnd] of requestRanges) {
            let blockStart = requestStart;
            // get real start for current requestRange
            let requestName: string | undefined;
            while (blockStart <= blockEnd) {
                const line = lines[blockStart];
                if (Selector.isEmptyLine(line) ||
                    Selector.isCommentLine(line)) {
                    if (Selector.isRequestVariableDefinitionLine(line)) {
                        requestName = Selector.getRequestVariableDefinitionName(line);
                    }
                    blockStart++;
                } else if (Selector.isFileVariableDefinitionLine(line)) {
                    const [name, container] = this.getFileVariableSymbolInfo(line, fileName);
                    symbols.push(
                        new SymbolInformation(
                            name,
                            SymbolKind.Variable,
                            container,
                            new Location(
                                document.uri,
                                new Range(blockStart, 0, blockStart, line.length))));
                    blockStart++;
                } else {
                    break;
                }
            }

            if (blockStart > blockEnd) {
                continue;
            }

            if (Selector.isResponseStatusLine(lines[blockStart])) {
                continue;
            }

            if (blockStart <= blockEnd) {
                const [name, container] = await this.getRequestSymbolInfo(lines[blockStart], requestName, fileName);
                symbols.push(
                    new SymbolInformation(
                        name,
                        SymbolKind.Method,
                        container,
                        new Location(
                            document.uri,
                            new Range(blockStart, 0, blockEnd, lines[blockEnd].length))));
            }
        }
        return symbols;
    }

    private getFileVariableSymbolInfo(line: string, fileName: string): [string, string] {
        line = line.trim();
        const match = Constants.FileVariableDefinitionRegex.exec(line);
        const variableName = match?.[1] ?? line.substring(1, line.indexOf('=')).trim();
        return [variableName, fileName];
    }

    private async getRequestSymbolInfo(rawText: string, name: string | undefined, fileName: string): Promise<[string, string]> {
        // For request with name, return the request name and file name instead
        if (name) {
            return [name, fileName];
        }

        const text = await VariableProcessor.processRawRequest(rawText);
        const parser = RequestParserFactory.createRequestParser(text);
        const request = await parser.parseHttpRequest();
        try {
            const parsedUrl = new URL(request.url);
            const requestPath = `${parsedUrl.pathname}${parsedUrl.search}`;
            return [`${request.method} ${requestPath}`, parsedUrl.host];
        } catch {
            return [`${request.method} ${request.url}`, ''];
        }
    }
}
