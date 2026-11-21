import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, ReactNode, RefObject } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CipherRenderActions } from "@/components/cipher-render-actions";
import { FromEnglish } from "@/components/from-english";
import { CIPHER_MAX_LETTERS, type CipherSettings } from "@/lib/featured-png";
import {
  FONTS,
  LIGHTS,
  MATS,
  parse,
  renderCipherFrame,
  type CipherHandle,
  type CipherProps,
  type ViewState,
  type FontKey,
  type LightKey,
  type MatKey,
  type Mode,
  type V3,
} from "@/lib/cipher-engine";
import { cn } from "@/lib/utils";

/**
 * 3D Hebrew Cipher (behind the door at /the-way). Ported from REM's canvas page.
 * Renderer and math are unchanged; only the UI kit was swapped for the site's own.
 * Plain canvas 2D, no network, no fonts fetched. System serif / the site sans stack.
 */

function CipherView(props: ViewProps & { handleRef?: RefObject<CipherHandle | null> }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const outer = props.handleRef;
  const live = useRef(props);
  live.current = props;
  const view = useRef<ViewState>({ yaw: 0.6, pitch: 0.35, drag: false, lx: 0, ly: 0, t: 0 });
  const trails = useRef<{ key: string; pts: V3[][] }>({ key: "", pts: [] });

  useEffect(() => {
    view.current.yaw = 0.6;
    view.current.pitch = 0.35;
    view.current.t = 0;
  }, [props.resetKey]);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    if (outer) outer.current = { canvas: cv, props: () => live.current, view: () => ({ ...view.current }) };
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const p = live.current;
      const v = view.current;
      renderCipherFrame(ctx, cv, p, v, trails.current, dt);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [outer]);

  const down = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (live.current.locked) return;
    const v = view.current;
    v.drag = true;
    v.lx = e.clientX;
    v.ly = e.clientY;
    e.currentTarget.setPointerCapture(e.nativeEvent.pointerId);
  };
  const move = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const v = view.current;
    if (!v.drag) return;
    v.yaw += (e.clientX - v.lx) * 0.01;
    v.pitch = Math.max(-1.55, Math.min(1.55, v.pitch + (e.clientY - v.ly) * 0.01));
    v.lx = e.clientX;
    v.ly = e.clientY;
  };
  const up = () => {
    view.current.drag = false;
  };

  return (
    <canvas
      ref={ref}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      role="img"
      aria-label={`3D cipher of ${props.letters.map((l) => l.ch).join("")}. Drag to rotate.`}
      className="block h-[420px] w-full rounded-lg border border-border sm:h-[520px]"
      style={{ touchAction: "none", cursor: props.locked ? "default" : "grab" }}
    />
  );
}

type ViewProps = CipherProps;

/* ---------- site-styled controls (replace the grok/canvas kit) ---------- */

const labelText = "text-xs uppercase tracking-wide text-subtle";

function Section({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-xl text-fg sm:text-2xl">{heading}</h2>
      <div className="mt-4 space-y-5">{children}</div>
    </section>
  );
}

function Row({ cols, children }: { cols: 2 | 3 | 4; children: ReactNode }) {
  const c =
    cols === 2 ? "sm:grid-cols-2" : cols === 3 ? "sm:grid-cols-3" : "grid-cols-2 sm:grid-cols-4";
  return <div className={cn("grid gap-4", c)}>{children}</div>;
}

function Slider(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (v: number) => void;
  disabled?: boolean;
  big?: boolean;
}) {
  const id = useId();
  return (
    <div className={cn("flex flex-col gap-2", props.disabled && "opacity-45")}>
      <label htmlFor={id} className="flex flex-wrap justify-between gap-2 text-sm text-muted">
        <span className={props.big ? "text-fg" : undefined}>{props.label}</span>
        <span className="font-mono text-fg">
          {props.value}
          {props.unit || ""}
        </span>
      </label>
      <input
        id={id}
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        disabled={props.disabled}
        onChange={(e) => props.onChange(Number(e.target.value))}
        className={cn("w-full accent-[var(--color-gold)]", props.big ? "h-8" : "h-6")}
      />
    </div>
  );
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className="flex min-h-11 items-center gap-3 rounded-md border border-border bg-surface px-3 text-left text-sm text-fg hover:bg-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      <span
        aria-hidden
        className={cn(
          "relative inline-block h-5 w-9 shrink-0 rounded-full border transition-colors",
          value ? "border-accent bg-accent-dim" : "border-field-border bg-field",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-3.5 rounded-full transition-[left]",
            value ? "left-[18px] bg-accent" : "left-0.5 bg-subtle",
          )}
        />
      </span>
      <span>{label}</span>
    </button>
  );
}

