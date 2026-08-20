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
    STATS?: {
      get: (key: string) => Promise<string | null>;
      put: (key: string, value: string) => Promise<void>;
    };
  };
}
