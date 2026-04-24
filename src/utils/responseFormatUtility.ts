import { createScanner, SyntaxKind } from 'jsonc-parser';
import * as os from 'os';
import { window } from 'vscode';
import { MimeUtility } from './mimeUtility';
import { isJSONString } from './misc';

export class ResponseFormatUtility {

    private static readonly jsonSpecialTokenMapping = {
        [SyntaxKind.OpenBraceToken]: '{',
        [SyntaxKind.CloseBraceToken]: '}',
        [SyntaxKind.OpenBracketToken]: '[',
        [SyntaxKind.CloseBracketToken]: ']',
        [SyntaxKind.ColonToken]: ':',
        [SyntaxKind.CommaToken]: ',',
        [SyntaxKind.NullKeyword]: 'null',
        [SyntaxKind.TrueKeyword]: 'true',
        [SyntaxKind.FalseKeyword]: 'false'
    };

    public static formatBody(body: string, contentType: string | undefined, suppressValidation: boolean): string {
        if (contentType) {
            if (MimeUtility.isJSON(contentType)) {
                if (isJSONString(body)) {
                    body = this.jsonPrettify(body);
                } else if (body && !suppressValidation) {
                    window.showWarningMessage('The content type of response is application/json, while response body is not a valid json string');
                }
            } else if (MimeUtility.isXml(contentType)) {
                body = this.xmlPrettify(body);
            } else if (MimeUtility.isCSS(contentType)) {
                body = this.cssPrettify(body);
            } else {
                // Add this for the case that the content type of response body is not very accurate #239
                if (isJSONString(body)) {
                    body = this.jsonPrettify(body);
                }
            }
        }

        return body;
    }

    private static jsonPrettify(text: string, indentSize = 2) {
        const scanner = createScanner(text, true);

        let indentLevel = 0;

        function newLineAndIndent() {
            return os.EOL + ' '.repeat(indentLevel * indentSize);
        }

        function scanNext(): [SyntaxKind, string] {
            const token = scanner.scan();
            const offset = scanner.getTokenOffset();
            const length = scanner.getTokenLength();
            const value = text.slice(offset, offset + length);
            return [ token, value ];
        }

        let [firstToken, firstTokenValue] = scanNext();
        let secondToken: SyntaxKind;
        let secondTokenValue: string;
        let result = '';

        while (firstToken !== SyntaxKind.EOF) {
            [secondToken, secondTokenValue] = scanNext();

            switch (firstToken) {
                case SyntaxKind.OpenBraceToken:
                    result += this.jsonSpecialTokenMapping[firstToken];
                    if (secondToken !== SyntaxKind.CloseBraceToken) {
                        indentLevel++;
                        result += newLineAndIndent();
                    }
                    break;
                case SyntaxKind.OpenBracketToken:
                    result += this.jsonSpecialTokenMapping[firstToken];
                    if (secondToken !== SyntaxKind.CloseBracketToken) {
                        indentLevel++;
                        result += newLineAndIndent();
                    }
                    break;
                case SyntaxKind.CloseBraceToken:
                case SyntaxKind.CloseBracketToken:
                case SyntaxKind.NullKeyword:
                case SyntaxKind.TrueKeyword:
                case SyntaxKind.FalseKeyword:
                    result += this.jsonSpecialTokenMapping[firstToken];
                    if (secondToken === SyntaxKind.CloseBraceToken
                        || secondToken === SyntaxKind.CloseBracketToken) {
                        indentLevel--;
                        result += newLineAndIndent();
                    }
                    break;
                case SyntaxKind.CommaToken:
                    result += this.jsonSpecialTokenMapping[firstToken];
                    if (secondToken === SyntaxKind.CloseBraceToken
                        || secondToken === SyntaxKind.CloseBracketToken) {
                        indentLevel--;
                    }
                    result += newLineAndIndent();
                    break;
                case SyntaxKind.ColonToken:
                    result += this.jsonSpecialTokenMapping[firstToken] + ' ';
                    break;
                case SyntaxKind.StringLiteral:
                case SyntaxKind.NumericLiteral:
                case SyntaxKind.Unknown:
                    result += firstTokenValue;
                    if (secondToken === SyntaxKind.CloseBraceToken
                        || secondToken === SyntaxKind.CloseBracketToken) {
                        indentLevel--;
                        result += newLineAndIndent();
                    }
                    break;
                default:
                    result += firstTokenValue;
            }

            firstToken = secondToken;
            firstTokenValue = secondTokenValue;
        }

        return result;
    }

    private static xmlPrettify(text: string): string {
        const compact = text.replace(/>\s*</g, '><').trim();
        if (!compact) {
            return text;
        }

        const tokens = compact.replace(/</g, '\n<').split('\n').filter(Boolean);
        let depth = 0;
        const lines: string[] = [];
        for (const token of tokens) {
            const trimmed = token.trim();
            const isClosing = /^<\//.test(trimmed);
            const isSelfClosing = /\/>$/.test(trimmed) || /^<\?/.test(trimmed) || /^<!/.test(trimmed);

            if (isClosing) {
                depth = Math.max(depth - 1, 0);
            }

            lines.push(`${'  '.repeat(depth)}${trimmed}`);

            const isOpening = /^<[^!?/][^>]*>$/.test(trimmed) && !isSelfClosing && !isClosing;
            if (isOpening) {
                depth++;
            }
        }

        return lines.join(os.EOL);
    }

    private static cssPrettify(text: string): string {
        const compact = text.replace(/\s+/g, ' ').trim();
        if (!compact) {
            return text;
        }

        let depth = 0;
        const parts = compact
            .replace(/\{/g, '{\n')
            .replace(/\}/g, '\n}\n')
            .replace(/;/g, ';\n')
            .split('\n')
            .map(part => part.trim())
            .filter(Boolean);

        const lines: string[] = [];
        for (const part of parts) {
            if (part === '}') {
                depth = Math.max(depth - 1, 0);
            }

            lines.push(`${'  '.repeat(depth)}${part}`);

            if (part.endsWith('{')) {
                depth++;
            }
        }

        return lines.join(os.EOL);
    }
}
