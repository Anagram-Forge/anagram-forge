import { useEffect, useState } from "react";

type Featured = { id: string; caption: string; w: number; h: number };

/** Home page card for the render the steward picked. Shows nothing when none is picked. */
export function FeaturedCard() {
  const [f, setF] = useState<Featured | null>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/forge/featured")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { featured?: Featured | null } | null) => {
        if (live && d?.featured) setF(d.featured);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  if (!f) return null;
  return (
    <section className="mx-auto mt-12 max-w-2xl" aria-label="Featured render">
      <figure className="overflow-hidden rounded-xl border border-border/80 bg-surface/50">
        <img
          src={`/api/forge/featured-image?id=${encodeURIComponent(f.id)}`}
          alt={`Featured render: ${f.caption}`}
          width={f.w || undefined}
          height={f.h || undefined}
          loading="lazy"
          decoding="async"
          className="block h-auto w-full"
        />
        <figcaption className="px-4 py-3 text-sm text-muted sm:px-6">{f.caption}</figcaption>
      </figure>
    </section>
  );
}
