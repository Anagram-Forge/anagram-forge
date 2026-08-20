import { Anvil } from "lucide-react";

export function ForgeAnvil() {
  return (
    <span id="forge-anvil" className="inline-flex h-12 w-12 items-center justify-center text-accent" aria-hidden>
      <Anvil className="h-11 w-11" strokeWidth={1.6} absoluteStrokeWidth />
    </span>
  );
}
