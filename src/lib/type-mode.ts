import { useEffect, useState } from "react";

const KEY = "af-type";
export type TypeMode = "default" | "easy";

function read(): TypeMode {
  if (typeof window === "undefined") return "default";
  return window.localStorage.getItem(KEY) === "easy" ? "easy" : "default";
}

export function useTypeMode() {
  const [mode, setMode] = useState<TypeMode>(read);

  useEffect(() => {
    document.documentElement.classList.toggle("easy-read", mode === "easy");
    try {
      window.localStorage.setItem(KEY, mode);
    } catch {
      /* private mode */
    }
  }, [mode]);

  return {
    easy: mode === "easy",
    toggle: () => setMode((m) => (m === "easy" ? "default" : "easy")),
  };
}
