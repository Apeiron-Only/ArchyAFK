import {
  ping,
  supportedVersions,
  type NewPingResult,
  type OldPingResult
} from "minecraft-protocol";
import { resolveSrv } from "node:dns/promises";

import type { ServerPingResult, ServerTarget } from "../src/shared/ipc";

export interface ResolvedServerTarget extends ServerTarget {
  displayHost: string;
}

interface ParsedAddress {
  host: string;
  port: number;
  portProvided: boolean;
  displayHost: string;
}

type PingResultRecord = Record<string, unknown>;

export function getSupportedMinecraftVersions(): string[] {
  return [...supportedVersions]
    .filter((version) => /^\d+\.\d+(\.\d+)?$/.test(version))
    .sort(compareMinecraftVersions);
}

export async function pingServer(target: ServerTarget): Promise<ServerPingResult> {
  const checkedAt = new Date().toISOString();
  const startedAt = performance.now();

  try {
    const resolvedTarget = await resolveServerTarget(target);
    const result = await pingWithFallback(resolvedTarget);
    const latency = Math.max(0, Math.round(performance.now() - startedAt));
    const record = result as unknown as PingResultRecord;

    if (isNewPingResult(result)) {
      return {
        online: true,
        host: resolvedTarget.displayHost,
        port: resolvedTarget.port,
        motd: cleanMinecraftText(textFromComponent(result.description)) || "MOTD yok",
        playersOnline: readOptionalNumber(result.players.online),
        playersMax: readOptionalNumber(result.players.max),
        versionName: result.version.name,
        protocol: result.version.protocol,
        favicon: result.favicon ?? null,
        latency: result.latency > 0 ? result.latency : latency,
        checkedAt,
        error: null
      };
    }

    return {
      online: true,
      host: resolvedTarget.displayHost,
      port: resolvedTarget.port,
      motd: cleanMinecraftText(readOptionalString(record.motd)) || "MOTD yok",
      playersOnline: readPlayerCount(record, "online"),
      playersMax: readPlayerCount(record, "max"),
      versionName: readOptionalString(record.version) || null,
      protocol: readOptionalNumber(record.protocol),
      favicon: null,
      latency,
      checkedAt,
      error: null
    };
  } catch (error) {
    const parsed = parseServerAddress(target.host, target.port);
    return {
      online: false,
      host: parsed.displayHost,
      port: parsed.port,
      motd: null,
      playersOnline: null,
      playersMax: null,
      versionName: null,
      protocol: null,
      favicon: null,
      latency: null,
      checkedAt,
      error: error instanceof Error ? error.message : "Sunucu sorgulanamadi"
    };
  }
}

export async function resolveServerTarget(target: ServerTarget): Promise<ResolvedServerTarget> {
  const parsed = parseServerAddress(target.host, target.port);
  const baseTarget: ResolvedServerTarget = {
    host: parsed.host,
    port: parsed.port,
    version: target.version,
    displayHost: parsed.displayHost
  };

  if (parsed.portProvided || isLikelyIpAddress(parsed.host) || parsed.host === "localhost") {
    return baseTarget;
  }

  try {
    const records = await resolveSrv(`_minecraft._tcp.${parsed.host}`);
    const record = records
      .filter((item) => item.name.length > 0 && item.port > 0)
      .sort((left, right) => left.priority - right.priority || right.weight - left.weight)[0];

    if (!record) {
      return baseTarget;
    }

    const host = record.name.endsWith(".") ? record.name.slice(0, -1) : record.name;
    return {
      ...baseTarget,
      host,
      port: record.port,
      displayHost: `${parsed.host} -> ${host}:${record.port}`
    };
  } catch {
    return baseTarget;
  }
}

async function pingWithFallback(
  target: ResolvedServerTarget
): Promise<NewPingResult | OldPingResult> {
  const baseOptions = {
    host: target.host,
    port: target.port,
    closeTimeout: 8_000,
    noPongTimeout: 8_000
  };

  try {
    return await ping({ ...baseOptions, version: target.version });
  } catch (firstError) {
    try {
      return await ping(baseOptions);
    } catch {
      throw firstError;
    }
  }
}

function parseServerAddress(hostInput: string, fallbackPort: number): ParsedAddress {
  const trimmed = hostInput.trim().replace(/^minecraft:\/\//i, "");
  const portMatch = /^([^:]+):(\d{1,5})$/.exec(trimmed);
  const host = (portMatch?.[1] ?? trimmed).trim();
  const parsedPort = portMatch ? Number.parseInt(portMatch[2] ?? "", 10) : fallbackPort;
  const port = Number.isFinite(parsedPort) ? Math.max(1, Math.min(65535, parsedPort)) : 25565;

  return {
    host,
    port,
    portProvided: Boolean(portMatch),
    displayHost: portMatch ? `${host}:${port}` : host
  };
}

function isLikelyIpAddress(value: string): boolean {
  return /^(localhost|\d{1,3}(?:\.\d{1,3}){3}|\[[0-9a-f:]+\]|[0-9a-f:]{2,})$/i.test(value);
}

function isNewPingResult(value: NewPingResult | OldPingResult): value is NewPingResult {
  return (
    "players" in value &&
    "description" in value &&
    "version" in value &&
    typeof value.version === "object"
  );
}

function textFromComponent(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(textFromComponent).join("");
  }

  if (isRecord(value)) {
    const ownText = typeof value.text === "string" ? value.text : "";
    const translated =
      ownText.length === 0 && typeof value.translate === "string" ? value.translate : "";
    const extra = textFromComponent(value.extra);
    return `${ownText}${translated}${extra}`;
  }

  return "";
}

function readOptionalString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function readOptionalNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    return Number.parseInt(value, 10);
  }
  return null;
}

function readPlayerCount(value: PingResultRecord, kind: "online" | "max"): number | null {
  if (kind === "online") {
    return (
      readOptionalNumber(value.playerCount) ??
      readOptionalNumber(value.onlinePlayers) ??
      readOptionalNumber(value.online) ??
      readNestedNumber(value, ["players", "online"])
    );
  }

  return (
    readOptionalNumber(value.maxPlayers) ??
    readOptionalNumber(value.max) ??
    readNestedNumber(value, ["players", "max"])
  );
}

function readNestedNumber(value: PingResultRecord, path: [string, string]): number | null {
  const parent = value[path[0]];
  if (!isRecord(parent)) {
    return null;
  }
  return readOptionalNumber(parent[path[1]]);
}

function cleanMinecraftText(value: string): string {
  return value
    .replace(/\u00A7[0-9A-FK-OR]/gi, "")
    .replace(/\u00C2/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function compareMinecraftVersions(left: string, right: string): number {
  const leftParts = left.split(".").map((part) => Number.parseInt(part, 10));
  const rightParts = right.split(".").map((part) => Number.parseInt(part, 10));
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const leftValue = leftParts[index] ?? 0;
    const rightValue = rightParts[index] ?? 0;
    if (leftValue !== rightValue) {
      return leftValue - rightValue;
    }
  }

  return 0;
}
