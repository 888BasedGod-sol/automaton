/**
 * Automagotchi Dashboard API Server
 * 
 * Exposes a REST API for the web dashboard to connect to.
 * Runs alongside the main automagotchi runtime.
 */

import http from "http";
import type { AutomagotchiDatabase, AutomagotchiConfig, AutomagotchiIdentity } from "../types.js";
import { getSolanaWalletAddress } from "../identity/solana-wallet.js";
import { createSolanaClient } from "../solana/client.js";
import { getUsdcBalanceSolana } from "../solana/spl-tokens.js";

export interface ApiServerOptions {
  port: number;
  db: AutomagotchiDatabase;
  config: AutomagotchiConfig;
  identity: AutomagotchiIdentity;
  onWake?: () => void;
  onSleep?: () => void;
  onRestart?: () => void;
}

export function createApiServer(options: ApiServerOptions): http.Server {
  const { port, db, config, identity, onWake, onSleep, onRestart } = options;

  const server = http.createServer(async (req, res) => {
    // CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url || "/", `http://localhost:${port}`);
    const path = url.pathname;

    try {
      // GET /api/status
      if (req.method === "GET" && path === "/api/status") {
        const state = db.getAgentState();
        const turnCount = db.getTurnCount();
        const startTime = db.getKV("start_time");
        const financialState = JSON.parse(db.getKV("financial_state") || "{}");
        
        // Get Solana balance
        let solBalance = 0;
        let solanaUsdcBalance = 0;
        const solanaAddress = getSolanaWalletAddress();
        
        if (solanaAddress) {
          try {
            const solClient = createSolanaClient(config.solanaNetwork || "mainnet-beta");
            solBalance = await solClient.getBalance(solanaAddress);
            solanaUsdcBalance = await getUsdcBalanceSolana(solClient, solanaAddress);
          } catch {}
        }

        const status = {
          name: config.name,
          status: state,
          uptime: startTime ? formatUptime(new Date(startTime)) : "0s",
          credits: (financialState.creditsCents || 0) / 100,
          evmAddress: identity.address,
          solanaAddress: solanaAddress || undefined,
          usdcBalance: {
            evm: financialState.usdcBalance || 0,
            solana: solanaUsdcBalance,
          },
          solBalance,
          ethBalance: 0,
          genesisPrompt: config.genesisPrompt,
          turnsCompleted: turnCount,
          lastActivity: new Date().toISOString(),
          version: config.version,
          heartbeatInterval: 60,
          inferenceModel: config.inferenceModel,
        };

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(status));
        return;
      }

      // GET /api/logs
      if (req.method === "GET" && path === "/api/logs") {
        const limit = parseInt(url.searchParams.get("limit") || "100");
        const turns = db.getRecentTurns(limit);
        
        const logs = turns.flatMap((turn) => [
          {
            timestamp: turn.timestamp,
            level: "info" as const,
            message: `[TURN ${turn.id.slice(0, 8)}] State: ${turn.state}`,
            turnId: turn.id,
          },
          ...(turn.thinking ? [{
            timestamp: turn.timestamp,
            level: "info" as const,
            message: `[THINK] ${turn.thinking.slice(0, 200)}...`,
            turnId: turn.id,
          }] : []),
          ...turn.toolCalls.map((tc) => ({
            timestamp: turn.timestamp,
            level: (tc.error ? "error" : "info") as "error" | "info",
            message: `[TOOL] ${tc.name}: ${tc.result.slice(0, 100)}`,
            turnId: turn.id,
          })),
        ]);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(logs));
        return;
      }

      // GET /api/turns
      if (req.method === "GET" && path === "/api/turns") {
        const limit = parseInt(url.searchParams.get("limit") || "20");
        const turns = db.getRecentTurns(limit);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(turns));
        return;
      }

      // GET /api/wallets
      if (req.method === "GET" && path === "/api/wallets") {
        const financialState = JSON.parse(db.getKV("financial_state") || "{}");
        const solanaAddress = getSolanaWalletAddress();
        
        let solBalance = 0;
        let solanaUsdcBalance = 0;
        
        if (solanaAddress) {
          try {
            const solClient = createSolanaClient(config.solanaNetwork || "mainnet-beta");
            solBalance = await solClient.getBalance(solanaAddress);
            solanaUsdcBalance = await getUsdcBalanceSolana(solClient, solanaAddress);
          } catch {}
        }

        const wallets: Array<{
          chain: string;
          address: string;
          network: string;
          balances: Array<{ token: string; amount: number }>;
        }> = [
          {
            chain: "evm",
            address: identity.address,
            network: config.evmNetwork || "base",
            balances: [
              { token: "USDC", amount: financialState.usdcBalance || 0 },
              { token: "ETH", amount: 0 },
            ],
          },
        ];

        if (solanaAddress) {
          wallets.push({
            chain: "solana",
            address: solanaAddress,
            network: config.solanaNetwork || "mainnet-beta",
            balances: [
              { token: "SOL", amount: solBalance },
              { token: "USDC", amount: solanaUsdcBalance },
            ],
          });
        }

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(wallets));
        return;
      }

      // POST /api/control/wake
      if (req.method === "POST" && path === "/api/control/wake") {
        onWake?.();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true }));
        return;
      }

      // POST /api/control/sleep
      if (req.method === "POST" && path === "/api/control/sleep") {
        onSleep?.();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true }));
        return;
      }

      // POST /api/control/restart
      if (req.method === "POST" && path === "/api/control/restart") {
        onRestart?.();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true }));
        return;
      }

      // PATCH /api/config
      if (req.method === "PATCH" && path === "/api/config") {
        let body = "";
        for await (const chunk of req) {
          body += chunk;
        }
        const updates = JSON.parse(body);
        
        // Update config in memory (actual persistence would need file write)
        Object.assign(config, updates);
        
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true }));
        return;
      }

      // 404
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not found" }));
    } catch (error: any) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: error.message }));
    }
  });

  server.listen(port, () => {
    console.log(`[API] Dashboard API server running on http://localhost:${port}`);
  });

  return server;
}

function formatUptime(startTime: Date): string {
  const ms = Date.now() - startTime.getTime();
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}
