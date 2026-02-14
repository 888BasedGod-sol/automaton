/**
 * Heartbeat Configuration
 *
 * Parses and manages heartbeat.yml configuration.
 */

import fs from "fs";
import path from "path";
import YAML from "yaml";
import type { HeartbeatEntry, HeartbeatConfig, AutomatonDatabase } from "../types.js";
import { getAutomatonDir } from "../identity/wallet.js";

const DEFAULT_HEARTBEAT_CONFIG: HeartbeatConfig = {
  entries: [
    {
      name: "heartbeat_ping",
      schedule: "*/15 * * * *",
      task: "heartbeat_ping",
      enabled: true,
    },
    {
      name: "check_credits",
      schedule: "0 */6 * * *",
      task: "check_credits",
      enabled: true,
    },
    {
      name: "check_usdc_balance",
      schedule: "0 */12 * * *",
      task: "check_usdc_balance",
      enabled: true,
    },
    {
      name: "health_check",
      schedule: "*/30 * * * *",
      task: "health_check",
      enabled: true,
    },
    {
      name: "check_social_inbox",
      schedule: "*/2 * * * *",
      task: "check_social_inbox",
      enabled: true,
    },
  ],
  defaultIntervalMs: 60_000,
  lowComputeMultiplier: 4,
};

/**
 * Load heartbeat config from YAML file, falling back to defaults.
 */
export function loadHeartbeatConfig(configPath?: string): HeartbeatConfig {
  const filePath =
    configPath || path.join(getAutomatonDir(), "heartbeat.yml");

  if (!fs.existsSync(filePath)) {
    return DEFAULT_HEARTBEAT_CONFIG;
  }

  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = YAML.parse(raw);

    return {
      entries: (parsed.entries || []).map((e: any) => ({
        name: e.name,
        schedule: e.schedule,
        task: e.task,
        enabled: e.enabled !== false,
        params: e.params,
      })),
      defaultIntervalMs:
        parsed.defaultIntervalMs || DEFAULT_HEARTBEAT_CONFIG.defaultIntervalMs,
      lowComputeMultiplier:
        parsed.lowComputeMultiplier ||
        DEFAULT_HEARTBEAT_CONFIG.lowComputeMultiplier,
    };
  } catch {
    return DEFAULT_HEARTBEAT_CONFIG;
  }
}

/**
 * Save heartbeat config to YAML file.
 */
export function saveHeartbeatConfig(
  config: HeartbeatConfig,
  configPath?: string,
): void {
  const filePath =
    configPath || path.join(getAutomatonDir(), "heartbeat.yml");
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }

  fs.writeFileSync(filePath, YAML.stringify(config), { mode: 0o600 });
}

/**
 * Write the default heartbeat.yml file.
 */
export function writeDefaultHeartbeatConfig(configPath?: string): void {
  saveHeartbeatConfig(DEFAULT_HEARTBEAT_CONFIG, configPath);
}

/**
 * Sync heartbeat entries from YAML config into the database.
 */
export function syncHeartbeatToDb(
  config: HeartbeatConfig,
  db: AutomatonDatabase,
): void {
  for (const entry of config.entries) {
    db.upsertHeartbeatEntry(entry);
  }
}
