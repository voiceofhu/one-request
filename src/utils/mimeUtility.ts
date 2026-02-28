import * as mime from 'mime-types';

class MimeType {
    public readonly type: string;
    public readonly subtype: string;
    public readonly charset?: string;
    public constructor(type: string, subtype: string, charset?: string) {
        this.type = type.toLowerCase();
        this.subtype = subtype?.toLowerCase() ?? '';
        this.charset = charset;
    }

    public get essence(): string {
        return `${this.type}/${this.subtype}`;
    }
}

export class MimeUtility {
    private static readonly supportedImageFormats = new Set<string>([
        'image/jpeg',
        'image/gif',
        'image/webp',
        'image/png',
        'image/bmp'
    ]);

    public static parse(contentTypeString: string) {
        // application/json; charset=utf-8
        // application/vnd.github.chitauri-preview+sha
        const [essence, ...parameters] = contentTypeString.split(';').map(v => v.trim());
        const [type, subtype] = essence.split('/');
        const charset = parameters.find(p => p.startsWith('charset='))?.split('=')[1];
        return new MimeType(type, subtype, charset);
    }

    public static getExtension(contentTypeString: string | undefined, mimeAndFileExtensionMapping: { [key: string]: string }): string {
        const mimeType = this.getParsedMimeType(contentTypeString);
        if (!mimeType) {
            return '';
        }

        const { essence } = mimeType;

        // Check if user has custom mapping for this content type first
        if (essence in mimeAndFileExtensionMapping) {
            const ext = mimeAndFileExtensionMapping[essence];
            return ext.replace(/^(\.)+/, '');
        }
        return mime.extension(contentTypeString) || '';
    }

    public static isBrowserSupportedImageFormat(contentTypeString: string | undefined): boolean {
        // https://en.wikipedia.org/wiki/Comparison_of_web_browsers#Image_format_support
        // For chrome supports JPEG, GIF, WebP, PNG and BMP
        const mimeType = this.getParsedMimeType(contentTypeString);
        return !!mimeType && this.supportedImageFormats.has(mimeType.essence);
    }

    public static isJSON(contentTypeString: string | undefined): boolean {
        const mimeType = this.getParsedMimeType(contentTypeString);
        if (!mimeType) {
            return false;
        }

        const { subtype, essence } = mimeType;
        return essence === 'application/json' || essence === 'text/json' || subtype.endsWith('+json') || subtype.startsWith('x-amz-json');
    }

    public static isXml(contentTypeString: string | undefined): boolean {
        const mimeType = this.getParsedMimeType(contentTypeString);
        if (!mimeType) {
            return false;
        }

        const { subtype, essence } = mimeType;
        return essence === 'application/xml' || essence === 'text/xml' || subtype.endsWith('+xml');
    }

    public static isHtml(contentTypeString: string | undefined): boolean {
        return this.isEssence(contentTypeString, 'text/html');
    }

    public static isJavaScript(contentTypeString: string | undefined): boolean {
        const essence = this.getParsedMimeType(contentTypeString)?.essence;
        if (!essence) {
            return false;
        }

        return essence === 'application/javascript' || essence === 'text/javascript';
    }

    public static isCSS(contentTypeString: string | undefined): boolean {
        return this.isEssence(contentTypeString, 'text/css');
    }

    public static isMultiPartMixed(contentTypeString: string | undefined): boolean {
        return this.isEssence(contentTypeString, 'multipart/mixed');
    }

    public static isMultiPartFormData(contentTypeString: string | undefined): boolean {
        return this.isEssence(contentTypeString, 'multipart/form-data');
    }

    public static isFormUrlEncoded(contentTypeString: string | undefined): boolean {
        return this.isEssence(contentTypeString, 'application/x-www-form-urlencoded');
    }

    public static isNewlineDelimitedJSON(contentTypeString: string | undefined): boolean {
        return this.isEssence(contentTypeString, 'application/x-ndjson');
    }

    private static getParsedMimeType(contentTypeString: string | undefined): MimeType | undefined {
        if (!contentTypeString) {
            return undefined;
        }

        return this.parse(contentTypeString);
    }

    private static isEssence(contentTypeString: string | undefined, expectedEssence: string): boolean {
        const mimeType = this.getParsedMimeType(contentTypeString);
        return !!mimeType && mimeType.essence === expectedEssence;
    }
}
