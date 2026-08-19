import { useMemo, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
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
  const [fileName, setFileName] = useState("");
  const [image, setImage] = useState<{ name: string; type: string; data: string } | null>(null);

  const canSend = useMemo(() => Number(answer) === challenge.sum, [answer, challenge.sum]);

  async function onFile(file: File | undefined) {
    if (!file) {
      setImage(null);
      setFileName("");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast("Please drop an image (png, jpg, webp).");
      return;
    }
    if (file.size > MAX) {
      toast("Keep screenshots under 5 MB.");
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
    const message = String(data.get("message") || "").trim();
    if (!message) {
      toast("Describe what happened.");
      return;
    }
    setStatus("sending");
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          kind: String(data.get("kind") || "bug"),
          name: String(data.get("name") || "").trim(),
          email: String(data.get("email") || "").trim(),
          message,
          image,
        }),
      });
      if (!res.ok) throw new Error("send failed");
      setStatus("sent");
      form.reset();
      setAnswer("");
      setChallenge(newChallenge());
      setImage(null);
      setFileName("");
    } catch {
      setStatus("error");
      toast("Could not send. Try again in a moment.");
    }
  }

  if (status === "sent") {
    return <p className="text-sm text-muted">Got it. Thank you for taking the time.</p>;
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 text-left">
      <p className="text-sm text-muted">Bug or idea. Screenshot optional.</p>
      <label className="block">
        <span className="text-xs text-subtle">This is a</span>
        <select
          name="kind"
          className="mt-1 h-11 w-full rounded-md border border-border bg-raised px-3 text-sm text-fg"
          defaultValue="bug"
        >
          <option value="bug">Bug</option>
          <option value="feature">Feature request</option>
        </select>
      </label>
      <label className="block">
        <span className="text-xs text-subtle">What happened</span>
        <textarea
          name="message"
          required
          rows={4}
          className="mt-1 w-full rounded-md border border-border bg-raised px-3 py-2 text-sm text-fg"
        />
      </label>
      <label className="block">
        <span className="text-xs text-subtle">Screenshot</span>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="mt-1 block w-full text-sm text-muted file:mr-3 file:rounded-md file:border file:border-border file:bg-raised file:px-3 file:py-1.5 file:text-sm file:text-fg"
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
        {fileName ? <span className="mt-1 block text-xs text-subtle">{fileName}</span> : null}
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
        <Button type="submit" size="sm" disabled={!canSend || status === "sending"}>
          {status === "sending" ? "Sending…" : "Send report"}
        </Button>
        {status === "error" ? <span className="text-xs text-danger">Didn’t go through.</span> : null}
      </div>
    </form>
  );
}