function Picker<T extends string>(props: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className={labelText}>
        {props.label}
      </label>
      <select
        id={id}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value as T)}
        className="h-11 w-full rounded-md border border-field-border bg-field px-3 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
      >
        {props.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function Segmented<T extends string>(props: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <span className={labelText} id={id}>
        {props.label}
      </span>
      <div role="radiogroup" aria-labelledby={id} className="flex flex-wrap gap-1.5">
        {props.options.map((o) => {
          const on = o.value === props.value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => props.onChange(o.value)}
              className={cn(
                "h-10 rounded-md border px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                on
                  ? "border-accent bg-accent-dim text-fg"
                  : "border-border bg-surface text-muted hover:bg-raised hover:text-fg",
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- page ---------- */

function prefersLessMotion() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function WayCipher() {
  const [calm] = useState(prefersLessMotion);
  const [text, setText] = useState("נפלים");
  const [mode, setMode] = useState<Mode>("fold");
  const [fold, setFold] = useState(0.8);
  const [gap, setGap] = useState(0.14);
  const [evolve, setEvolve] = useState(true);
  const [spin, setSpin] = useState(true);
  const [finals, setFinals] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [spinSpeed, setSpinSpeed] = useState(1);
  const [evolveSpeed, setEvolveSpeed] = useState(1);
  // Reduced motion: start frozen; the visitor raises Movement speed to start it.
  const [speed, setSpeed] = useState(calm ? 0 : 1);
  const [locked, setLocked] = useState(false);
  const [lockYaw, setLockYaw] = useState(0);
  const [lockPitch, setLockPitch] = useState(0);
  const [trail, setTrail] = useState(false);
  const [material, setMaterial] = useState<MatKey>("diamond");
  const [lighting, setLighting] = useState<LightKey>("golden");
  const [sharp, setSharp] = useState(0.8);
  const [colorByLetter, setColorByLetter] = useState(false);
  const [layers, setLayers] = useState(17);
  const [font, setFont] = useState<FontKey>("serif");
  const snap = (yaw: number, pitch: number) => {
    setLocked(true);
    setLockYaw(yaw);
    setLockPitch(pitch);
  };
  const letters = useMemo(() => parse(text, finals), [text, finals]);
  const total = letters.reduce((s, l) => s + l.value, 0);
  const matOptions = (Object.keys(MATS) as MatKey[]).map((k) => ({
    value: k,
    label: MATS[k].label,
  }));
  const lightOptions = (Object.keys(LIGHTS) as LightKey[]).map((k) => ({
    value: k,
    label: LIGHTS[k].label,
  }));
  const fontOptions = (Object.keys(FONTS) as FontKey[]).map((k) => ({ value: k, label: FONTS[k] }));
  const inputId = useId();
  const handle = useRef<CipherHandle | null>(null);
  const getSettings = (): CipherSettings | null => {
    const h = handle.current;
    if (!h) return null;
    const p = h.props();
    const v = h.view();
    let kept = 0;
    const clean = [...text.replace(/\s+/g, " ")]
      .filter((c) => {
        if (c === " ") return true;
        if (!/[\u05D0-\u05EAA-Za-z]/.test(c)) return false;
        kept += 1;
        return kept <= CIPHER_MAX_LETTERS;
      })
      .join("")
      .trim();
    return {
      v: 1,
      text: clean,
      finals,
      mode,
      material,
      lighting,
      font,
      fold,
      gap,
      sharp,
      layers,
      colorByLetter,
      evolve,
      spin,
      spinSpeed: p.spinSpeed,
      evolveSpeed: p.evolveSpeed,
      locked,
      lockYaw,
      lockPitch,
      yaw: v.yaw,
      pitch: v.pitch,
      t: v.t,
    };
  };

  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-accent">The Way</p>
      <h1 className="mt-2 font-display text-4xl text-fg sm:text-5xl">3D Hebrew Cipher</h1>
      <p className="mt-3 max-w-xl text-base text-muted">
        Type a Hebrew word and its letters fold, stack, or arrange into a 3D shape set by their
        number values and the golden angle. Drag to rotate.
      </p>

      <Section heading="Your word">
        <Row cols={2}>
          <div className="flex flex-col gap-2">
            <label htmlFor={inputId} className={labelText}>
              Hebrew (or English) text
            </label>
            <Input
              id={inputId}
              dir="auto"
              lang="he"
              autoComplete="off"
              spellCheck={false}
              value={text}
              placeholder="נפלים"
              onChange={(e) => setText(e.target.value)}
              className="text-lg"
            />
          </div>
          <FromEnglish onUse={setText} />
        </Row>
        <Row cols={2}>
          <Segmented<Mode>
            label="Shape"
            options={[
              { value: "fold", label: "Protein fold" },
              { value: "stacked", label: "Stacked" },
              { value: "spiral", label: "Spiral" },
              { value: "sphere", label: "Sphere" },
              { value: "helix", label: "Helix" },
            ]}
            value={mode}
            onChange={setMode}
          />
        </Row>
        <Row cols={4}>
          <Toggle label="Evolve over time" value={evolve} onChange={setEvolve} />
          <Toggle label="Auto spin" value={spin} onChange={setSpin} />
          <Toggle label="Final letters 500–900" value={finals} onChange={setFinals} />
          <Button variant="secondary" onClick={() => setResetKey((k) => k + 1)}>
            Reset view
          </Button>
        </Row>
      </Section>

      {letters.length > 0 ? (
        <Section heading={`Cipher shape · total value ${total}`}>
          <CipherView
            letters={letters}
            mode={mode}
            evolve={evolve}
            spin={spin}
            resetKey={resetKey}
            spinSpeed={spinSpeed * speed}
            evolveSpeed={evolveSpeed * speed}
            locked={locked}
            lockYaw={lockYaw}
            lockPitch={lockPitch}
            trail={trail}
            fold={fold}
            gap={gap}
            material={material}
            lighting={lighting}
            sharp={sharp}
            colorByLetter={colorByLetter}
            layers={layers}
            font={font}
            handleRef={handle}
          />
          <CipherRenderActions handle={handle} getSettings={getSettings} />
          <Slider
            big
            label="Movement speed (0 freezes everything)"
            value={speed}
            min={0}
            max={5}
            step={0.05}
            unit="×"
            onChange={setSpeed}
          />
          {calm && speed === 0 ? (
            <p className="text-sm text-subtle">
              Held still because your device asks for less motion. Slide Movement speed up to start
              it.
            </p>
          ) : null}
          <Row cols={2}>
            <Toggle label="Evolve over time" value={evolve} onChange={setEvolve} />
            <Toggle label="Auto spin" value={spin} onChange={setSpin} />
          </Row>
        </Section>
      ) : (
        <p className="mt-8 text-sm text-subtle">No Hebrew or English letters in that text yet.</p>
      )}

      <Section heading="Material and light">
        <Row cols={3}>
          <Picker<MatKey>
            label="Letter material"
            options={matOptions}
            value={material}
            onChange={setMaterial}
          />
          <Picker<LightKey>
            label="Lighting"
            options={lightOptions}
            value={lighting}
            onChange={setLighting}
          />
          <Picker<FontKey>
            label="Letter style"
            options={fontOptions}
            value={font}
            onChange={setFont}
          />
        </Row>
        <Row cols={3}>
          <Slider
            label="Edge sharpness"
            value={sharp}
            min={0}
            max={1}
            step={0.01}
            onChange={setSharp}
          />
          <Slider
            label="Depth slices per letter"
            value={layers}
            min={1}
            max={40}
            step={1}
            onChange={setLayers}
          />
          <Toggle
            label="Tint each letter by its value"
            value={colorByLetter}
            onChange={setColorByLetter}
          />
        </Row>
      </Section>

      {mode === "stacked" || mode === "fold" ? (
        <Section heading={mode === "fold" ? "Fold" : "Stack and fold"}>
          <Row cols={2}>
            <Slider
              label="Fold (how much each letter bends the chain)"
              value={fold}
              min={0}
              max={2}
              step={0.01}
              unit="×"
              onChange={setFold}
            />
            <Slider
              label="Spacing between letters"
              value={gap}
              min={0.02}
              max={0.4}
              step={0.01}
              onChange={setGap}
            />
          </Row>
        </Section>
      ) : null}

      <Section heading="Speed and angle">
        <Row cols={2}>
          <Slider
            label="Spin speed (negative spins backward)"
            value={spinSpeed}
            min={-3}
            max={3}
            step={0.05}
            unit="×"
            onChange={setSpinSpeed}
            disabled={locked}
          />
          <Slider
            label="Evolve speed"
            value={evolveSpeed}
            min={0}
            max={5}
            step={0.05}
            unit="×"
            onChange={setEvolveSpeed}
          />
        </Row>
        <Row cols={3}>
          <Toggle label="Lock the angle" value={locked} onChange={setLocked} />
          <Toggle label="Draw motion trails" value={trail} onChange={setTrail} />
          <Button variant="secondary" onClick={() => setResetKey((k) => k + 1)}>
            Clear trails
          </Button>
        </Row>
        <Row cols={2}>
          <Slider
            label="Turn (left / right)"
            value={lockYaw}
            min={-180}
            max={180}
            step={1}
            unit="°"
            onChange={(v) => {
              setLocked(true);
              setLockYaw(v);
            }}
          />
          <Slider
            label="Tilt (up / down)"
            value={lockPitch}
            min={-90}
            max={90}
            step={1}
            unit="°"
            onChange={(v) => {
              setLocked(true);
              setLockPitch(v);
            }}
          />
        </Row>
        <Row cols={4}>
          <Button variant="secondary" onClick={() => snap(0, 0)}>
            Front
          </Button>
          <Button variant="secondary" onClick={() => snap(90, 0)}>
            Side
          </Button>
          <Button variant="secondary" onClick={() => snap(0, 90)}>
            Top down
          </Button>
          <Button variant="secondary" onClick={() => snap(45, 35)}>
            Corner
          </Button>
        </Row>
      </Section>

      {letters.length > 0 ? (
        <Section heading="Letters and values">
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface text-xs uppercase tracking-wide text-subtle">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">
                    #
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Letter
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Name
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Value
                  </th>
                </tr>
              </thead>
              <tbody>
                {letters.map((l, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-3 py-2 font-mono text-subtle">{i + 1}</td>
                    <td
                      className="px-3 py-2 font-serif text-xl text-fg"
                      lang={l.name.startsWith("Latin") ? "en" : "he"}
                    >
                      {l.ch}
                    </td>
                    <td className="px-3 py-2 text-muted">{l.name}</td>
                    <td className="px-3 py-2 text-right font-mono text-fg">{l.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      ) : null}

      <Section heading="How the shape is computed">
        <div className="max-w-2xl space-y-3 text-sm leading-relaxed text-muted">
          <p>
            Each letter is drawn as a real, smooth letter shape and given depth by stacking thin
            copies of it, like the slices of a stacked sprite. The depth slices slider sets how
            many, 17 by default.
          </p>
          <p>
            Protein fold treats the word like a chain of amino acids. Each letter is one link,
            standing crosswise to the chain. At every link the chain bends by an amount set by that
            letter&apos;s value, then twists by its value times the golden angle. The twists add up
            along the chain, so the word folds into a shape that belongs to it alone. With Evolve
            on, the chain slowly unfolds into a straight column and folds back up.
          </p>
          <p>
            In Stacked mode the letters lie flat and pile up, each turning by its value times the
            golden angle on top of the turns below it. Spiral, Sphere and Helix float the letters
            apart, with each letter&apos;s value setting how high or how far out it sits.
          </p>
          <p>
            Glass and gems are see-through with crisp bright rims, and light bands sweep across
            their faces as they turn. Diamond splits those bands into rainbow colors, gold reflects
            in its own color, and the lighting sets the sky and the color of the light.
          </p>
        </div>
      </Section>
    </div>
  );
}

export default WayCipher;
