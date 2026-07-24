const prefixes = [
  "Shadow",
  "Craft",
  "PvP",
  "Stone",
  "Night",
  "Pixel",
  "Silent",
  "Frost",
  "Blaze",
  "Ender",
  "Nova",
  "Iron",
  "Quartz",
  "Sky",
  "Void",
  "Rapid",
  "Prime",
  "Obsidian",
  "Lunar",
  "Storm",
  "Arc",
  "Mine",
  "Block",
  "Rune",
  "Apex",
  "Core",
  "Blue",
  "Red",
  "Silver",
  "Wolf"
] as const;

const suffixes = [
  "Knight",
  "Master",
  "Pro",
  "Miner",
  "Forge",
  "Wolf",
  "Runner",
  "Builder",
  "Ranger",
  "Scout",
  "Pixel",
  "Craft",
  "Strider",
  "Guard",
  "Blade",
  "Spark",
  "Pulse",
  "Vault",
  "Beacon",
  "Drift",
  "Pick",
  "Stone",
  "Fox",
  "Hawk",
  "Mage",
  "Smith",
  "Block",
  "Torch",
  "Nexus",
  "Core"
] as const;

const patterns = [
  (prefix: string, suffix: string, number: number) => `${prefix}${suffix}${number}`,
  (prefix: string, suffix: string) => `${prefix}${suffix}_`,
  (prefix: string, suffix: string, number: number) => `${prefix}_${suffix}_${number}`,
  (prefix: string, suffix: string) => `${prefix}${suffix}`,
  (prefix: string, suffix: string, number: number) => `${prefix}${number}_${suffix}`
] as const;

export function generateBotUsernames(count: number, existing: string[]): string[] {
  const maxCount = Math.max(1, Math.min(1000, count));
  const used = new Set(existing.map((name) => name.toLowerCase()));
  const generated: string[] = [];
  let attempts = 0;

  while (generated.length < maxCount && attempts < maxCount * 80) {
    attempts += 1;
    const prefix = pick(prefixes);
    const suffix = pick(suffixes);
    const number = randomInt(2, 99);
    const pattern = pick(patterns);
    const candidate = normalizeUsername(pattern(prefix, suffix, number));
    const key = candidate.toLowerCase();

    if (candidate.length >= 3 && !used.has(key)) {
      used.add(key);
      generated.push(candidate);
    }
  }

  return generated;
}

export function normalizeUsername(value: string): string {
  return value.replace(/[^A-Za-z0-9_]/g, "").slice(0, 16);
}

export function isValidMinecraftUsername(value: string): boolean {
  return /^[A-Za-z0-9_]{3,16}$/.test(value);
}

function pick<const T extends readonly [unknown, ...unknown[]]>(items: T): T[number] {
  return items[randomInt(0, items.length - 1)] ?? items[0];
}

function randomInt(min: number, max: number): number {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return min + ((values[0] ?? 0) % (max - min + 1));
}
