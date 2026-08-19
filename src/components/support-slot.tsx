import { useState } from "react";
import { BugForm } from "@/components/bug-form";
import { SponsorForm } from "@/components/sponsor-form";
import { SUPPORT } from "@/lib/support";

type Panel = null | "sponsor" | "bug";

export function SupportSlot() {
  const [open, setOpen] = useState<Panel>(null);
  if (!SUPPORT.enabled) return null;
  const ad = SUPPORT.ad;

  return (
    <aside className="mt-16 border-t border-border/70 pt-8 pb-10">
      <div className="mx-auto max-w-xl text-center">
        {open === null ? (
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => setOpen("sponsor")}
              className="mx-auto max-w-md text-pretty px-3 py-2 text-sm leading-relaxed text-subtle hover:text-muted"
            >
              {SUPPORT.prompt}
            </button>
            <button
              type="button"
              onClick={() => setOpen("bug")}
              className="px-3 py-1 text-xs text-subtle/80 hover:text-muted"
            >
              Report a bug or request a feature
            </button>
          </div>
        ) : (
          <div>
            <div className="rounded-md border border-dashed border-border bg-surface/60 px-5 py-6">
              {open === "sponsor" && ad ? (
                <a
                  href={ad.href}
                  target="_blank"
                  rel="noopener noreferrer sponsored"
                  className="block text-sm text-muted hover:text-fg"
                >
                  {ad.image ? (
                    <img src={ad.image} alt={ad.label} className="mx-auto max-h-24" />
                  ) : null}
                  <span className={ad.image ? "mt-2 block" : ""}>{ad.label}</span>
                </a>
              ) : open === "sponsor" ? (
                <SponsorForm />
              ) : (
                <BugForm />
              )}
            </div>
            <button
              type="button"
              onClick={() => setOpen(null)}
              className="mt-3 text-xs text-subtle hover:text-muted"
            >
              {SUPPORT.hide}
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
