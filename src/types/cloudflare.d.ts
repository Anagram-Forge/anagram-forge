declare module "cloudflare:email" {
  export class EmailMessage {
    constructor(from: string, to: string, raw: string);
  }
}

declare module "cloudflare:workers" {
  export const env: Record<string, unknown> & {
    EMAIL?: { send: (message: unknown) => Promise<void> };
    SPONSOR_TO?: string;
    DOOR_HASH?: string;
    STATS?: {
      get: (key: string) => Promise<string | null>;
      put: (key: string, value: string) => Promise<void>;
    };
    MEDIA?: {
      get: (
        key: string,
        opts?: { range?: { offset: number; length?: number } },
      ) => Promise<{
        body: ReadableStream;
        size: number;
        httpEtag: string;
        writeHttpMetadata: (headers: Headers) => void;
      } | null>;
    };
  };
}

/** Build-time branch name from CF_PAGES_BRANCH (vite define). Empty outside Pages builds. */
declare const __AF_BRANCH__: string;
