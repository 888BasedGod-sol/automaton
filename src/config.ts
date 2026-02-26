/**
 * Automagotchi Configuration
 *
 * Loads and saves the automagotchi's configuration from ~/.automagotchi/automagotchi.json
 * or from a custom directory via --agent-dir argument.
 */

import fs from "fs";
import path from "path";
import type { AutomagotchiConfig } from "./types.js";
import type { Address } from "viem";
import { DEFAULT_CONFIG } from "./types.js";
import { getAutomagotchiDir } from "./identity/wallet.js";
import { loadApiKeyFromConfig } from "./identity/provision.js";

const CONFIG_FILENAME = "automagotchi.json";

// Allow overriding the config directory via --agent-dir argument
let customAgentDir: string | null = null;

export function setAgentDir(dir: string): void {
  customAgentDir = dir;
}

export function getAgentDir(): string {
  return customAgentDir || getAutomagotchiDir();
}

export function getConfigPath(): string {
  return path.join(getAgentDir(), CONFIG_FILENAME);
}

/**
 * Load the automagotchi config from disk.
 * Merges with defaults for any missing fields.
 */
export function loadConfig(): AutomagotchiConfig | null {
  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) {
    return null;
  }

  try {
    const raw = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    const apiKey = raw.conwayApiKey || loadApiKeyFromConfig();

    return {
      ...DEFAULT_CONFIG,
      ...raw,
      conwayApiKey: apiKey,
    } as AutomagotchiConfig;
  } catch {
    return null;
  }
}

/**
 * Save the automagotchi config to disk.
 */
export function saveConfig(config: AutomagotchiConfig): void {
  const dir = getAutomagotchiDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }

  const configPath = getConfigPath();
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), {
    mode: 0o600,
  });
}

/**
 * Resolve ~ paths to absolute paths.
 */
export function resolvePath(p: string): string {
  if (p.startsWith("~")) {
    return path.join(process.env.HOME || "/root", p.slice(1));
  }
  return p;
}

/**
 * Create a fresh config from setup wizard inputs.
 */
export function createConfig(params: {
  name: string;
  genesisPrompt: string;
  creatorMessage?: string;
  creatorAddress: Address;
  registeredWithConway: boolean;
  sandboxId: string;
  walletAddress: Address;
  apiKey: string;
  parentAddress?: Address;
}): AutomagotchiConfig {
  return {
    name: params.name,
    genesisPrompt: params.genesisPrompt,
    creatorMessage: params.creatorMessage,
    creatorAddress: params.creatorAddress,
    registeredWithConway: params.registeredWithConway,
    sandboxId: params.sandboxId,
    conwayApiUrl:
      DEFAULT_CONFIG.conwayApiUrl || "https://api.conway.tech",
    conwayApiKey: params.apiKey,
    inferenceModel: DEFAULT_CONFIG.inferenceModel || "gpt-4o",
    maxTokensPerTurn: DEFAULT_CONFIG.maxTokensPerTurn || 4096,
    heartbeatConfigPath:
      DEFAULT_CONFIG.heartbeatConfigPath || "~/.automagotchi/heartbeat.yml",
    dbPath: DEFAULT_CONFIG.dbPath || "~/.automagotchi/state.db",
    logLevel: (DEFAULT_CONFIG.logLevel as AutomagotchiConfig["logLevel"]) || "info",
    walletAddress: params.walletAddress,
    version: DEFAULT_CONFIG.version || "0.1.0",
    skillsDir: DEFAULT_CONFIG.skillsDir || "~/.automagotchi/skills",
    maxChildren: DEFAULT_CONFIG.maxChildren || 3,
    parentAddress: params.parentAddress,
  };
}
