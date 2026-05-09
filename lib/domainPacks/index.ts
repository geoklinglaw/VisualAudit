import { fashionPack } from "./fashion";
import type { DomainPack } from "./types";

export const builtInPacks: DomainPack[] = [fashionPack];

export function findBuiltInPack(id: string): DomainPack | undefined {
  return builtInPacks.find((p) => p.id === id);
}

export { fashionPack };
export type { DomainPack };
