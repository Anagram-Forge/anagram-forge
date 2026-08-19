import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { toast } from "sonner";
import { TypewriterClerk } from "@/components/typewriter-clerk";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Status = "idle" | "sending" | "sent" | "error";
const MAX = 5 * 1024 * 1024;

function newChallenge() {
  const a = 2 + Math.floor(Math.random() * 8);
  const b = 2 + Math.floor(Math.random() * 8);
  return { a, b, sum: a + b };
}

export function BugForm() {
  const opened = useRef(Date.now());
  const [status, setStatus] = useState<Status>("idle");
  const [challenge, setChallenge] = useState(newChallenge);
  const [answer, setAnswer] = useState("");
  const [kind, setKind] = useState("bug");
  const [draft, setDraft] = useState("");
  const [tapping, setTapping] = useState(false);
  const tapTimer = useRef<number | null>(null);
  const [fileName, setFileName] = useState("");
  const [fileError, setFileError] = useState("");
  const [image, setImage] = useState<{ name: string; type: string; data: string } | null>(null);

  useEffect(() => {
    return () => {
      if (tapTimer.current) window.clearTimeout(tapTimer.current);
    };
  }, []);

  function onTypeKey(e: KeyboardEvent<HTMLFormElement>) {
    if (kind !== "feature") return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "Tab" || e.key === "Shift" || e.key === "Escape") return;
    setTapping(true);
    if (tapTimer.current) window.clearTimeout(tapTimer.current);
    tapTimer.current = window.setTimeout(() => setTapping(false), 140);
  }

  const canSend = useMemo(() => Number(answer) === challenge.sum, [answer, challenge.sum]);

  async function onFile(file: File | undefined) {
    if (!file) {
      setImage(null);
      setFileName("");
      setFileError("");
      return;
    }
    if (!file.type.startsWith("image/")) {
      setImage(null);
      setFileName(file.name);
      setFileError("Use a PNG, JPG, WebP, or GIF.");
      return;
    }
    if (file.size > MAX) {
      const mb = (file.size / (1024 * 1024)).toFixed(1);
      setImage(null);
      setFileName(file.name);
      setFileError(`${mb} MB — please pick one under 5 MB.`);
      return;
    }
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("read"));
      reader.readAsDataURL(file);
    });
    setImage({ name: file.name, type: file.type, data });
    setFileName(file.name);
    setFileError("");
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
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
    const message = draft.trim();
    if (!message) {
      toast("Describe what happened.");
      return;
    }
    if (fileError) {
      toast("Fix the screenshot size first, or clear it.");
      return;
    }
    setStatus("sending");
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          kind,
          name: String(data.get("name") || "").trim(),
          email: String(data.get("email") || "").trim(),
          message,
          image,
        }),
      });
      if (!res.ok) throw new Error("send failed");
      if (kind === "feature") await new Promise((r) => window.setTimeout(r, 1100));
      setStatus("sent");
      form.reset();
      setAnswer("");
      setChallenge(newChallenge());
      setImage(null);
      setFileName("");
      setFileError("");
      setDraft("");
    } catch {
      setStatus("error");
      toast("Could not send. Try again in a moment.");
    }
  }

  if (status === "sent") {
    return <p className="text-sm text-muted">Got it. Thank you for taking the time.</p>;
  }

  return (
    <form onSubmit={onSubmit} onKeyDown={onTypeKey} className="space-y-3 text-left">
      <p className="text-sm text-muted">Bug or idea. Screenshot optional.</p>
      {kind === "feature" ? (
        <TypewriterClerk text={draft} tapping={tapping} shredding={status === "sending"} />
      ) : null}
      <label className="block">
        <span className="text-xs text-subtle">This is a</span>
        <select
          name="kind"
          className="mt-1 h-11 w-full rounded-md border border-field-border bg-field px-3 text-sm text-fg"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
        >
          <option value="bug">Bug</option>
          <option value="feature">Feature request</option>
        </select>
      </label>
      <label className="block">
        <span className="text-xs text-subtle">
          {kind === "feature" ? "What'cha got?" : "What happened"}
        </span>
        <textarea
          name="message"
          required
          rows={4}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="mt-1 w-full rounded-md border border-field-border bg-field px-3 py-2 text-sm text-fg"
        />
      </label>
      <label className="block">
        <span className="text-xs text-subtle">Screenshot · optional · 5 MB max</span>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="mt-1 block w-full text-sm text-muted file:mr-3 file:rounded-md file:border file:border-border file:bg-raised file:px-3 file:py-1.5 file:text-sm file:text-fg"
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
        {fileError ? (
          <span className="mt-1 block text-xs text-danger">{fileError}</span>
        ) : fileName ? (
          <span className="mt-1 block text-xs text-subtle">{fileName} attached</span>
        ) : (
          <span className="mt-1 block text-xs text-subtle">PNG, JPG, WebP, or GIF.</span>
        )}
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs text-subtle">Name (optional)</span>
          <Input name="name" autoComplete="name" className="mt-1" />
        </label>
        <label className="block">
          <span className="text-xs text-subtle">Email if you want a reply</span>
          <Input name="email" type="email" autoComplete="email" className="mt-1" />
        </label>
      </div>
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
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <Button type="submit" size="sm" disabled={!canSend || Boolean(fileError) || status === "sending"}>
          {status === "sending" ? "Sending…" : "Send report"}
        </Button>
        {status === "error" ? <span className="text-xs text-danger">Didn’t go through.</span> : null}
      </div>
    </form>
  );
}
