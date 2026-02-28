export interface AadTokenResponse {
    accessToken: string;
    tokenType: string;
    refreshToken?: string;
    tenantId?: string;
    expiresOn: Date;
}

export class AadTokenCache {
    private static cache = new Map<string, AadTokenResponse>();

    public static get(key: string): AadTokenResponse | undefined {
        return this.cache.get(key);
    }

    public static set(key: string, value: AadTokenResponse) {
        this.cache.set(key, value);
    }

    public static clear(): void {
        this.cache.clear();
    }
}
