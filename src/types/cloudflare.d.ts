declare module "cloudflare:email" {
  export class EmailMessage {
    constructor(from: string, to: string, raw: string);
  }
}

declare module "cloudflare:workers" {
  export const env: Record<string, unknown> & {
    EMAIL?: { send: (message: unknown) => Promise<void> };
    SPONSOR_TO?: string;
    FORGE_ADMIN?: string;
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
