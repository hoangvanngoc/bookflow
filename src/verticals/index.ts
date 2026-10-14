import type { Vertical } from "./types";
import spa from "./spa.json";
import clinic from "./clinic.json";
import salon from "./salon.json";

export const verticals: Vertical[] = [spa, clinic, salon];

export function getVertical(id: string | null | undefined): Vertical {
  return verticals.find((v) => v.id === id) ?? verticals[0];
}

export type { Vertical, Service, OpeningHours } from "./types";
