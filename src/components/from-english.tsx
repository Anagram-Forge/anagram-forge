import { useId, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { englishToHebrew } from "@/lib/hebrew-from-english";

/** English → Hebrew letters, all in the browser. Feeds the cipher's main input. */
export function FromEnglish({ onUse }: { onUse: (hebrew: string) => void }) {
  const [text, setText] = useState("");
  const id = useId();
  const parts = useMemo(() => englishToHebrew(text), [text]);
  const hebrew = parts.map((p) => p.hebrew).join(" ");
  const translated = parts.filter((p) => p.kind === "translation");
  const sounded = parts.filter((p) => p.kind === "sound");

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-xs uppercase tracking-wide text-subtle">
        From English
      </label>
      <div className="flex gap-2">
        <Input
          id={id}
          lang="en"
          autoComplete="off"
          spellCheck={false}
          value={text}
          placeholder="light, Jesus, your name"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && hebrew) {
              e.preventDefault();
              onUse(hebrew);
            }
          }}
        />
        <Button variant="secondary" onClick={() => onUse(hebrew)} disabled={!hebrew}>
          Use this
        </Button>
      </div>
      <div aria-live="polite" className="min-h-6 text-sm text-muted">
        {parts.length ? (
          <>
            <p dir="rtl" lang="he" className="font-serif text-xl text-fg">
              {hebrew}
            </p>
            {translated.length ? (
              <p>
                Translation: {translated.map((p) => `${p.source} → ${p.hebrew}`).join(", ")}
              </p>
            ) : null}
            {sounded.length ? (
              <p>
                Sound-alike spelling, not a translation:{" "}
                {sounded.map((p) => `${p.source} → ${p.hebrew}`).join(", ")}
              </p>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
