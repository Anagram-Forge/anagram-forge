import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SUPPORT } from "@/lib/support";

type Status = "idle" | "sending" | "sent" | "mailed" | "error";

function newChallenge() {
  const a = 2 + Math.floor(Math.random() * 8);
  const b = 2 + Math.floor(Math.random() * 8);
  return { a, b, sum: a + b };
}

export function SponsorForm() {
  const opened = useRef(Date.now());
  const [status, setStatus] = useState<Status>("idle");
  const [challenge, setChallenge] = useState(newChallenge);
  const [answer, setAnswer] = useState("");
  const [turnstile, setTurnstile] = useState("");
  const widget = useRef<HTMLDivElement>(null);
  const key = SUPPORT.turnstileSiteKey;
  const connected = Boolean(SUPPORT.formEndpoint || SUPPORT.inbox);

  useEffect(() => {
    if (!key || !widget.current) return;
    const w = window as Window & {
      turnstile?: {
        render: (el: HTMLElement, opts: Record<string, unknown>) => void;
      };
    };
    function mount() {
      if (!widget.current || !w.turnstile) return;
      widget.current.innerHTML = "";
      w.turnstile.render(widget.current, {
        sitekey: key,
        theme: "dark",
        callback: (token: string) => setTurnstile(token),
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
  }, [key]);

  const canSend = useMemo(() => {
    if (!connected) return false;
    if (Number(answer) !== challenge.sum) return false;
    if (key && !turnstile) return false;
    return true;
  }, [answer, challenge.sum, key, turnstile, connected]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!connected) return;
    const form = e.currentTarget;
    const data = new FormData(form);
    if (String(data.get("company_url") || "").trim()) return;
    if (Date.now() - opened.current < 2500) {
      toast("Please take a moment to finish the form.");
      return;
    }
    if (Number(answer) !== challenge.sum) {
      toast("Check the human question and try again.");
      setChallenge(newChallenge());
      setAnswer("");
      return;
    }
    if (key && !turnstile) {
      toast("Complete the captcha first.");
      return;
    }

    const payload = {
      name: String(data.get("name") || "").trim(),
      email: String(data.get("email") || "").trim(),
      company: String(data.get("company") || "").trim(),
      budget: String(data.get("budget") || "").trim(),
      message: String(data.get("message") || "").trim(),
      "cf-turnstile-response": turnstile,
    };
    if (!payload.name || !payload.email) {
      toast("Name and email are required.");
      return;
    }

    setStatus("sending");
    try {
      const api = await fetch("/api/sponsor", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(payload),
      });
      if (api.ok) {
        setStatus("sent");
        form.reset();
        setAnswer("");
        setChallenge(newChallenge());
        return;
      }
      if (SUPPORT.formEndpoint) {
        const body = new FormData();
        for (const [k, v] of Object.entries(payload)) body.set(k, v);
        body.set("_subject", `Sponsor application — ${payload.company || payload.name}`);
        const res = await fetch(SUPPORT.formEndpoint, {
          method: "POST",
          body,
          headers: { Accept: "application/json" },
        });
        if (!res.ok) throw new Error("send failed");
      } else if (SUPPORT.inbox) {
        const body = [
          `Name: ${payload.name}`,
          `Email: ${payload.email}`,
          `Company: ${payload.company}`,
          `Budget: ${payload.budget}`,
          "",
          payload.message,
        ].join("\n");
        window.location.href = `mailto:${SUPPORT.inbox}?subject=${encodeURIComponent("Sponsor application")}&body=${encodeURIComponent(body)}`;
        setStatus("mailed");
        form.reset();
        setAnswer("");
        setChallenge(newChallenge());
        return;
      } else {
        throw new Error("no inbox");
      }
      setStatus("sent");
      form.reset();
      setAnswer("");
      setChallenge(newChallenge());
    } catch {
      setStatus("error");
      toast("Could not send. Try again or email directly.");
    }
  }

  if (status === "sent") {
    return (
      <p className="text-sm text-muted">Thank you. If this is a good fit, you will hear back.</p>
    );
  }
  if (status === "mailed") {
    return (
      <div className="space-y-2 text-sm text-muted">
        <p>Your mail app should have opened with the application filled in. Hit send there.</p>
        {SUPPORT.inbox ? (
          <p className="text-xs text-subtle">
            If nothing opened, write to{" "}
            <a className="underline hover:text-fg" href={`mailto:${SUPPORT.inbox}`}>
              {SUPPORT.inbox}
            </a>
            .
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 text-left">
      <p className="text-sm text-muted">Apply to sponsor this quiet spot.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs text-subtle">Name</span>
          <Input name="name" required autoComplete="name" className="mt-1" />
        </label>
        <label className="block">
          <span className="text-xs text-subtle">Email</span>
          <Input name="email" type="email" required autoComplete="email" className="mt-1" />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs text-subtle">Company or site</span>
          <Input name="company" autoComplete="organization" className="mt-1" />
        </label>
        <label className="block">
          <span className="text-xs text-subtle">Monthly budget</span>
          <select
            name="budget"
            className="mt-1 h-11 w-full rounded-md border border-border bg-raised px-3 text-sm text-fg"
            defaultValue=""
          >
            <option value="" disabled>
              Optional
            </option>
            <option value="under-50">Under $50</option>
            <option value="50-150">$50–150</option>
            <option value="150-400">$150–400</option>
            <option value="400-plus">$400+</option>
            <option value="trade">Trade / affiliate</option>
          </select>
        </label>
      </div>
      <label className="block">
        <span className="text-xs text-subtle">Note</span>
        <textarea
          name="message"
          rows={3}
          className="mt-1 w-full rounded-md border border-border bg-raised px-3 py-2 text-sm text-fg"
        />
      </label>
      <label className="hidden" aria-hidden="true">
        Company URL
        <input name="company_url" tabIndex={-1} autoComplete="off" />
      </label>
      <label className="block">
        <span className="text-xs text-subtle">
          Human check · what is {challenge.a} + {challenge.b}?
        </span>
        <Input
          inputMode="numeric"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          className="mt-1 max-w-28"
          required
        />
      </label>
      {key ? <div ref={widget} className="pt-1" /> : null}
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <Button type="submit" size="sm" disabled={!canSend || status === "sending"}>
          {status === "sending" ? "Sending…" : "Send application"}
        </Button>
        {!connected ? (
          <span className="text-xs text-subtle">Inbox not connected yet.</span>
        ) : status === "error" ? (
          <span className="text-xs text-danger">Didn’t go through.</span>
        ) : null}
      </div>
    </form>
  );
}
