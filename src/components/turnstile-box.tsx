import { useEffect, useRef, useState } from "react";

type Props = {
  onChange: (next: { required: boolean; token: string }) => void;
};

export function TurnstileBox({ onChange }: Props) {
  const [siteKey, setSiteKey] = useState<string | null>(null);
  const host = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    let cancel = false;
    void fetch("/api/report")
      .then((r) => r.json())
      .then((data: { siteKey?: string }) => {
        if (cancel) return;
        const key = String(data.siteKey || "");
        setSiteKey(key);
        onChangeRef.current({ required: true, token: "" });
      })
      .catch(() => {
        if (cancel) return;
        setSiteKey("");
        onChangeRef.current({ required: true, token: "" });
      });
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    if (!siteKey || !host.current) return;
    const el = host.current;
    const w = window as Window & {
      turnstile?: { render: (node: HTMLElement, opts: Record<string, unknown>) => void };
    };
    function mount() {
      if (!w.turnstile) return;
      el.innerHTML = "";
      w.turnstile.render(el, {
        sitekey: siteKey,
        theme: "dark",
        callback: (token: string) => onChangeRef.current({ required: true, token }),
        "expired-callback": () => onChangeRef.current({ required: true, token: "" }),
        "error-callback": () => onChangeRef.current({ required: true, token: "" }),
      });
    }
    if (w.turnstile) {
      mount();
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>("script[data-turnstile]");
    if (existing) {
      existing.addEventListener("load", mount);
      return () => existing.removeEventListener("load", mount);
    }
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.dataset.turnstile = "1";
    script.addEventListener("load", mount);
    document.head.appendChild(script);
    return () => script.removeEventListener("load", mount);
  }, [siteKey]);

  if (siteKey === null) return null;
  if (!siteKey) return <p className="text-xs text-subtle">Captcha isn’t set up yet.</p>;
  return <div ref={host} className="pt-1" />;
}
