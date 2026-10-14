"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getVertical, type Vertical } from "@/verticals";

const KEY = "bookflow.vertical.v1";

type Ctx = { vertical: Vertical; setVerticalId: (id: string) => void };
const VerticalContext = createContext<Ctx | null>(null);

/** Which deployment the visitor is looking at. One build, three "customers". */
export function VerticalProvider({ children }: { children: ReactNode }) {
  const [vertical, setVertical] = useState<Vertical>(getVertical(null));

  useEffect(() => {
    try {
      setVertical(getVertical(window.localStorage.getItem(KEY)));
    } catch {}
  }, []);

  const setVerticalId = (id: string) => {
    setVertical(getVertical(id));
    try {
      window.localStorage.setItem(KEY, id);
    } catch {}
  };

  return (
    <VerticalContext.Provider value={{ vertical, setVerticalId }}>
      <div style={{ ["--accent" as string]: vertical.accent }}>{children}</div>
    </VerticalContext.Provider>
  );
}

export function useVertical(): Ctx {
  const ctx = useContext(VerticalContext);
  if (!ctx) throw new Error("useVertical must be used inside VerticalProvider");
  return ctx;
}
