export interface HARNameValue {
    name: string;
    value: string;
}

export class HARHeader implements HARNameValue {
    public constructor(public name: string, public value: string) {
    }
}

export class HARCookie implements HARNameValue {
    public constructor(public name: string, public value: string) {
    }
}

export class HARParam implements HARNameValue {
    public constructor(public name: string, public value: string) {
    }
}

export class HARPostData {
    public params: HARParam[];
    public constructor(public mimeType: string, public text: string) {
        if (mimeType === 'application/x-www-form-urlencoded') {
            if (text) {
                text = decodeURIComponent(text.replace(/\+/g, '%20'));
                this.params = [];
                const pairs = text.split('&');
                pairs.forEach(pair => {
                    const [key, ...values] = pair.split('=');
                    this.params.push(new HARParam(key, values.join('=')));
                });
            }
        }
    }
}

export class HARHttpRequest {
    public httpVersion: string;
    public headersSize: number;
    public bodySize: number;
    public queryString: HARParam[];

    public constructor(public method: string, public url: string, public headers: HARHeader[], public cookies: HARCookie[], public postData?: HARPostData) {
        // HAR spec allows -1 when size is unknown.
        this.httpVersion = 'HTTP/1.1';
        this.headersSize = -1;
        this.bodySize = postData?.text?.length ?? 0;
        this.queryString = this.parseQueryString(url);
    }

    private parseQueryString(requestUrl: string): HARParam[] {
        let urlObject: URL;
        try {
            urlObject = new URL(requestUrl);
        } catch {
            // `httpsnippet` accepts urls without protocol, which cannot be parsed directly by URL.
            urlObject = new URL(`http://${requestUrl}`);
        }
        const queryObj = urlObject.searchParams;
        const queryParams: HARParam[] = [];
        for (const name of new Set(queryObj.keys())) {
            const values = queryObj.getAll(name);
            if (values.length > 1) {
                queryParams.push(...values.map(v => new HARParam(name, v)));
            } else {
                queryParams.push(new HARParam(name, queryObj.get(name) || ''));
            }
        }
        return queryParams;
    }
}
