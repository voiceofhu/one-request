import * as path from 'path';
import { TextDocument, window, workspace } from 'vscode';

export function getWorkspaceRootPath(): string | undefined {
    const document = getCurrentTextDocument();
    if (document) {
        const fileUri = document.uri;
        const workspaceFolder = workspace.getWorkspaceFolder(fileUri);
        if (workspaceFolder) {
            return workspaceFolder.uri.fsPath;
        }
    }
}

export function getCurrentHttpFilePath(): string | undefined {
    const document = getCurrentTextDocument();
    if (document) {
        return document.fileName;
    }
}

export function getCurrentHttpFileName(): string | undefined {
    const filePath = getCurrentHttpFilePath();
    if (filePath) {
        return path.basename(filePath, path.extname(filePath));
    }
}

export function getCurrentTextDocument(): TextDocument | undefined {
    return window.activeTextEditor?.document;
}
