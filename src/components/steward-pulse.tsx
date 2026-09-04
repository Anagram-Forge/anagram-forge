import type { DayRow } from "@/lib/stat-day";
import type { WayDay } from "@/lib/way-stats";

export type DoorNote = {
  id: string;
  title: string;
  rack: string;
  phrase: string;
};

function Card({ n, label }: { n: number; label: string }) {
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-3">
      <p className="font-display text-2xl tabular-nums text-fg">{n.toLocaleString()}</p>
      <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-subtle">{label}</p>
    </div>
  );
}

function Bars({ series }: { series: DayRow[] }) {
  const max = Math.max(1, ...series.map((d) => d.visits + d.anagrams + d.strikes));
  const h = 72;
  return (
    <div className="mt-6">
      <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-accent">Last 14 days</p>
      <p className="mt-1 text-[11px] text-subtle">Daily buckets start today. Older totals stay in the cards.</p>
      <div className="mt-3 flex items-end gap-1" style={{ height: h }}>
        {series.map((d) => {
          const sum = d.visits + d.anagrams + d.strikes;
          const col = (sum / max) * h;
          const part = (n: number) => (sum ? (n / sum) * col : 0);
          return (
            <div
              key={d.day}
              className="flex h-full min-w-0 flex-1 flex-col justify-end"
              title={`${d.day}: ${d.visits} visits · ${d.anagrams} forged · ${d.strikes} strikes`}
            >
              <div className="flex w-full flex-col justify-end overflow-hidden rounded-sm" style={{ height: Math.max(sum ? 3 : 0, col) }}>
                <div className="w-full bg-accent" style={{ height: part(d.strikes) }} />
                <div className="w-full bg-fg/55" style={{ height: part(d.anagrams) }} />
                <div className="w-full bg-muted/60" style={{ height: part(d.visits) }} />
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-subtle">
        <span>{series[0]?.day.slice(5)}</span>
        <span className="flex gap-3">
          <span>visits</span>
          <span className="text-fg/70">forged</span>
          <span className="text-accent">strikes</span>
        </span>
        <span>{series[series.length - 1]?.day.slice(5)}</span>
      </div>
    </div>
  );
}

export function StewardPulse({
  visits,
  anagrams,
  strikes,
  handles,
  finds,
  series,
}: {
  visits: number;
  anagrams: number;
  strikes: number;
  handles: number;
  finds: number;
  series: DayRow[];
}) {
  return (
    <div className="mt-8">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Card n={visits} label="visits" />
        <Card n={anagrams} label="forged" />
        <Card n={strikes} label="strikes" />
        <Card n={handles} label="handles" />
        <Card n={finds} label="finds" />
      </div>
      {series.length ? <Bars series={series} /> : null}
    </div>
  );
}

export function TheWayPulse({
  visits,
  series,
  doors,
  onOpen,
}: {
  visits: number;
  series: WayDay[];
  doors?: DoorNote[];
  onOpen?: () => void;
}) {
  const max = Math.max(1, ...series.map((d) => d.visits));
  const h = 56;
  return (
    <section className="mt-8">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-accent">The Way</p>
        {onOpen ? (
          <button
            type="button"
            onClick={onOpen}
            className="text-xs text-subtle underline decoration-border underline-offset-2 hover:text-muted"
          >
            Open The Way
          </button>
        ) : null}
      </div>
      <p className="mt-1 text-sm text-muted">Counted after the door is open. Direct paths stay 404.</p>
      <div className="mt-4 max-w-xs">
        <Card n={visits} label="visits" />
      </div>
      {series.length ? (
        <div className="mt-6">
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-accent">Last 14 days</p>
          <div className="mt-3 flex items-end gap-1" style={{ height: h }}>
            {series.map((d) => {
              const col = (d.visits / max) * h;
              return (
                <div
                  key={d.day}
                  className="flex h-full min-w-0 flex-1 flex-col justify-end"
                  title={`${d.day}: ${d.visits}`}
                >
                  <div
                    className="w-full rounded-sm bg-accent/80"
                    style={{ height: d.visits ? Math.max(3, col) : 0 }}
                  />
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-subtle">
            <span>{series[0]?.day.slice(5)}</span>
            <span>{series[series.length - 1]?.day.slice(5)}</span>
          </div>
        </div>
      ) : null}
      {doors && doors.length ? (
        <ul className="mt-6 space-y-3">
          {doors.map((d) => (
            <li key={d.id}>
              <p className="text-sm text-fg">{d.title}</p>
              <p className="mt-0.5 font-mono text-xs text-muted">
                {d.rack} → {d.phrase}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
