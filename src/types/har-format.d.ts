declare module "har-format" {
  export interface NameValuePair {
    name: string;
    value: string;
  }

  export interface Header extends NameValuePair {}
  export interface Cookie extends NameValuePair {}
  export interface Param extends NameValuePair {}
  export interface QueryString extends NameValuePair {}

  export interface PostDataCommon {
    mimeType: string;
    params?: Param[];
    text?: string;
  }

  export interface Request {
    method: string;
    url: string;
    httpVersion: string;
    headers: Header[];
    queryString: QueryString[];
    cookies: Cookie[];
    headersSize: number;
    bodySize: number;
    postData?: PostDataCommon;
    comment?: string;
  }
}
