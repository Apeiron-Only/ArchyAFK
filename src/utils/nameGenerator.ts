import { compactParts, nameNouns, namePrefixes } from "./nameParts";

export interface GeneratedName {
  value: string;
  duplicate: boolean;
}

interface GenerateOptions {
  count: number;
  existing: string[];
}

export function generateUsernames({ count, existing }: GenerateOptions): GeneratedName[] {
  const safeCount = Math.max(1, Math.min(1000, count));
  const existingSet = new Set(existing.map((name) => name.toLowerCase()));
  const generated = new Set<string>();
  const result: GeneratedName[] = [];
  let guard = 0;

  while (result.length < safeCount && guard < safeCount * 80) {
    guard += 1;
    const value = candidateName();
    const key = value.toLowerCase();
    if (generated.has(key)) {
      continue;
    }
    generated.add(key);
    result.push({
      value,
      duplicate: existingSet.has(key)
    });
  }

  return result;
}

export function isMinecraftUsername(value: string): boolean {
  return /^[A-Za-z0-9_]{3,16}$/.test(value);
}

function candidateName(): string {
  const mode = randomInt(0, 5);
  if (mode === 0) {
    return fitName(`${pick(namePrefixes)}${pick(compactParts)}`);
  }
  if (mode === 1) {
    return fitName(`${pick(compactParts)}${pick(nameNouns)}`);
  }
  return fitName(`${pick(namePrefixes)}${pick(nameNouns)}`);
}

function fitName(value: string): string {
  const cleaned = value.replace(/[^A-Za-z0-9_]/g, "");
  if (isMinecraftUsername(cleaned)) {
    return cleaned;
  }
  if (cleaned.length > 16) {
    const trimmed = cleaned.slice(0, 16);
    return trimmed.length >= 3 ? trimmed : "StoneWolf";
  }
  return `${cleaned}001`.slice(0, 16);
}

function pick<const T extends readonly [string, ...string[]]>(items: T): T[number] {
  return items[randomInt(0, items.length - 1)] ?? items[0];
}

function randomInt(min: number, max: number): number {
  const range = max - min + 1;
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return min + ((array[0] ?? 0) % range);
}
