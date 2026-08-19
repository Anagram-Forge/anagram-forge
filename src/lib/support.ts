/** Swap this file when a sponsor or form backend exists. Nothing loads until asked. */
export type AdCreative = {
  href: string;
  label: string;
  image?: string;
};

export const SUPPORT = {
  enabled: true,
  prompt:
    "If you would like to support this project or apply as a sponsor, please click here.",
  hide: "Hide",
  /** Shown only when a live ad creative is set. */
  ad: null as AdCreative | null,
  /**
   * Form backend. Formspree, Basin, Getform, or Web3Forms all work.
   * Leave blank until you have one — the form still validates and can mailto.
   */
  formEndpoint: "",
  inbox: "sponsors@anagramforge.com",
  /**
   * Cloudflare Turnstile site key (optional). Privacy-friendly captcha.
   * https://dash.cloudflare.com → Turnstile
   */
  turnstileSiteKey: "",
};
