import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Tip({
  label,
  side = "bottom",
  hideOnSm,
  children,
}: {
  label: string;
  side?: "top" | "bottom" | "left";
  hideOnSm?: boolean;
  children: ReactNode;
}) {
  return (
    <span className="group relative inline-flex">
      {children}
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute z-50 whitespace-nowrap rounded-sm border border-border bg-raised px-2 py-1 text-[11px] text-muted opacity-0 shadow-sm transition-opacity delay-100 group-hover:opacity-100 group-focus-within:opacity-100",
          side === "top" && "bottom-full left-1/2 mb-1.5 -translate-x-1/2",
          side === "bottom" && "top-full left-1/2 mt-1.5 -translate-x-1/2",
          side === "left" && "right-full top-1/2 mr-1.5 -translate-y-1/2",
          hideOnSm && "sm:hidden",
        )}
      >
        {label}
      </span>
    </span>
  );
}
